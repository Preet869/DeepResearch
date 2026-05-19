import os
import re
import json
import time
import base64
import logging
import asyncio
import ipaddress
from urllib.parse import urlparse
from types import SimpleNamespace
from typing import Annotated, Any, Dict, List, Optional, Tuple

import httpx
import jwt
from bs4 import BeautifulSoup

from fastapi import FastAPI, HTTPException, Header, Request, Response
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
import anthropic
from dotenv import load_dotenv
from supabase import create_client
from tavily import TavilyClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("deepresearch")


def _user_from_access_token_local(access_token: str) -> Optional[SimpleNamespace]:
    """Validate access JWT with the project's JWT secret (no GoTrue round-trip).

    Use when ``SUPABASE_SERVICE_KEY`` is missing or does not match the project but
    ``SUPABASE_URL`` + ``SUPABASE_JWT_SECRET`` do — e.g. mixed env after a branch/deploy change.
    """
    secret = (os.getenv("SUPABASE_JWT_SECRET") or "").strip()
    base_url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    if not secret or not base_url:
        return None
    expected_iss = f"{base_url}/auth/v1"
    try:
        payload = jwt.decode(
            access_token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            issuer=expected_iss,
            leeway=120,
        )
        uid = payload.get("sub")
        if not uid:
            return None
        return SimpleNamespace(id=uid, email=payload.get("email"))
    except jwt.PyJWTError as e:
        if (os.getenv("SUPABASE_JWT_SECRET") or "").strip():
            logger.warning(
                "Local JWT validation failed — check SUPABASE_JWT_SECRET and SUPABASE_URL match the Supabase project: %s",
                e,
            )
        else:
            logger.debug("Local JWT validation skipped or failed: %s", e)
        return None


def _jwt_payload_from_api_key(key: str) -> Optional[dict]:
    """Decode Supabase API key JWT payload (anon/service_role) without verifying signature."""
    if not key or not isinstance(key, str):
        return None
    parts = key.strip().split(".")
    if len(parts) != 3:
        return None
    try:
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        raw = base64.urlsafe_b64decode(payload_b64.encode("ascii"))
        return json.loads(raw)
    except Exception:
        return None


def _jwt_role_from_supabase_key(key: str) -> Optional[str]:
    """Decode JWT ``role`` claim without verification (sanity-check anon vs service_role)."""
    data = _jwt_payload_from_api_key(key)
    if not data:
        return None
    role = data.get("role")
    return str(role) if role is not None else None


# --- Initialize Clients ---
claude_client = None
tavily_client = None
supabase = None


def _db_for_access_token(access_token: str) -> Any:
    """Return the global service-role client. It bypasses RLS; user_id filters in every query enforce access."""
    return supabase


def initialize_clients():
    global claude_client, tavily_client, supabase

    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    supabase_url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/") or None
    supabase_service_key = (os.getenv("SUPABASE_SERVICE_KEY") or "").strip() or None

    if anthropic_api_key:
        claude_client = anthropic.Anthropic(api_key=anthropic_api_key)
        logger.info("Claude client initialized")
    else:
        logger.warning("ANTHROPIC_API_KEY not found")

    if tavily_api_key:
        tavily_client = TavilyClient(api_key=tavily_api_key)
        logger.info("Tavily client initialized")

    if supabase_url and supabase_service_key:
        role = _jwt_role_from_supabase_key(supabase_service_key)
        if role == "anon":
            logger.error(
                "SUPABASE_SERVICE_KEY has JWT role 'anon'. Use the service_role secret from "
                "Supabase Dashboard → Settings → API (not the anon public key). Admin Auth API will fail."
            )
        elif role and role != "service_role":
            logger.warning(
                "SUPABASE_SERVICE_KEY JWT role is %r (expected 'service_role'). "
                "Admin Auth API may return 401 Invalid API key.",
                role,
            )
        elif role is None:
            logger.warning(
                "Could not decode SUPABASE_SERVICE_KEY as a Supabase JWT; verify the full key was copied."
            )
        supabase = create_client(supabase_url, supabase_service_key)
        logger.info("Supabase client initialized (role=%s)", role)

    jwt_secret = (os.getenv("SUPABASE_JWT_SECRET") or "").strip()
    if jwt_secret and supabase_url:
        logger.info("SUPABASE_JWT_SECRET is set; validating user access tokens locally first.")

initialize_clients()

def _get_user_from_header(request: Request) -> str:
    """Extract a rate-limit key from the Authorization header."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:][:32]
    return get_remote_address(request)

limiter = Limiter(key_func=_get_user_from_header)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

def _resolved_cors_allowed_origins() -> List[str]:
    raw = os.getenv("ALLOWED_ORIGINS")
    if raw is None or not str(raw).strip():
        raw = os.getenv("FRONTEND_URL")
    if raw is None or not str(raw).strip():
        raw = "http://localhost:3000"
    return [o.strip() for o in str(raw).split(",") if o.strip()]


@app.on_event("startup")
async def startup_event():
    initialize_clients()


allowed_origins = _resolved_cors_allowed_origins()

if os.getenv("RENDER") == "true" and allowed_origins:
    renders_localhost_only = all(
        o.startswith(("http://127.", "http://localhost"))
        for o in allowed_origins
    )
    if renders_localhost_only:
        logger.warning(
            "CORS allows only loopback origins on Render — browsers from Vercel will be blocked. "
            "Set FRONTEND_URL=https://<your-production-host> "
            "(or ALLOWED_ORIGINS for multiple comma-separated origins)."
        )
    else:
        logger.info("CORS allowed origins: %s", allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# --- Pydantic Models ---
class ResearchRequest(BaseModel):
    prompt: str = Field(..., max_length=5000)
    conversation_id: Optional[int] = None
    folder_id: Optional[int] = None
    force_process: Optional[bool] = False

class FolderCreate(BaseModel):
    name: str
    color: str = "#3B82F6"

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class ConversationMove(BaseModel):
    conversation_id: int
    folder_id: Optional[int] = None

class FolderReorder(BaseModel):
    folder_ids: List[int]

class FolderDeleteRequest(BaseModel):
    delete_conversations: bool = False

class ArticleComparisonRequest(BaseModel):
    article1_url: Optional[str] = None
    article1_text: Optional[str] = None
    article1_title: Optional[str] = None
    article2_url: Optional[str] = None
    article2_text: Optional[str] = None
    article2_title: Optional[str] = None
    comparison_focus: Optional[str] = None
    context: Optional[str] = None
    folder_id: Optional[int] = None


class ComparisonFollowupRequest(BaseModel):
    conversation_id: int
    message: str = Field(..., max_length=5000)


class BetaReviewRequest(BaseModel):
    review: str = Field(..., max_length=2000)
    rating: Optional[int] = Field(None, ge=1, le=5)  # Optional 1-5 star rating


class CitationMetadataRequest(BaseModel):
    urls: List[str] = Field(..., min_length=1, max_length=20)


class ExportTelemetryRequest(BaseModel):
    format: str
    report_word_count: int = Field(..., ge=0)

# --- Auth Helper ---
async def get_user_from_token(access_token: str):
    """Validates JWT token via Supabase and returns user information."""
    try:
        local_user = _user_from_access_token_local(access_token)
        if local_user:
            return local_user

        if not supabase:
            logger.error(
                "Supabase client not initialized; set SUPABASE_URL and SUPABASE_SERVICE_KEY on Render."
            )
            return None
        user_response = supabase.auth.get_user(access_token)
        if user_response and user_response.user:
            return user_response.user
        return None
    except Exception as e:
        logger.warning("Token validation failed: %s", e)
        return None


def parse_bearer_token(authorization: Optional[str]) -> Optional[str]:
    """Extract JWT from Authorization header without raising on malformed input."""
    if authorization is None:
        return None
    s = str(authorization).strip()
    if not s:
        return None
    parts = s.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


async def require_user_and_token(authorization: Optional[str]) -> Tuple[Any, str]:
    token = parse_bearer_token(authorization)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization bearer token",
        )
    user = await get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user, token


async def require_authenticated_user(authorization: Optional[str]):
    """Require a valid Supabase JWT; raise 401 if missing or invalid."""
    user, _ = await require_user_and_token(authorization)
    return user


def _auth_uid(user: Any) -> str:
    """Stringify auth user id for uuid columns and RLS (SimpleNamespace / Supabase User)."""
    return str(user.id)


# --- Claude Helper ---
def call_claude(
    system_prompt: str,
    user_content: str,
    max_tokens: int = 2000,
    temperature: Optional[float] = None,
) -> str:
    """Synchronous Claude API call. Returns text content."""
    if not claude_client:
        raise RuntimeError("Claude client not initialized. Check ANTHROPIC_API_KEY.")
    kwargs: Dict[str, Any] = {
        "model": "claude-sonnet-4-5",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": user_content}],
        "system": system_prompt,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature
    message = claude_client.messages.create(**kwargs)
    return message.content[0].text

# =============================================================================
# STEP 1 — MULTI-QUERY SEARCH WITH SOURCE SCORING
# =============================================================================
_YEAR_IN_URL_RANGE = re.compile(r"\b(201[5-9]|202[0-9])\b")


def _published_date_for_tavily_result(r: Dict) -> str:
    """Tavily published_date if set; else first 2015–2026 year in URL; else n.d."""
    url = r.get("url") or ""
    for key in ("published_date", "publishedDate"):
        val = r.get(key)
        if val and str(val).strip():
            return str(val).strip()
    m = _YEAR_IN_URL_RANGE.search(url)
    if m:
        return m.group(1)
    return "n.d."


def score_source(url: str) -> int:
    """Score source quality. Higher = more credible."""
    url_lower = url.lower()
    if any(x in url_lower for x in [".edu", ".ac.", "scholar.google", "pubmed", "jstor",
                                      "sciencedirect", "springer", "wiley", "nature.com",
                                      "researchgate", "arxiv",
                                      "ncbi.nlm.nih.gov", "who.int", "un.org", "worldbank.org",
                                      "oecd.org", "jstor.org", "semanticscholar.org", "ssrn.com"]):
        score = 3  # Academic
    elif any(x in url_lower for x in [".gov", ".org"]):
        score = 2  # Government / NGO
    elif any(x in url_lower for x in ["bbc.", "reuters.", "guardian.", "nytimes.", "economist.",
                                       "ft.com", "wsj.com", "theatlantic"]):
        score = 1  # Quality news
    else:
        score = 0  # Blog / unknown
    logger.info("Source scored %d: %s", score, url)
    return score

async def multi_query_search(question: str) -> List[Dict]:
    """
    Runs 3 Claude-generated targeted sub-queries, deduplicates by URL,
    scores each source for quality, and returns the top 8.
    """
    if not tavily_client:
        logger.error("Tavily client not initialized")
        return []

    sub_queries = [
        question,
        f"{question} recent evidence data statistics",
        f"{question} academic research systematic review",
    ]
    gen_system = """Return a JSON array of exactly 3 search queries for the given research question. Query 1: core topic with academic signal. Query 2: recent evidence and data. Query 3: peer-reviewed research angle. Return only valid JSON. No explanation."""

    gen_user = f"Research question:\n{question}\n\nReturn JSON array only, e.g. [\"query1\", \"query2\", \"query3\"]"
    try:
        raw_q = call_claude(gen_system, gen_user, max_tokens=150)
        clean_q = raw_q.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        parsed = json.loads(clean_q)
        if isinstance(parsed, list):
            qs = [q.strip() for q in parsed if isinstance(q, str) and q.strip()]
            if len(qs) >= 3:
                sub_queries = qs[:3]
            elif qs:
                sub_queries = qs + sub_queries[len(qs):]
    except Exception as e:
        logger.warning("Sub-query generation failed, using fallback queries: %s", e)

    all_results = []
    seen_urls = set()

    for query in sub_queries:
        try:
            response = tavily_client.search(
                query=query,
                search_depth="advanced",
                max_results=5,
            )
            for r in response.get("results", []):
                url = r.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    r["published_date"] = _published_date_for_tavily_result(r)
                    r["quality_score"] = score_source(url)
                    all_results.append(r)
        except Exception as e:
            logger.error("Tavily search error for query '%s': %s", query, e)

    # Sort by quality score descending, keep top 8
    sorted_results = sorted(all_results, key=lambda x: x.get("quality_score", 0), reverse=True)
    top_results = sorted_results[:8]

    logger.info("Multi-query search: %d total results → %d after dedup/scoring", len(all_results), len(top_results))
    return top_results


async def evaluate_and_refine_sources(research_question: str, sources: List[Dict]) -> List[Dict]:
    """
    Optionally augments sources when count is low, asks Claude whether coverage is sufficient,
    runs one targeted Tavily search for a missing angle if needed, returns up to 10 sources.
    """
    if not tavily_client:
        return sources[:10] if sources else []

    def _merge_tavily_results(existing: List[Dict], results: List[Dict]) -> List[Dict]:
        seen = {s.get("url") for s in existing if s.get("url")}
        out = list(existing)
        for r in results:
            url = r.get("url", "")
            if url and url not in seen:
                seen.add(url)
                r["quality_score"] = score_source(url)
                out.append(r)
        return out

    current = list(sources)

    if len(current) < 4:
        try:
            resp = tavily_client.search(
                query=research_question,
                search_depth="advanced",
                max_results=5,
            )
            current = _merge_tavily_results(current, resp.get("results", []))
        except Exception as e:
            logger.error("Supplemental search (few sources) failed: %s", e)

    sources_preview = [
        {"index": i, "title": s.get("title", "")[:80], "domain": s.get("url", "").split("/")[2] if s.get("url") else ""}
        for i, s in enumerate(current[:15], 1)
    ]
    eval_system = """You evaluate whether a set of web search results adequately covers a research question for writing a grounded research report.

Return ONLY valid JSON with this exact shape:
{"sufficient": true or false, "missing_angle": "short phrase describing what topic or angle is missing, or empty string if sufficient"}

No markdown, no preamble."""

    eval_user = f"""Research question:
{research_question}

Sources found ({len(current)} total):
{json.dumps(sources_preview)}

If coverage is thin, missing_angle should name the concrete gap (e.g. "recent quantitative data", "clinical guidelines", "historical context")."""

    sufficient = True
    missing_angle = ""
    try:
        raw_eval = call_claude(eval_system, eval_user, max_tokens=80)
        clean_eval = raw_eval.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        ev = json.loads(clean_eval)
        if isinstance(ev, dict):
            sufficient = bool(ev.get("sufficient", True))
            missing_angle = (ev.get("missing_angle") or "").strip()
    except Exception as e:
        logger.warning("Source evaluation JSON failed, assuming sufficient: %s", e)

    logger.info(
        "Source evaluation: sufficient=%s missing_angle=%r",
        sufficient,
        missing_angle,
    )

    if not sufficient and missing_angle:
        try:
            targeted_query = f"{research_question} {missing_angle}".strip()
            resp2 = tavily_client.search(
                query=targeted_query[:500],
                search_depth="advanced",
                max_results=5,
            )
            seen_urls = {s.get("url") for s in current if s.get("url")}
            added = 0
            for r in resp2.get("results", []):
                if added >= 3:
                    break
                url = r.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    r["quality_score"] = score_source(url)
                    current.append(r)
                    added += 1
        except Exception as e:
            logger.error("Targeted Tavily search for missing angle failed: %s", e)

    current.sort(key=lambda x: x.get("quality_score", 0), reverse=True)
    return current[:10]


# =============================================================================
# STEP 2 — FACT EXTRACTION (grounded in real sources only)
# =============================================================================
async def extract_facts_from_sources(question: str, sources: List[Dict]) -> Dict:
    """
    Asks Claude to extract facts from sources only.
    Returns structured JSON with source-attributed facts.
    """
    sources_text = "\n\n".join([
        f"[{i}] Title: {s.get('title', 'Unknown')}\n"
        f"    URL: {s.get('url', '')}\n"
        f"    Published: {s.get('published_date', 'n.d.')}\n"
        f"    Domain: {s.get('url', '').split('/')[2] if s.get('url') else 'Unknown'}\n"
        f"    Content: {s.get('content', '')[:600]}"
        for i, s in enumerate(sources, 1)
    ])

    system = """You are a research fact extractor. Your ONLY job is to extract facts from the provided sources.

STRICT RULES:
- Extract ONLY facts explicitly stated in the sources — never add outside knowledge
- Every fact MUST include the source index number it came from
- Mark has_numbers as true if the fact contains statistics, percentages, or quantities
- If two sources say different things, extract both as separate facts
- Do NOT synthesize, interpret, or infer — only extract what is written
- Be concise. Extract maximum 4 facts per source.

Return ONLY valid JSON. No preamble, no explanation, no markdown."""

    user = f"""Research question: {question}

Sources:
{sources_text}

Return this JSON structure:
{{
  "facts": [
    {{"text": "exact fact here", "source_index": 0, "has_numbers": true}},
    {{"text": "another fact", "source_index": 1, "has_numbers": false}}
  ]
}}"""

    try:
        raw = call_claude(system, user, max_tokens=1000)
        # Strip any accidental markdown fences
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(clean)
    except Exception as e:
        logger.error("Fact extraction failed: %s", e)
        return {"facts": []}


# =============================================================================
# STEP 3 — REPORT GENERATION (using extracted facts only)
# =============================================================================
async def generate_report_from_facts(
    question: str,
    facts: List[Dict],
    sources: List[Dict],
    conversation_summary: Optional[str] = None,
) -> str:
    """
    Generates academic report using ONLY the extracted facts.
    No hallucination possible because the model can only cite provided facts.
    """
    facts_text = "\n".join([
        f"[{f['source_index']}] {f['text']}"
        for f in facts
    ]) if facts else "No facts extracted from sources."

    sources_text = "\n".join([
        f"[{i}] {s.get('title', 'Unknown')} — {s.get('url', '')}"
        for i, s in enumerate(sources, 1)
    ])

    summary_section = f"\nPrevious conversation context:\n{conversation_summary}\n" if conversation_summary else ""

    system = """You are an academic writing assistant helping students write research essays.

STRICT RULES:
- Use ONLY the facts provided in the VERIFIED FACTS section — never add outside knowledge
- Every claim in the report MUST cite a source using [N] notation
- If the facts are insufficient to fill a section, say "Insufficient source data for this section" — never fabricate
- Write in formal academic language
- The References section must list ONLY sources that were actually cited in the report"""

    user = f"""Research question: {question}
{summary_section}

VERIFIED FACTS (use only these):
{facts_text}

SOURCE LIST:
{sources_text}

Write a complete academic research report with these sections:
1. Executive Summary (4-5 bullet points of key findings)
2. Introduction and Background
3. Literature Review and Current Evidence
4. Critical Analysis
5. Conclusions
6. References — strict APA format only:
   - Known author: Smith, J. A. (2024). Title of work. Publisher. https://url
   - Organisation as author: World Resources Institute. (2024). Title. https://url
   - No date: International Energy Agency. (n.d.). Title. https://url
   - Only list sources actually cited in the report above

Cite every claim with [source_index]. If facts are insufficient for a section, state that clearly. 
For references use the metadata provided for each source:
    - Use published_date for the year, or (n.d.) if unavailable
    - Derive the publisher from the domain name
    - Use the title field exactly as provided
    - Format: Organisation. (Year). Title. URL"""

    try:
        return call_claude(system, user, max_tokens=3500)
    except Exception as e:
        logger.error("Report generation failed: %s", e)
        return "An error occurred while generating the report. Please try again."


# =============================================================================
# STEP 4 — CHART GENERATION (real numbers only)
# =============================================================================
async def generate_chart_from_facts(facts: List[Dict], sources: List[Dict]) -> Optional[Dict]:
    """
    Generates chart data ONLY from facts that contain real numbers.
    Returns None if no quantitative data exists — never fabricates.
    """
    number_facts = [f for f in facts if f.get("has_numbers")]
    if not number_facts:
        logger.info("No quantitative facts found — skipping chart generation")
        return None

    number_facts = number_facts[:8]

    number_facts_text = "\n".join([
        f"[{f['source_index']}] {f['text']}"
        for f in number_facts
    ])

    system = """You are a data visualization assistant.

STRICT RULES:
- ONLY use statistics, percentages, or quantities explicitly stated in the facts
- NEVER invent, estimate, or approximate numbers
- If the numbers cannot form a meaningful chart, return null
- Each data point must reference its source index
- Return ONLY valid JSON or the single word null"""

    user = f"""Facts containing real numbers:
{number_facts_text}

If these facts contain enough real quantitative data for a meaningful chart, return:
{{
  "title": "descriptive chart title",
  "type": "bar or line or pie",
  "data": [
    {{"name": "label", "value": 123, "source_index": 0}},
    {{"name": "label", "value": 456, "source_index": 1}}
  ],
  "x_label": "x axis label",
  "y_label": "y axis label",
  "description": "one sentence explaining what this chart shows",
  "key_insight": "one sentence about the most important finding",
  "why_matters": "one sentence about why this is significant",
  "insight_type": "primary",
  "ai_insights": [
    "insight 1",
    "insight 2",
    "insight 3"
  ]
}}

If insufficient real data exists for a chart, return: null"""

    try:
        raw = call_claude(system, user, max_tokens=400)
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        if clean.lower() == "null":
            return None
        return json.loads(clean)
    except Exception as e:
        logger.error("Chart generation failed or returned no data: %s", e)
        return None


# =============================================================================
# STEP 5 — FOLLOW-UP GENERATION
# =============================================================================
async def generate_followups(question: str, report_summary: str) -> List[str]:
    """Generates 5 intelligent follow-up questions based on gaps in the research."""
    system = """You are a research assistant helping students deepen their understanding.
Generate follow-up questions that explore gaps, related angles, or deeper aspects.
Return ONLY a JSON array of 5 strings. Nothing else."""

    user = f"""Original research question: {question}

Report summary (first 800 chars):
{report_summary[:800]}

Return 5 follow-up questions as a JSON array:
["question 1", "question 2", "question 3", "question 4", "question 5"]"""

    try:
        raw = call_claude(system, user, max_tokens=200)
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        questions = json.loads(clean)
        if isinstance(questions, list):
            return [q for q in questions if isinstance(q, str) and len(q) > 10][:5]
        return []
    except Exception as e:
        logger.error("Follow-up generation failed: %s", e)
        return [
            "What are the main risks and mitigation strategies?",
            "How does this compare across different regions or markets?",
            "What are the implementation challenges and solutions?",
            "What is the 5-year outlook for this topic?",
            "What are the policy implications and recommendations?",
        ]


# =============================================================================
# TITLE & SUMMARY HELPERS (lightweight — use Claude haiku equivalent)
# =============================================================================
async def generate_title(prompt: str) -> str:
    """Generates a short title for a research conversation."""
    system = "Generate a short, concise title (4-6 words) for the following research question. Return only the title, nothing else."
    try:
        return call_claude(system, prompt, max_tokens=15).strip().strip('"')
    except Exception:
        return "New Research"


async def extract_research_questions(assignment_text: str) -> List[str]:
    """Extract 2-3 focused research questions from an assignment brief."""
    system = """You are a research assistant helping students convert assignment briefs into focused research questions.

Extract 2-3 specific, answerable research questions from the provided assignment text.
Each question should:
- Be specific and focused (not too broad)
- Be answerable through research
- Help break down the larger assignment

Return ONLY a JSON array of strings, no explanation:
["question 1", "question 2", "question 3"]"""

    user = f"""Assignment text:
{assignment_text[:2000]}

Extract 2-3 focused research questions from this assignment."""

    try:
        raw = call_claude(system, user, max_tokens=200)
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        questions = json.loads(clean)
        if isinstance(questions, list):
            return [q for q in questions if isinstance(q, str) and len(q.strip()) > 10][:3]
        return []
    except Exception as e:
        logger.error("Research question extraction failed: %s", e)
        return [
            "What are the main factors contributing to this topic?",
            "What does current research say about this issue?",
            "What are the practical implications and recommendations?"
        ]


async def summarize_conversation(history: List[Dict[str, str]]) -> str:
    """Summarizes conversation history for context in follow-up searches."""
    history_str = "\n".join([f"{msg['role']}: {msg['content'][:500]}" for msg in history[-6:]])
    system = "Concisely summarize this conversation in 2-3 sentences. Focus on the key topics and conclusions. Return only the summary."
    try:
        return call_claude(system, history_str, max_tokens=150)
    except Exception as e:
        logger.error("Conversation summarization failed: %s", e)
        return ""


# =============================================================================
# ARTICLE EXTRACTION
# =============================================================================
async def extract_article_content(url: str) -> Dict[str, Any]:
    """Extracts article content from a URL using Tavily extract, with search fallback."""
    if not tavily_client:
        logger.warning("Article extraction skipped for %s: Tavily not configured", url)
        return {"title": "", "content": "", "url": url, "extraction_failed": True, "extraction_length": 0}
    try:
        response = tavily_client.extract(urls=[url])
        if response and response.get("results"):
            result = response["results"][0]
            content = result.get("raw_content", result.get("content", ""))[:6000]
            title = result.get("title", "") or "Unknown Article"
            extraction_failed = len(content.strip()) < 200
            if extraction_failed:
                logger.warning("Article extraction yielded minimal content for %s: %d chars", url, len(content))
            return {
                "title": title,
                "content": content,
                "url": url,
                "extraction_failed": extraction_failed,
                "extraction_length": len(content),
            }
    except Exception:
        pass

    try:
        response = tavily_client.search(
            query=url,
            search_depth="advanced",
            max_results=1,
        )
        if response["results"]:
            result = response["results"][0]
            content = result.get("content", "")[:6000]
            title = result.get("title", "") or "Unknown Article"
            extraction_failed = len(content.strip()) < 200
            if extraction_failed:
                logger.warning("Article extraction yielded minimal content for %s: %d chars", url, len(content))
            return {
                "title": title,
                "content": content,
                "url": result.get("url", url),
                "extraction_failed": extraction_failed,
                "extraction_length": len(content),
            }
    except Exception as e:
        logger.error("Article extraction failed for %s: %s", url, e)

    return {"title": "", "content": "", "url": url, "extraction_failed": True, "extraction_length": 0}


# =============================================================================
# CITATION METADATA (fetch page HTML, parse meta / JSON-LD)
# =============================================================================

_CITATION_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 DeepResearchCitation/1.0"
)
_MAX_HTML_BYTES = 900_000


def _is_safe_public_http_url(url: str) -> bool:
    try:
        parsed = urlparse(url.strip())
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    if host == "localhost" or host.endswith(".localhost"):
        return False
    if host in ("127.0.0.1", "::1", "0.0.0.0"):
        return False
    if host.endswith(".local") or host.endswith(".internal"):
        return False
    try:
        ip = ipaddress.ip_address(host)
        if not ip.is_global:
            return False
    except ValueError:
        pass
    return True


def _hostname_fallback_title(url: str) -> str:
    try:
        domain = urlparse(url).hostname or ""
        return domain.replace("www.", "").split(".")[0] or "Unknown Source"
    except Exception:
        return "Unknown Source"


def _year_from_text(text: Optional[str]) -> Optional[int]:
    if not text:
        return None
    text = text.strip()
    m = re.match(r"^(\d{4})", text)
    if m:
        y = int(m.group(1))
        if 1990 <= y <= 2035:
            return y
    m = re.search(r"\b(19\d{2}|20[0-3]\d)\b", text)
    if m:
        y = int(m.group(1))
        if 1990 <= y <= 2035:
            return y
    return None


def _year_from_url(url: str) -> Optional[int]:
    m = _YEAR_IN_URL_RANGE.search(url)
    if m:
        return int(m.group(1))
    return None


def _normalize_citation_author(raw: Optional[str]) -> Optional[str]:
    if not raw or not str(raw).strip():
        return None
    a = re.sub(r"\s+", " ", str(raw).strip())
    if len(a) > 400:
        a = a[:397] + "..."
    return a


def _meta_first(soup: BeautifulSoup, specs: List[Dict[str, str]]) -> Optional[str]:
    for attrs in specs:
        tag = soup.find("meta", attrs=attrs)
        if tag and tag.get("content"):
            val = str(tag["content"]).strip()
            if val:
                return val
    return None


def _ld_type_names(item: dict) -> List[str]:
    t = item.get("@type")
    if isinstance(t, list):
        return [str(x) for x in t if isinstance(x, str)]
    if isinstance(t, str):
        return [t]
    return []


def _ld_author_string(author_field) -> Optional[str]:
    if author_field is None:
        return None
    if isinstance(author_field, str):
        s = author_field.strip()
        return s or None
    if isinstance(author_field, dict):
        if author_field.get("name"):
            return _ld_author_string(author_field["name"])
        if author_field.get("@type") == "Person" or "givenName" in author_field or "familyName" in author_field:
            parts = [author_field.get("givenName", ""), author_field.get("familyName", "")]
            name = " ".join(p for p in parts if p).strip()
            return name or None
        return None
    if isinstance(author_field, list):
        names = []
        for a in author_field:
            s = _ld_author_string(a)
            if s:
                names.append(s)
        return ", ".join(names) if names else None
    return None


def _ld_extract_fill(item: dict, ld: Dict[str, Optional[str]]) -> None:
    if not isinstance(item, dict):
        return
    if item.get("headline") and not ld["title"]:
        ld["title"] = str(item["headline"]).strip()
    if item.get("name") and not ld["title"]:
        types = _ld_type_names(item)
        if any(x in types for x in ("WebPage", "Article", "NewsArticle", "ScholarlyArticle", "BlogPosting", "MedicalScholarlyArticle")):
            ld["title"] = str(item["name"]).strip()
    auth = _ld_author_string(item.get("author"))
    if auth and not ld["author"]:
        ld["author"] = auth
    for key in ("datePublished", "dateCreated", "uploadDate"):
        if item.get(key) and not ld["date_raw"]:
            ld["date_raw"] = str(item[key]).strip()
            break
    if item.get("dateModified") and not ld["date_raw"]:
        ld["date_raw"] = str(item["dateModified"]).strip()


def _ingest_json_ld(data, ld: Dict[str, Optional[str]]) -> None:
    if isinstance(data, list):
        for x in data:
            _ingest_json_ld(x, ld)
    elif isinstance(data, dict):
        if "@graph" in data and isinstance(data["@graph"], list):
            for node in data["@graph"]:
                _ingest_json_ld(node, ld)
        else:
            _ld_extract_fill(data, ld)


def citation_metadata_from_html(html: str, final_url: str) -> Dict[str, Optional[object]]:
    soup = BeautifulSoup(html[:_MAX_HTML_BYTES], "html.parser")

    meta_title = _meta_first(
        soup,
        [
            {"property": "og:title"},
            {"name": "twitter:title"},
            {"name": "citation_title"},
        ],
    )
    if not meta_title and soup.title and soup.title.string:
        meta_title = re.sub(r"\s+", " ", soup.title.string.strip())

    meta_author = _meta_first(
        soup,
        [
            {"name": "author"},
            {"property": "article:author"},
            {"name": "citation_author"},
            {"property": "og:article:author"},
            {"name": "twitter:creator"},
            {"property": "twitter:creator"},
            {"name": "DC.creator"},
            {"name": "dc.creator"},
        ],
    )

    meta_date = _meta_first(
        soup,
        [
            {"property": "article:published_time"},
            {"property": "og:article:published_time"},
            {"name": "citation_publication_date"},
            {"name": "citation_date"},
            {"property": "og:updated_time"},
            {"name": "pubdate"},
            {"name": "date"},
        ],
    )

    ld: Dict[str, Optional[str]] = {"title": None, "author": None, "date_raw": None}
    for script in soup.find_all("script", type=re.compile(r"application/ld\+json", re.I)):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        _ingest_json_ld(data, ld)

    title = meta_title or ld["title"]
    author = meta_author or ld["author"]
    date_raw = meta_date or ld["date_raw"]

    author = _normalize_citation_author(author)
    year = _year_from_text(date_raw) if date_raw else None
    if year is None:
        year = _year_from_url(final_url)

    if not title:
        title = _hostname_fallback_title(final_url)

    return {"title": title, "author": author, "year": year}


async def _fetch_citation_metadata_for_url(client: httpx.AsyncClient, url: str) -> Dict[str, Optional[object]]:
    result: Dict[str, Optional[object]] = {
        "url": url,
        "title": None,
        "author": None,
        "year": None,
    }
    if not _is_safe_public_http_url(url):
        logger.warning("Rejected unsafe URL for citation metadata: %s", url)
        result["title"] = _hostname_fallback_title(url)
        result["year"] = _year_from_url(url)
        return result
    try:
        r = await client.get(url, follow_redirects=True)
        r.raise_for_status()
        html = r.text
        final_url = str(r.url)
        meta = citation_metadata_from_html(html, final_url)
        result["url"] = final_url
        result["title"] = meta["title"]
        result["author"] = meta["author"]
        result["year"] = meta["year"]
    except Exception as e:
        logger.info("Citation metadata fetch failed for %s: %s", url, e)
        result["title"] = result["title"] or _hostname_fallback_title(url)
        result["year"] = result["year"] or _year_from_url(url)
    return result


# =============================================================================
# ARTICLE COMPARISON REPORT
# =============================================================================
ARTICLE_COMPARISON_PROMPT = """You are analyzing two complete academic articles for a student writing a literature review or comparative essay.

YOUR JOB: Help them synthesize these sources into their paper, NOT evaluate source credibility.

# CONTENT VALIDATION RULE

You have been provided with the FULL TEXT of both articles (not excerpts). 

❌ **NEVER write**:
- "Article excerpt does not provide..."
- "Insufficient content in excerpt..."
- "Cannot assess from excerpt..."
- "Based on provided excerpt..."

✅ **IF** an article genuinely lacks content on a theme:
- "Article A does not address [theme]"
- "While Article B discusses X extensively, Article A focuses on Y instead"

✅ **IF** you truly cannot find specific claims:
- Quote the most relevant passage you CAN find
- Explain what the article emphasizes instead
- Example: "Article A does not provide specific technical examples of bias mechanisms; instead, it focuses on broader societal implications such as [quote actual content]"

The user provided complete articles. Extract and compare the actual content, not hedged assessments.

# HANDLING MULTI-PERSPECTIVE ARTICLES

If an article contains multiple expert perspectives (e.g., interviews with 3 faculty members):

❌ **DO NOT** create separate thematic sections for each expert
❌ **DO NOT** compare Expert A vs Expert B within the same article

✅ **DO** synthesize all perspectives from one article into a unified position per theme
✅ **DO** note when experts within the same article have different emphases
✅ **DO** compare Article A's overall position vs Article B's overall position

**Example - WRONG:**
Theme: AI Bias
- Virginia Tech (Losey) Position: [...]
- Virginia Tech (Rho) Position: [...]  
- NAPS Position: [Insufficient]

**Example - CORRECT:**
Theme: AI Bias
- **Article A (NAPS) Position**: AI algorithms perpetuate societal biases because [extract actual claims from NAPS article]
  - Quote: "[actual quote from NAPS]"
  - Evidence: [what NAPS provides]
  
- **Article B (Virginia Tech) Position**: Multiple faculty experts agree bias stems from incomplete training data (Losey) and can reduce critical thinking (Rho)
  - Quote: "If the designers do not provide representative data, the resulting AI systems become biased" (Losey)
  - Quote: "There is a potential risk of diminishing critical thinking skills" (Rho)
  - Evidence: Expert technical explanations from mechanical engineering and CS perspectives
  
- **Synthesis**: Both articles identify AI bias as concerning. Article A frames it as [X], while Article B provides technical explanation through [Y]. They agree on problem existence but differ in [how they explain it / solutions proposed / depth of analysis].

# ANALYSIS FRAMEWORK

## 1. QUICK OVERVIEW (Top of report)
- **Main topic/question both articles address**
- **Key agreement**: What do both sources say?
- **Key disagreement**: Where do they conflict and WHY?
- **Strongest evidence**: Which article has better support for its claims?
- **Best use**: When to cite Article A vs Article B in their paper

## 2. THEMATIC COMPARISON (Core of report)

**CRITICAL: Use the new structure below to avoid empty sections**

Organize themes into TWO categories:

### OVERLAPPING THEMES (Both articles address these)
For each theme both articles discuss, provide full comparison with quotes from both.

### UNIQUE THEMES  
- **Themes Unique to Article 1**: List what only Article 1 covers, with brief explanation and implication
- **Themes Unique to Article 2**: List what only Article 2 covers, with brief explanation and implication

**RULE**: If a theme appears in only one article, DO NOT create an empty comparison section. Instead, note it as a unique contribution and explain why it matters for the student's argument.

**Example of WRONG approach**:
Theme: Privacy and Surveillance
- Article A Position: [full analysis]
- Article B Position: "Article B does not address this theme"

**Example of CORRECT approach**:
Under "Themes Unique to Article 1":
**Privacy and Surveillance** (Article 1 only)
Article 1 warns that "AI technologies enable extensive surveillance and data collection, raising concerns about privacy invasion." Article 2 focuses on algorithmic bias instead.
**Implication**: If your paper needs to discuss surveillance specifically, Article 1 is your only source here. You'll need additional academic sources on AI surveillance to strengthen this argument.

## 3. METHODOLOGICAL NOTES

**Keep this section to 2-3 sentences maximum.**

Only include if:
- Methodological differences DIRECTLY explain why articles reach different conclusions
- Example: "Article A surveyed 1,000 consumers in 2020; Article B interviewed 15 AI researchers in 2024. The different methods explain why Article A emphasizes user concerns while Article B emphasizes technical capabilities."

❌ **DO NOT** include generic statements about source credibility
❌ **DO NOT** lecture about "why one article is stronger"
❌ **DO NOT** discuss author credentials unless directly relevant to conflicting claims

If methods don't explain differences in conclusions, SKIP THIS SECTION ENTIRELY.

## 4. SYNTHESIS FOR STUDENT WRITING
Provide 2-3 paragraph templates they can adapt:

**For a balanced literature review:**
"Both [Author A] and [Author B] address [topic], but from different perspectives. While [Author A] emphasizes [key point with quote], [Author B] argues [contrasting point with quote]. This tension reflects [underlying reason for disagreement]. A comprehensive understanding requires acknowledging both [synthesis statement]."

**For an argumentative essay (Pro position):**
"[Use Article B's strongest evidence as primary support, acknowledge Article A's concerns as addressable limitations]"

**For an argumentative essay (Con position):**
"[Use Article A's strongest evidence as primary support, address Article B's counterarguments]"

## 5. QUICK REFERENCE TABLE

**STRICT FORMATTING RULES - Each table cell must be:**
- Maximum 10-12 words
- One sentence or short phrase only
- No quotes longer than 5 words in the table itself

| Dimension | Article A: [Title] | Article B: [Title] |
|-----------|-------------------|-------------------|
| **Main Claim** | [Max 12 words] | [Max 12 words] |
| **Best Evidence** | [Max 12 words] | [Max 12 words] |
| **Limitations** | [Max 12 words] | [Max 12 words] |
| **Best Quote** | "[Max 5 words]" (full quote in Thematic Analysis) | "[Max 5 words]" (full quote in Thematic Analysis) |
| **When to Cite** | [Max 12 words] | [Max 12 words] |

Keep the table scannable. Full quotes belong in the Thematic Analysis sections, not here.

# HANDLING QUALITY DIFFERENCES

If one article is clearly more detailed/technical/credible than the other:

❌ **DO NOT** dismiss the weaker article as "insufficient"
❌ **DO NOT** spend paragraphs explaining why one is better

✅ **DO** extract what the weaker article DOES contribute
✅ **DO** note differences matter-of-factly: "Article A provides general overview while Article B offers technical depth"
✅ **DO** suggest when each is useful: "Article A works for introducing the topic; Article B provides evidence for detailed analysis"

Students chose both articles for a reason. Help them use both effectively, even if quality differs.

# RULES

DO NOT:
- Lecture about source credibility unless sources are obviously fake/propaganda
- Organize sections by "Evidence Quality Assessment" or "Scholarly Rigor"
- Provide generic citation advice ("always use peer-reviewed sources")
- Say "content not accessible" - if you can't read it, tell user to paste full text and STOP
- Compare publication venues (blog vs journal) unless explicitly asked
- Use condescending academic tone
- Use ANY form of "excerpt" or "insufficient content" language

DO:
- Extract specific claims and evidence from BOTH articles
- Show where articles agree AND disagree on specific points
- Explain WHY they disagree (methodology, sample, timeframe, theory)
- Provide quotable passages with citations
- Generate usable synthesis paragraphs
- Focus on CONTENT, not source type
- Use student-friendly, practical language
- Treat both articles as complete sources worth comparing

# OUTPUT FORMAT

Use markdown with clear headers:

# How to Use This Report

**If you're writing a literature review**: Start with Thematic Analysis → use the Synthesis paragraphs to show how sources relate

**If you're writing an argumentative essay**: Go straight to "How to Use These Sources in Your Paper" → pick the template matching your position

**If you need specific quotes**: Check Quick Comparative Overview → then find full quotes in Thematic Analysis sections

**If you're evaluating source quality**: Read Methodological Notes (but keep it brief in your paper)

**If you need more sources**: Skip to Research Gaps → follow the search recommendations

---

# Quick Comparative Overview

## At-a-Glance Scores

| Criteria | Article 1 | Article 2 | Why It Matters |
|----------|-----------|-----------|----------------|
| Argument Strength | ★★★☆☆ (X/10) | ★★★★☆ (Y/10) | [Brief explanation of scoring difference] |
| Evidence Quality | ★★☆☆☆ (X/10) | ★★★★☆ (Y/10) | [Brief explanation of evidence differences] |
| Practical Relevance | ★★★☆☆ (X/10) | ★★★★★ (Y/10) | [Brief explanation of relevance differences] |
| Synthesis Value | ★★★☆☆ (X/10) | ★★★★☆ (Y/10) | [Brief explanation of synthesis utility] |

**Key Insight**: [One sentence about which article is stronger overall and why]

[4-5 bullet points hitting main agreement, disagreement, strongest evidence, best uses]

# Thematic Analysis

## Overlapping Themes (Both Articles Address These)

### [Theme 1 - e.g., "Economic Impact"]
**Article A's Position**: [Specific claim with evidence - REQUIRED]
- Quote: "[Exact quotable passage from Article A]"
- Evidence type: [Survey data / Expert opinion / Case study / etc.]

**Article B's Position**: [Specific claim with evidence - REQUIRED]  
- Quote: "[Exact quotable passage from Article B]"
- Evidence type: [Survey data / Expert opinion / Case study / etc.]

**Synthesis**: [How they compare, agree, conflict, and implications for student]

### [Theme 2 - e.g., "Ethical Concerns"]
[Same structure as above]

## Themes Unique to Article 1
**[Theme Name]** (Article 1 only)
[Brief explanation of what Article 1 covers that Article 2 doesn't, with key quote]

**Implication**: [Why this matters for the student's argument and what it adds to their paper]

## Themes Unique to Article 2  
**[Theme Name]** (Article 2 only)
[Brief explanation of what Article 2 covers that Article 1 doesn't, with key quote]

**Implication**: [Why this matters for the student's argument and what it adds to their paper]

# Methodological Notes

**Maximum 2-3 sentences. Focus ONLY on explaining why articles reach different conclusions, not evaluating quality.**

Example: "Article A provides a categorical overview of AI concerns for general audiences; Article B draws from three researchers' specific domains (robotics, human-computer interaction, computational social science). This explains why Article A covers more concern categories (employment, surveillance, existential risk) while Article B provides deeper technical explanations of fewer issues (bias mechanisms, current algorithmic influence)."

**Do NOT judge which is "better" - explain differences, don't evaluate them.**

# How to Use These Sources in Your Paper
[2-3 paragraph templates for different argument types]

# Quick Reference
[Comparison table with proper markdown formatting]

# Research Gaps

### Gap 1: Quantitative Bias Data

**What's missing**: Neither article provides comprehensive statistical data on bias prevalence across different AI systems and industries. We get general examples but lack systematic measurements.

**To find it**: Search Google Scholar for "AI bias prevalence statistics" OR "algorithmic discrimination quantitative studies" OR "machine learning fairness metrics evaluation"

**Recommended sources**: 
- Papers from ACM FAccT Conference (Fairness, Accountability, and Transparency)
- Reports from AI Now Institute and Partnership on AI
- Studies from MIT's Computer Science and Artificial Intelligence Laboratory (CSAIL)
- IEEE publications on algorithmic auditing

**Why it matters**: Hard numbers on bias frequency and severity make your argument more compelling than relying solely on conceptual discussions.

### Gap 2: Regulatory Frameworks and Policy Proposals

**What's missing**: Both articles focus on problems but don't extensively cover existing or proposed regulatory solutions. Missing concrete policy recommendations and their effectiveness.

**To find it**: Search Google Scholar for "AI regulation policy proposals" OR "algorithmic accountability legislation" OR "EU AI Act implementation studies"

**Recommended sources**:
- Brookings Institution AI governance reports
- Stanford HAI (Human-Centered AI Institute) policy briefs
- Papers from Berkeley Center for Long-Term Cybersecurity
- Government reports from FTC, NIST, or European Commission

**Why it matters**: Shows you understand the solution landscape, not just the problems, making your argument more sophisticated and actionable.

### Gap 3: International/Comparative Perspectives on AI Governance

**What's missing**: Both articles have a primarily US-centric view. Missing how other countries approach AI ethics and what we can learn from different regulatory approaches.

**To find it**: Search Google Scholar for "comparative AI governance international" OR "EU vs US AI regulation differences" OR "China AI ethics policy comparison"

**Recommended sources**:
- Oxford Internet Institute publications
- Cambridge Centre for AI in Medicine policy papers
- Reports from Organisation for Economic Co-operation and Development (OECD)
- Studies from Singapore's AI Governance initiatives

**Why it matters**: International comparisons strengthen arguments about what regulatory approaches work best and show global scope of the issues.

### Gap 4: Economic Impact Data (Employment Displacement Statistics)

**What's missing**: While both articles mention job displacement concerns, neither provides detailed economic modeling or employment impact statistics across different sectors.

**To find it**: Search Google Scholar for "AI automation employment statistics" OR "machine learning job displacement economics" OR "artificial intelligence labor market impact data"

**Recommended sources**:
- McKinsey Global Institute employment reports
- Bureau of Labor Statistics AI impact studies
- Papers from MIT Work of the Future initiative
- World Economic Forum Future of Jobs reports

**Why it matters**: Concrete economic data makes abstract concerns about AI impact tangible and helps quantify the scale of challenges discussed.

### Gap 5: Long-term Sociological Studies on AI Interaction Effects

**What's missing**: Both articles discuss current AI interactions but lack longitudinal studies on how prolonged AI use changes human behavior, decision-making, or social relationships over time.

**To find it**: Search Google Scholar for "longitudinal AI human interaction studies" OR "social media algorithm behavior change" OR "human-computer interaction long-term effects"

**Recommended sources**:
- Papers from CHI Conference (Computer-Human Interaction)
- Studies from Stanford's Human-Computer Interaction Group
- Research from University of Washington's Center for an Informed Public
- Publications from Pew Research Center on technology's social impact

**Why it matters**: Long-term behavioral data helps you argue about future consequences rather than just current observations, making your analysis more forward-looking and comprehensive.

---

# Citation-Ready Quotes (Optional Enhancement)

**ONLY include this section if you find particularly strong, quotable passages that students can copy directly into their papers. Keep it concise - maximum 8-10 quotes total.**

Organize by argument type for easy student navigation:

**For arguments about AI bias mechanisms:**
> "[Full quotable sentence from Article 1/2]" ([Author], [Year], [Source])

**For arguments about current vs future AI threats:**
> "[Full quotable sentence from Article 1/2]" ([Author], [Year], [Source])

**For arguments about AI's decision-making influence:**
> "[Full quotable sentence from Article 1/2]" ([Author], [Year], [Source])

**For arguments about [relevant theme from your analysis]:**
> "[Full quotable sentence from Article 1/2]" ([Author], [Year], [Source])

*Note: Each quote should be citation-ready with proper attribution and represent the strongest, most quotable passages from each article.*

---

**Do NOT include any JSON blocks or raw data in the output. The visual scoring table in the Quick Comparative Overview section provides all the summary information students need.**
"""


async def generate_article_comparison_report(
    article1: Dict, article2: Dict, focus: str = "overall", context: Optional[str] = None
) -> str:
    """Generates a structured comparison report between two articles."""
    if not claude_client:
        raise RuntimeError("Claude client not initialized. Check ANTHROPIC_API_KEY.")

    # Validate content extraction — fail fast with a helpful message
    article1_content = article1.get("content", "").strip()
    article2_content = article2.get("content", "").strip()
    min_content_length = 200

    if len(article1_content) < min_content_length:
        return f"""# Content Extraction Failed for Article 1

I couldn't extract enough content from **{article1.get('title', 'Article 1')}**.

**What you can do:**
1. Copy the full article text and paste it into the "Article 1 text" field
2. Make sure the URL is publicly accessible (not behind a paywall)
3. Try a different URL if available

**Article 1 URL attempted:** {article1.get('url', 'No URL provided')}
**Content extracted:** {len(article1_content)} characters (need at least {min_content_length})
"""

    if len(article2_content) < min_content_length:
        return f"""# Content Extraction Failed for Article 2

I couldn't extract enough content from **{article2.get('title', 'Article 2')}**.

**What you can do:**
1. Copy the full article text and paste it into the "Article 2 text" field
2. Make sure the URL is publicly accessible (not behind a paywall)
3. Try a different URL if available

**Article 2 URL attempted:** {article2.get('url', 'No URL provided')}
**Content extracted:** {len(article2_content)} characters (need at least {min_content_length})
"""

    # Build user message
    user_prompt = f"""Compare these two articles for a student literature review/essay.

CRITICAL INSTRUCTION: Both articles below are COMPLETE, not excerpts. You must extract and compare specific claims, arguments, and evidence from BOTH Article 1 and Article 2. 

If Article 1 appears to be less detailed than Article 2, that may reflect writing style differences, but you must still extract what it DOES say about each theme. Do not dismiss Article 1 as "insufficient" - find and quote what it actually argues.

# ARTICLE 1: {article1.get('title', 'Article 1')}
Source: {article1.get('url', 'Text provided by user')}

{article1_content[:6000]}

---

# ARTICLE 2: {article2.get('title', 'Article 2')}
Source: {article2.get('url', 'Text provided by user')}

{article2_content[:6000]}

---

For EACH theme, you must provide:
1. What Article 1 says (with actual quotes from the text above)
2. What Article 2 says (with actual quotes from the text above)  
3. How they compare

**QUOTE EXTRACTION RULES:**
- NEVER include mid-word brackets like "m[essy" - either reconstruct the full word or use clear ellipsis
- Use standard ellipsis for truncation: "As we begin [...] we may prefer" instead of "As we begin to converse more often with AI [...] we may prefer"
- Ensure all quotes are complete sentences or clearly marked truncations
- No extraction artifacts should appear in final quotes

Do NOT skip Article 1 content. Extract what it argues even if less technical than Article 2.

"""

    # Append focus instruction if not the default
    if focus and focus != "overall":
        focus_instructions = {
            "methodology": "Focus your thematic comparison on methodological differences and how they affect conclusions.",
            "findings": "Focus your thematic comparison on findings/results and where they agree or conflict.",
        }
        user_prompt += f"\n**COMPARISON FOCUS:** {focus_instructions.get(focus, focus)}\n"

    # Append assignment context if provided
    if context:
        user_prompt += f"""
**STUDENT'S ASSIGNMENT CONTEXT:**
{context}

Tailor your thematic comparison to help with this specific assignment. Identify which article better supports different positions the student might take.
"""

    user_prompt += "\nGenerate a comprehensive thematic comparison following the framework above."

    try:
        message = claude_client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=5000,
            temperature=0.3,
            system=ARTICLE_COMPARISON_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return message.content[0].text
    except Exception as e:
        logger.error("Article comparison failed: %s", e)
        return "An error occurred while generating the comparison report. Please try again."


# =============================================================================
# USAGE HELPERS
# =============================================================================
MONTHLY_REPORT_LIMIT = 5


def _lifetime_completed_report_threads(user_id: str, db: Any) -> int:
    """How many of this user's conversations include at least one assistant message (counts imports regardless of ``created_at``)."""
    if not db:
        return 0
    uid = str(user_id)
    try:
        convos_res = db.table("conversations").select("id").eq("user_id", uid).execute()
        convo_rows = convos_res.data or []
        if not convo_rows:
            return 0
        convo_ids = [row["id"] for row in convo_rows]
        seen: set[Any] = set()
        chunk_size = 150
        for i in range(0, len(convo_ids), chunk_size):
            chunk = convo_ids[i : i + chunk_size]
            msg_res = (
                db.table("messages")
                .select("conversation_id")
                .eq("role", "assistant")
                .in_("conversation_id", chunk)
                .execute()
            )
            for row in msg_res.data or []:
                cid = row.get("conversation_id")
                if cid is not None:
                    seen.add(cid)
        return len(seen)
    except Exception as e:
        logger.warning("lifetime report thread count failed: %s", e)
        return 0


def _total_sources_cited(user_id: str, db: Any) -> int:
    """Sum ``sources_used`` from assistant message metadata across the user's conversations.

    Each completed research run stores ``sources_used`` (web sources in that report).
    Article comparisons without the field are counted as 2 when we set it on save.
    """
    if not db:
        return 0
    uid = str(user_id)
    try:
        convos_res = db.table("conversations").select("id").eq("user_id", uid).execute()
        convo_ids = [row["id"] for row in (convos_res.data or [])]
        if not convo_ids:
            return 0
        total = 0
        chunk_size = 100
        for i in range(0, len(convo_ids), chunk_size):
            part = convo_ids[i : i + chunk_size]
            msg_res = (
                db.table("messages")
                .select("metadata")
                .eq("role", "assistant")
                .in_("conversation_id", part)
                .execute()
            )
            for row in msg_res.data or []:
                meta = row.get("metadata") or {}
                if isinstance(meta, str):
                    try:
                        meta = json.loads(meta)
                    except (json.JSONDecodeError, TypeError):
                        meta = {}
                val = meta.get("sources_used")
                if isinstance(val, (int, float)):
                    total += int(val)
        return total
    except Exception as e:
        logger.warning("total_sources_cited failed: %s", e)
        return 0


def _profile_role(user_id: str, db: Any) -> str:
    """Return app role from profiles; default ``user`` if missing or unreadable."""
    if not db:
        return "user"
    try:
        res = (
            db.table("profiles")
            .select("role")
            .eq("id", str(user_id))
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return "user"
        role = (rows[0].get("role") or "user").strip().lower()
        return role if role in ("admin", "user") else "user"
    except Exception as e:
        logger.warning("profiles role lookup failed for %s: %s", user_id, e)
        return "user"


def _user_is_admin(user_id: str, db: Any) -> bool:
    return _profile_role(user_id, db) == "admin"


def _get_reports_quota_locked(user_id: str, db: Any) -> bool:
    """True if profiles.reports_quota_locked is set (beta quota exhausted — not cleared by deletes)."""
    if not db:
        return False
    try:
        res = (
            db.table("profiles")
            .select("reports_quota_locked")
            .eq("id", str(user_id))
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return False
        return bool(rows[0].get("reports_quota_locked"))
    except Exception as e:
        logger.warning("profiles reports_quota_locked lookup failed for %s: %s", user_id, e)
        return False


def _set_reports_quota_locked(user_id: str, db: Any) -> None:
    """Persist quota lock; best-effort only."""
    if not db:
        return
    try:
        db.table("profiles").update({"reports_quota_locked": True}).eq("id", str(user_id)).execute()
    except Exception as e:
        logger.warning("profiles reports_quota_locked update failed for %s: %s", user_id, e)


def _evaluate_reports_quota(uid: str, db: Any) -> tuple[bool, int, bool]:
    """Returns ``(quota_locked, lifetime_completed_threads, just_reached_limit)``. Persists lock when non-admin hits cap."""
    lifetime = _lifetime_completed_report_threads(uid, db)
    was_locked = _get_reports_quota_locked(uid, db)
    just_reached_limit = False
    
    if not _user_is_admin(uid, db) and lifetime >= MONTHLY_REPORT_LIMIT:
        if not was_locked:
            # User just reached the limit for the first time
            just_reached_limit = True
        _set_reports_quota_locked(uid, db)
        locked = True
    else:
        locked = was_locked
    
    return locked, lifetime, just_reached_limit


def _insert_usage_event(user_id: Optional[str], event_type: str, metadata: Dict) -> None:
    """Best-effort insert into usage_events; never raises; does not touch the HTTP response."""
    if not supabase:
        return
    try:
        supabase.table("usage_events").insert(
            {
                "user_id": user_id,
                "event_type": event_type,
                "metadata": metadata,
            }
        ).execute()
    except Exception as e:
        logger.warning("usage_events insert skipped (%s): %s", event_type, e)


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    return {"message": "DeepResearch API is running", "status": "healthy"}


def _beta_user_limit() -> int:
    raw = os.getenv("BETA_USER_LIMIT", "50")
    try:
        n = int(raw)
        return max(1, n)
    except ValueError:
        logger.warning("Invalid BETA_USER_LIMIT=%r, using 50", raw)
        return 50


def _count_auth_users() -> int:
    """Total users in Supabase Auth (paginated Admin API).

    Beta cap uses this — not rows in application tables."""
    total = 0
    page = 1
    per_page = 200
    while True:
        batch = supabase.auth.admin.list_users(page=page, per_page=per_page)
        n = len(batch)
        total += n
        if n < per_page:
            break
        page += 1
    return total


@app.get("/beta-signup-status")
async def beta_signup_status():
    """Public endpoint: whether new email/password signups are still allowed (beta cap).

    Counts Supabase Auth users via admin ``list_users`` (same source as the cap).

    Fields:
    - ``registered_count``: how many Auth users exist
    - ``spots_remaining``: max(0, limit - registered_count)
    """
    limit = _beta_user_limit()
    if not supabase:
        # Client needs SUPABASE_URL + SUPABASE_SERVICE_KEY; if only URL is set (mis-synced env),
        # avoid blocking the login UI with 503.
        if (os.getenv("SUPABASE_URL") or "").strip():
            return {
                "signup_open": True,
                "limit": limit,
                "registered_count": None,
                "spots_remaining": None,
                "degraded": True,
            }
        raise HTTPException(
            status_code=503,
            detail="Signup availability could not be checked. Please try again later.",
        )
    try:
        registered = _count_auth_users()
        spots = max(0, limit - registered)
        return {
            "signup_open": registered < limit,
            "limit": limit,
            "registered_count": registered,
            "spots_remaining": spots,
            "degraded": False,
        }
    except Exception as e:
        logger.exception("beta_signup_status failed: %s", e)
        # Admin API (list_users) requires service_role; allow login UI to load if misconfigured.
        return {
            "signup_open": True,
            "limit": limit,
            "registered_count": None,
            "spots_remaining": None,
            "degraded": True,
        }


@app.get("/health")
async def health_check():
    """Diagnostic endpoint — confirms env vars and client state. No auth required.

    Visit https://<render-host>/health to verify Render env vars are set correctly before debugging 500s.
    """
    from datetime import datetime, timezone
    sk = (os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
    url = (os.getenv("SUPABASE_URL") or "").strip()
    role = _jwt_role_from_supabase_key(sk) if sk else None
    supabase_reachable = False
    try:
        if supabase:
            supabase.table("conversations").select("id", count="exact").limit(0).execute()
            supabase_reachable = True
    except Exception as e:
        logger.warning("Health check: Supabase unreachable: %s", e)
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "supabase_url_set": bool(url),
        "supabase_service_key_set": bool(sk),
        "supabase_key_role": role,
        "supabase_client_ready": supabase is not None,
        "supabase_reachable": supabase_reachable,
        "anthropic_key_set": bool(os.getenv("ANTHROPIC_API_KEY")),
        "tavily_key_set": bool(os.getenv("TAVILY_API_KEY")),
        "frontend_url": os.getenv("FRONTEND_URL") or "(not set)",
        "allowed_origins": _resolved_cors_allowed_origins(),
    }


# --- Folder Endpoints ---
@app.get("/folders")
async def get_folders(authorization: Annotated[Optional[str], Header()] = None):
    try:
        user, token = await require_user_and_token(authorization)
        uid = _auth_uid(user)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")

        folders_response = db.table("folders").select("*").eq("user_id", uid).order("created_at", desc=False).execute()

        folders_with_counts = []
        for folder in folders_response.data or []:
            count_response = db.table("conversations").select("id", count="exact").eq("user_id", uid).eq("folder_id", folder["id"]).execute()
            folders_with_counts.append({**folder, "conversation_count": count_response.count or 0})

        return folders_with_counts
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in get_folders: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve folders")


@app.post("/folders")
async def create_folder(folder: FolderCreate, authorization: Annotated[Optional[str], Header()] = None):
    try:
        user, token = await require_user_and_token(authorization)
        uid = _auth_uid(user)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")
        response = db.table("folders").insert({"user_id": uid, "name": folder.name, "color": folder.color}).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in create_folder: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create folder")


@app.put("/folders/{folder_id}")
async def update_folder(folder_id: int, folder: FolderUpdate, authorization: Annotated[Optional[str], Header()] = None):
    try:
        user, token = await require_user_and_token(authorization)
        uid = _auth_uid(user)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")

        folder_check = db.table("folders").select("id").eq("id", folder_id).eq("user_id", uid).execute()
        if not folder_check.data:
            raise HTTPException(status_code=404, detail="Folder not found or access denied")

        update_data = {}
        if folder.name is not None:
            update_data["name"] = folder.name
        if folder.color is not None:
            update_data["color"] = folder.color

        response = db.table("folders").update(update_data).eq("id", folder_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in update_folder: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update folder")


@app.delete("/folders/{folder_id}")
async def delete_folder(folder_id: int, delete_conversations: bool = False, authorization: Annotated[Optional[str], Header()] = None):
    try:
        user, token = await require_user_and_token(authorization)
        uid = _auth_uid(user)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")

        folder_check = db.table("folders").select("id, name").eq("id", folder_id).eq("user_id", uid).execute()
        if not folder_check.data:
            raise HTTPException(status_code=404, detail="Folder not found or access denied")

        folder_name = folder_check.data[0]["name"]
        conversations_res = db.table("conversations").select("id").eq("folder_id", folder_id).eq("user_id", uid).execute()
        conversation_ids = [conv["id"] for conv in (conversations_res.data or [])]

        if delete_conversations:
            for conv_id in conversation_ids:
                db.table("messages").delete().eq("conversation_id", conv_id).execute()
                db.table("conversations").delete().eq("id", conv_id).execute()
            message = f"Folder '{folder_name}' and all {len(conversation_ids)} research items deleted successfully"
        else:
            db.table("conversations").update({"folder_id": None}).eq("folder_id", folder_id).eq("user_id", uid).execute()
            message = f"Folder '{folder_name}' deleted. {len(conversation_ids)} research items moved to uncategorized."

        db.table("folders").delete().eq("id", folder_id).execute()
        return {"message": message}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in delete_folder: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete folder")


@app.post("/folders/reorder")
async def reorder_folders(reorder_data: FolderReorder, authorization: Annotated[Optional[str], Header()] = None):
    try:
        user, token = await require_user_and_token(authorization)
        uid = _auth_uid(user)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")

        for folder_id in reorder_data.folder_ids:
            folder_check = db.table("folders").select("id").eq("id", folder_id).eq("user_id", uid).execute()
            if not folder_check.data:
                raise HTTPException(status_code=404, detail=f"Folder {folder_id} not found or access denied")

        from datetime import datetime, timedelta
        base_time = datetime.now()
        for index, folder_id in enumerate(reorder_data.folder_ids):
            new_timestamp = base_time + timedelta(minutes=index)
            db.table("folders").update({"created_at": new_timestamp.isoformat()}).eq("id", folder_id).execute()

        return {"message": "Folders reordered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in reorder_folders: %s", e)
        raise HTTPException(status_code=500, detail="Failed to reorder folders")


@app.post("/conversations/move")
async def move_conversation(move_data: ConversationMove, authorization: Annotated[Optional[str], Header()] = None):
    try:
        user, token = await require_user_and_token(authorization)
        uid = _auth_uid(user)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")

        convo_check = db.table("conversations").select("id").eq("id", move_data.conversation_id).eq("user_id", uid).execute()
        if not convo_check.data:
            raise HTTPException(status_code=404, detail="Conversation not found or access denied")

        if move_data.folder_id is not None:
            folder_check = db.table("folders").select("id").eq("id", move_data.folder_id).eq("user_id", uid).execute()
            if not folder_check.data:
                raise HTTPException(status_code=404, detail="Folder not found or access denied")

        response = db.table("conversations").update({"folder_id": move_data.folder_id}).eq("id", move_data.conversation_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in move_conversation: %s", e)
        raise HTTPException(status_code=500, detail="Failed to move conversation")


@app.get("/conversations")
async def get_conversations(folder_id: Optional[int] = None, authorization: Annotated[Optional[str], Header()] = None):
    try:
        user, token = await require_user_and_token(authorization)
        uid = _auth_uid(user)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")

        query = db.table("conversations").select("id, title, created_at, folder_id, conversation_type").eq("user_id", uid)
        if folder_id is not None:
            query = query.eq("folder_id", folder_id)
        response = query.order("created_at", desc=True).execute()
        return response.data or []
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in get_conversations: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve conversations")


@app.get("/messages/{conversation_id}")
async def get_messages(conversation_id: int, authorization: Annotated[Optional[str], Header()] = None):
    try:
        user, token = await require_user_and_token(authorization)
        uid = _auth_uid(user)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")

        convo_res = db.table("conversations").select("id, conversation_type").eq("id", conversation_id).eq("user_id", uid).execute()
        if not convo_res.data:
            raise HTTPException(status_code=404, detail="Conversation not found or access denied")

        conv_type = (convo_res.data[0] or {}).get("conversation_type") or "research_report"

        messages_res = db.table("messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=False).execute()
        return {
            "messages": messages_res.data or [],
            "conversation_type": conv_type,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in get_messages: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve messages")


@app.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: int, authorization: Annotated[Optional[str], Header()] = None):
    try:
        user, token = await require_user_and_token(authorization)
        uid = _auth_uid(user)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")

        convo_check = db.table("conversations").select("id, title").eq("id", conversation_id).eq("user_id", uid).execute()
        if not convo_check.data:
            raise HTTPException(status_code=404, detail="Conversation not found or access denied")

        conversation_title = convo_check.data[0]["title"]
        db.table("messages").delete().eq("conversation_id", conversation_id).execute()
        db.table("conversations").delete().eq("id", conversation_id).execute()
        return {"message": f"Research '{conversation_title}' deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in delete_conversation: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete conversation")


# =============================================================================
# OPTIMIZED RESEARCH PIPELINE WITH PARALLEL PROCESSING
# =============================================================================
async def research_pipeline(
    query: str, 
    conversation_summary: Optional[str] = None
) -> Tuple[str, Optional[Dict], List[str], List[Dict]]:
    """
    Optimized research pipeline with parallel processing using asyncio.gather().
    
    Sequential flow optimization:
    1. multi_query_search (must run first)
    2. PARALLEL: extract_facts_from_sources + generate_followups (both need search results)
    3. PARALLEL: generate_report_from_facts + generate_chart_from_facts (both need facts)
    
    Returns: (report_content, chart_data, followup_suggestions, sources)
    """
    try:
        # Step 1: Search (must be first)
        logger.info("Pipeline Step 1: Running multi-query search")
        search_query = query
        if conversation_summary:
            search_query = f"{query} (context: {conversation_summary[:200]})"
        
        sources = await multi_query_search(search_query)
        sources = await evaluate_and_refine_sources(search_query, sources)
        
        if not sources:
            logger.warning("No search results returned for query: %s", query)
            # Return minimal results if no sources found
            return (
                "Unable to generate a comprehensive report due to limited search results. Please try refining your query.",
                None,
                [
                    "What specific aspects of this topic should I focus on?",
                    "Are there alternative keywords or phrases I should search for?",
                    "What particular angle or perspective interests you most?",
                    "Should I search for more recent or historical information?",
                    "What specific outcomes or findings are you looking for?"
                ],
                []
            )
        
        # Step 2: Extract facts and generate followups in parallel
        logger.info("Pipeline Step 2: Extracting facts and generating followups in parallel")
        try:
            facts_result, followup_suggestions = await asyncio.gather(
                extract_facts_from_sources(query, sources),
                generate_followups(query, f"Research on: {query}"),
                return_exceptions=True
            )
            
            # Handle potential exceptions from parallel operations
            if isinstance(facts_result, Exception):
                logger.error("Fact extraction failed: %s", facts_result)
                facts_result = {"facts": []}
            
            if isinstance(followup_suggestions, Exception):
                logger.error("Follow-up generation failed: %s", followup_suggestions)
                followup_suggestions = [
                    "What are the main risks and mitigation strategies?",
                    "How does this compare across different regions or markets?",
                    "What are the implementation challenges and solutions?",
                    "What is the 5-year outlook for this topic?",
                    "What are the policy implications and recommendations?",
                ]
            
            facts = facts_result.get("facts", [])
            logger.info("Extracted %d facts (%d with numbers)", len(facts), sum(1 for f in facts if f.get("has_numbers")))
            
        except Exception as e:
            logger.error("Parallel step 2 failed: %s", e)
            facts = []
            followup_suggestions = [
                "What are the main risks and mitigation strategies?",
                "How does this compare across different regions or markets?",
                "What are the implementation challenges and solutions?",
                "What is the 5-year outlook for this topic?",
                "What are the policy implications and recommendations?",
            ]
        
        # Step 3: Generate report and chart in parallel
        logger.info("Pipeline Step 3: Generating report and chart in parallel")
        try:
            report_content, chart_data = await asyncio.gather(
                generate_report_from_facts(query, facts, sources, conversation_summary),
                generate_chart_from_facts(facts, sources),
                return_exceptions=True
            )
            
            # Handle potential exceptions from parallel operations
            if isinstance(report_content, Exception):
                logger.error("Report generation failed: %s", report_content)
                report_content = "An error occurred while generating the report. Please try again."
            
            if isinstance(chart_data, Exception):
                logger.error("Chart generation failed: %s", chart_data)
                chart_data = None
            
            if chart_data:
                logger.info("Chart generated: %s", chart_data.get("title", "untitled"))
            else:
                logger.info("No quantitative data available — chart skipped")
                
        except Exception as e:
            logger.error("Parallel step 3 failed: %s", e)
            report_content = "An error occurred while generating the report. Please try again."
            chart_data = None
        
        return report_content, chart_data, followup_suggestions, sources
        
    except Exception as e:
        logger.error("Research pipeline failed: %s", e)
        # Return safe fallback values
        return (
            "An error occurred during research processing. Please try again with a different query.",
            None,
            [
                "What specific aspects of this topic should I focus on?",
                "Are there alternative keywords or phrases I should search for?",
                "What particular angle or perspective interests you most?",
                "Should I search for more recent or historical information?",
                "What specific outcomes or findings are you looking for?"
            ],
            []
        )


# =============================================================================
# MAIN RESEARCH ENDPOINT — OPTIMIZED WITH PARALLEL PROCESSING
# =============================================================================
@app.get("/usage")
async def get_usage(authorization: Annotated[Optional[str], Header()] = None):
    """Returns report quota usage (completed threads with an assistant reply). Non-admins can hit ``reports_quota_locked``."""
    try:
        user, token = await require_user_and_token(authorization)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")
        uid = _auth_uid(user)
        sources_cited_total = _total_sources_cited(uid, db)
        if _user_is_admin(uid, db):
            lifetime_reports = _lifetime_completed_report_threads(uid, db)
            quota_locked_flag = _get_reports_quota_locked(uid, db)
            return {
                "reports_used": lifetime_reports,
                "reports_limit": None,
                "reports_remaining": None,
                "is_admin": True,
                "reports_quota_locked": quota_locked_flag,
                "sources_cited_total": sources_cited_total,
            }
        quota_locked, reports_used, _ = _evaluate_reports_quota(uid, db)
        remaining = (
            0
            if quota_locked
            else max(0, MONTHLY_REPORT_LIMIT - reports_used)
        )
        return {
            "reports_used": reports_used,
            "reports_limit": MONTHLY_REPORT_LIMIT,
            "reports_remaining": remaining,
            "is_admin": False,
            "reports_quota_locked": quota_locked,
            "sources_cited_total": sources_cited_total,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in get_usage: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve usage")


@app.post("/telemetry/export", include_in_schema=False)
@limiter.limit("120/hour")
async def telemetry_export(
    request: Request,
    body: ExportTelemetryRequest,
    authorization: Annotated[Optional[str], Header()] = None,
):
    """Write-only: logs export_triggered (no usage_events rows are returned)."""
    allowed = {"pdf", "docx", "markdown", "json"}
    fmt = (body.format or "").strip().lower()
    if fmt not in allowed:
        raise HTTPException(status_code=400, detail="Invalid format")

    user = await require_authenticated_user(authorization)

    _insert_usage_event(
        str(user.id),
        "export_triggered",
        {"format": fmt, "report_word_count": body.report_word_count},
    )
    return Response(status_code=204)


@app.post("/research")
@limiter.limit("20/hour")
async def run_research(request: Request, body: ResearchRequest, authorization: Annotated[Optional[str], Header()] = None):
    """
    4-step pipeline:
    1. Multi-query search with source scoring
    2. Fact extraction (grounded, source-attributed)
    3. Report generation (facts only, no hallucination)
    4. Chart generation (real numbers only or None)
    + Follow-up question generation
    """
    start = time.time()
    try:
        user, token = await require_user_and_token(authorization)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")

        uid = _auth_uid(user)
        
        # Only check quota for NEW conversations, allow follow-ups on existing conversations
        if body.conversation_id is None:  # New conversation
            quota_locked, lifetime_reports, _ = _evaluate_reports_quota(uid, db)
            if quota_locked:
                from datetime import date

                if lifetime_reports >= MONTHLY_REPORT_LIMIT:
                    _insert_usage_event(
                        uid,
                        "limit_reached",
                        {
                            "reports_used": lifetime_reports,
                            "day_of_month": date.today().day,
                            "reports_quota_locked": True,
                        },
                    )
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "You've reached the 5 report limit for our beta. "
                        "Deleting saved research does not restore new runs."
                    ),
                )

        convo_id = body.conversation_id
        history = []
        conversation_summary = None

        if not convo_id:
            title = await generate_title(body.prompt)
            conversation_data = {
                "user_id": uid,
                "title": title,
                "conversation_type": "research_report",
            }
            if body.folder_id:
                conversation_data["folder_id"] = body.folder_id
            convo_res = db.table("conversations").insert(conversation_data).execute()
            convo_id = convo_res.data[0]["id"]
        else:
            convo_res = db.table("conversations").select("id").eq("id", convo_id).eq("user_id", uid).execute()
            if not convo_res.data:
                raise HTTPException(status_code=404, detail="Conversation not found or access denied")
            messages_res = db.table("messages").select("role, content").eq("conversation_id", convo_id).order("created_at").execute()
            history = messages_res.data or []
            if history:
                conversation_summary = await summarize_conversation(history)

        had_conversation_history = len(history) > 0

        # Save user message
        db.table("messages").insert({
            "conversation_id": convo_id, "role": "user", "content": body.prompt
        }).execute()

        # Track assignment brief detection (500+ words likely indicates assignment paste)
        word_count = len(body.prompt.split())
        assignment_threshold = 500  # Configurable threshold for assignment detection
        logger.info("Processing request with %d words (threshold: %d), force_process=%s", 
                   word_count, assignment_threshold, body.force_process)
        if word_count >= assignment_threshold and not body.force_process:
            try:
                _insert_usage_event(
                    uid,
                    "assignment_brief_detected",
                    {
                        "word_count": word_count,
                        "endpoint": "research"
                    }
                )
                
                # Return helpful guidance instead of processing the assignment directly
                logger.info("Assignment brief detected (%d words), providing guidance", word_count)
                
                # Extract research questions with fallback
                try:
                    suggested_questions = await extract_research_questions(body.prompt)
                except Exception as e:
                    logger.error("Failed to extract research questions: %s", e)
                    suggested_questions = [
                        "What are the main factors contributing to this topic?",
                        "What does current research say about this issue?",
                        "What are the practical implications and recommendations?"
                    ]
                
                # Ensure we have at least some questions
                if not suggested_questions:
                    suggested_questions = [
                        "What are the main factors contributing to this topic?",
                        "What does current research say about this issue?",
                        "What are the practical implications and recommendations?"
                    ]
                
                guidance_message = {
                    "message": "This looks like an assignment brief! DeepResearch works best with focused research questions rather than full assignment instructions.",
                    "explanation": "To get the most helpful results, try asking specific questions about parts of your assignment. This approach will give you more targeted research that you can use to build your complete response.",
                    "suggested_questions": suggested_questions,
                    "can_proceed": True,
                    "note": "You can still search with your original text if you prefer, but focused questions usually work better."
                }
                
                # Save the guidance as an assistant message
                guidance_content = f"""**Assignment Brief Detected**

{guidance_message['message']} {guidance_message['explanation']}

**Here are some focused questions I extracted from your assignment:**

{chr(10).join(f"• {q}" for q in suggested_questions)}

**Tip:** {guidance_message['note']}

*If you'd like to proceed with your original text anyway, just send it again and I'll research it as-is.*"""

                guidance_metadata = {
                    "assignment_guidance": True,
                    "suggested_questions": suggested_questions,
                    "original_word_count": word_count
                }
                
                message_to_save = {
                    "conversation_id": convo_id,
                    "role": "assistant", 
                    "model_name": "DeepResearch Guidance",
                    "content": guidance_content,
                    "metadata": guidance_metadata,
                }
                
                try:
                    message_res = db.table("messages").insert(message_to_save).execute()
                    logger.info("Successfully saved assignment brief guidance message")
                    return {
                        "conversation_id": convo_id,
                        "new_messages": message_res.data,
                        "conversation_type": "research_report",
                    }
                except Exception as e:
                    logger.error("Failed to save assignment brief guidance message: %s", e)
                    # Fall through to normal processing if we can't save the guidance message
                    
            except Exception as e:
                logger.error("Assignment brief detection failed: %s", e)
                # Fall through to normal processing if detection fails

        # Track forced processing of assignment briefs
        if word_count >= assignment_threshold and body.force_process:
            _insert_usage_event(
                uid,
                "assignment_brief_forced",
                {
                    "word_count": word_count,
                    "endpoint": "research"
                }
            )

        if body.conversation_id:
            _insert_usage_event(
                uid,
                "followup_used",
                {
                    "turn_number": len(history) + 1,
                    "query_length": len(body.prompt),
                },
            )

        # --- OPTIMIZED PIPELINE: Run research with parallel processing ---
        logger.info("Running optimized research pipeline for: %s", body.prompt)
        report_content, chart_data, followup_suggestions, sources = await research_pipeline(
            body.prompt, 
            conversation_summary
        )

        # Build metadata
        metadata_json = {}
        if chart_data:
            metadata_json["graph_data"] = chart_data
        metadata_json["report_type"] = "research_report"
        metadata_json["followup_suggestions"] = followup_suggestions
        metadata_json["sources_used"] = len(sources)
        # Note: facts count not available in optimized pipeline for performance
        metadata_json["facts_extracted"] = len(sources)  # Use sources as proxy

        # Save assistant message
        message_to_save = {
            "conversation_id": convo_id,
            "role": "assistant",
            "model_name": "DeepResearch Report",
            "content": report_content,
            "metadata": metadata_json,
        }
        message_res = db.table("messages").insert(message_to_save).execute()

        locked, lifetime, just_reached = _evaluate_reports_quota(uid, db)

        response_time_ms = (time.time() - start) * 1000
        _insert_usage_event(
            uid,
            "research_completed",
            {
                "query_length": len(body.prompt),
                "sources_found": len(sources),
                "facts_extracted": len(sources),  # Use sources as proxy for optimized pipeline
                "chart_generated": bool(chart_data),
                "has_conversation_history": had_conversation_history,
                "response_time_ms": round(response_time_ms, 2),
                "word_count": len((report_content or "").split()),
                "optimized_pipeline": True,  # Flag to indicate this used the optimized pipeline
            },
        )

        # Return info about reaching the limit for frontend to show popup
        return {
            "conversation_id": convo_id, 
            "new_messages": message_res.data,
            "quota_just_reached": just_reached,
            "conversation_type": "research_report",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in run_research: %s", e)
        raise HTTPException(status_code=500, detail="Failed to run research")


# =============================================================================
# BETA REVIEW ENDPOINT
# =============================================================================
@app.post("/beta-review")
@limiter.limit("5/hour")
async def submit_beta_review(request: Request, body: BetaReviewRequest, authorization: Annotated[Optional[str], Header()] = None):
    """Submit a beta review from users who have reached the quota limit."""
    try:
        user, token = await require_user_and_token(authorization)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")
        
        uid = _auth_uid(user)
        
        # Verify user has reached quota limit
        quota_locked, lifetime_reports, _ = _evaluate_reports_quota(uid, db)
        if not quota_locked:
            raise HTTPException(status_code=400, detail="Beta review only available for users who have reached the report limit.")
        
        # Check if user has already submitted a review
        existing_review = db.table("beta_reviews").select("id").eq("user_id", uid).execute()
        if existing_review.data:
            raise HTTPException(status_code=400, detail="You have already submitted a beta review.")
        
        # Get user's first name from profiles table
        profile_result = db.table("profiles").select("first_name").eq("id", uid).execute()
        first_name = None
        if profile_result.data and len(profile_result.data) > 0:
            first_name = profile_result.data[0].get("first_name")

        # Insert the review
        review_data = {
            "user_id": uid,
            "review": body.review,
            "rating": body.rating,
            "lifetime_reports": lifetime_reports,
            "first_name": first_name
        }
        
        result = db.table("beta_reviews").insert(review_data).execute()
        
        # Track the review submission
        _insert_usage_event(
            uid,
            "beta_review_submitted",
            {
                "review_length": len(body.review),
                "rating": body.rating,
                "lifetime_reports": lifetime_reports,
            }
        )
        
        return {"message": "Thank you for your feedback! Your review has been submitted successfully."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in submit_beta_review: %s", e)
        raise HTTPException(status_code=500, detail="Failed to submit review")


# =============================================================================
# ARTICLE COMPARISON ENDPOINT
# =============================================================================
@app.post("/compare-articles")
@limiter.limit("10/hour")
async def compare_articles(request: Request, body: ArticleComparisonRequest, authorization: Annotated[Optional[str], Header()] = None):
    try:
        user, token = await require_user_and_token(authorization)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")

        uid = _auth_uid(user)

        if not _user_is_admin(uid, db):
            raise HTTPException(
                status_code=403,
                detail="Compare Articles is only available to admin users.",
            )

        if not ((body.article1_url or body.article1_text) and (body.article2_url or body.article2_text)):
            raise HTTPException(status_code=400, detail="Both articles must be provided (either URL or text)")

        article1 = await extract_article_content(body.article1_url) if body.article1_url else {
            "title": body.article1_title or "Article 1",
            "content": body.article1_text or "",
            "url": "",
        }
        article2 = await extract_article_content(body.article2_url) if body.article2_url else {
            "title": body.article2_title or "Article 2",
            "content": body.article2_text or "",
            "url": "",
        }

        comparison_report = await generate_article_comparison_report(
            article1, article2, body.comparison_focus or "overall", body.context
        )

        title = f"Comparison: {article1.get('title', 'Article 1')[:40]} vs {article2.get('title', 'Article 2')[:40]}"
        conversation_data = {
            "user_id": uid,
            "title": title,
            "conversation_type": "article_comparison",
        }
        if body.folder_id:
            conversation_data["folder_id"] = body.folder_id

        convo_res = db.table("conversations").insert(conversation_data).execute()
        convo_id = convo_res.data[0]["id"]

        user_message_content = f"Compare articles:\n\n**Article 1:** {article1.get('title', 'Article 1')}"
        if article1.get("url"):
            user_message_content += f"\nURL: {article1['url']}"
        user_message_content += f"\n\n**Article 2:** {article2.get('title', 'Article 2')}"
        if article2.get("url"):
            user_message_content += f"\nURL: {article2['url']}"
        if body.comparison_focus:
            user_message_content += f"\n\n**Focus:** {body.comparison_focus}"
        if body.context:
            user_message_content += f"\n**Context:** {body.context}"

        db.table("messages").insert({
            "conversation_id": convo_id, "role": "user", "content": user_message_content
        }).execute()

        # Track assignment brief detection for comparison inputs (500+ words likely indicates assignment paste)
        # Check context field
        if body.context:
            context_word_count = len(body.context.split())
            if context_word_count >= 500:
                _insert_usage_event(
                    uid,
                    "assignment_brief_detected",
                    {
                        "prompt_length": len(body.context),
                        "word_count": context_word_count,
                        "endpoint": "compare_articles",
                        "field": "context"
                    }
                )
        
        # Check article text fields (students might paste long assignment texts)
        for i, article_text in enumerate([body.article1_text, body.article2_text], 1):
            if article_text:
                article_word_count = len(article_text.split())
                if article_word_count >= 500:
                    _insert_usage_event(
                        uid,
                        "assignment_brief_detected",
                        {
                            "prompt_length": len(article_text),
                            "word_count": article_word_count,
                            "endpoint": "compare_articles",
                            "field": f"article{i}_text"
                        }
                    )

        report_content = comparison_report
        metadata_json = {}

        if "```json" in comparison_report:
            try:
                json_str = comparison_report.split("```json")[1].split("```")[0].strip()
                metadata_json = json.loads(json_str)
                report_content = comparison_report.split("```json")[0].strip()
            except (json.JSONDecodeError, IndexError) as e:
                logger.warning("Error parsing comparison metadata JSON: %s", e)
                metadata_json = {}

        metadata_json["comparison_type"] = "article_comparison"
        metadata_json["article1_title"] = article1.get("title", "Article 1")
        metadata_json["article2_title"] = article2.get("title", "Article 2")
        metadata_json["comparison_focus"] = body.comparison_focus or "overall"
        metadata_json["context"] = body.context
        metadata_json["sources_used"] = 2

        graph_data = metadata_json.get("graph_data", {})
        comparison_summary = graph_data.get("comparison_summary", {})

        metadata_json["themes_identified"] = graph_data.get("themes_identified", [])
        metadata_json["key_conflicts"] = comparison_summary.get("conflicting_areas", [])
        metadata_json["content_extracted_successfully"] = {
            "article1": len((article1.get("content") or "").strip()) > 200,
            "article2": len((article2.get("content") or "").strip()) > 200,
        }

        message_to_save = {
            "conversation_id": convo_id,
            "role": "assistant",
            "model_name": "Article Comparison Report",
            "content": report_content,
            "metadata": metadata_json,
        }
        message_res = db.table("messages").insert(message_to_save).execute()

        return {
            "conversation_id": convo_id,
            "new_messages": message_res.data,
            "conversation_type": "article_comparison",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in compare_articles: %s", e)
        raise HTTPException(status_code=500, detail="Failed to compare articles")


# =============================================================================
# COMPARISON FOLLOW-UP HELPERS
# =============================================================================
_COMPARISON_THEME_HEADER_RE = re.compile(r"^#{2,4}\s*(?:Theme[:\s]+)?(.+?)\s*$", re.MULTILINE)

# Document-scaffold headers we don't want to treat as themes.
_COMPARISON_SCAFFOLD_HEADERS = {
    "thematic analysis",
    "overlapping themes",
    "overlapping themes (both articles address these)",
    "themes unique to article 1",
    "themes unique to article 2",
    "methodological notes",
    "quick reference",
    "research gaps",
    "how to use this report",
    "quick comparative overview",
    "how to use these sources in your paper",
    "at-a-glance scores",
    "synthesis",
    "rules",
    "output format",
}


def _extract_themes_from_comparison(content: str, limit: int = 6) -> List[str]:
    """Pull theme/section headers out of the comparison markdown body."""
    themes: List[str] = []
    seen = set()
    for m in _COMPARISON_THEME_HEADER_RE.finditer(content or ""):
        title = (m.group(1) or "").strip(" #*[]")
        # Strip trailing "(Article 1 only)" / "(Article 2 only)" labels
        title = re.sub(r"\s*\((article\s*\d+)?\s*only\)\s*$", "", title, flags=re.IGNORECASE).strip()
        if not title:
            continue
        key = title.lower()
        if key in _COMPARISON_SCAFFOLD_HEADERS or key in seen:
            continue
        seen.add(key)
        themes.append(title)
        if len(themes) >= limit:
            break
    return themes


# Comparison follow-ups 1–3 include clickable suggestion chips; from the 4th onward we omit them.
_COMPARISON_FOLLOWUP_SUGGESTION_LIMIT = 3


def _generate_comparison_followup_suggestions(user_message: str, themes: List[str]) -> List[str]:
    """Heuristic 2-3 follow-up suggestions tailored to the student's question."""
    msg = (user_message or "").lower()
    if themes and "difference" in msg:
        return [
            f"Tell me more about the {themes[0]} theme",
            "Which article should I cite for the strongest argument?",
            "What's missing from both articles?",
        ]
    for theme in themes:
        if theme.lower() in msg:
            return [
                "What are the key differences between the articles?",
                f"Which article is stronger on {theme}?",
                "How should I synthesize both sources on this point?",
            ]
    return [
        "What are the main disagreements between these articles?",
        "Which source is better for my argument?",
        "What additional sources would I need?",
    ]


@app.post("/comparison-followup")
@limiter.limit("30/hour")
async def comparison_followup(
    request: Request,
    body: ComparisonFollowupRequest,
    authorization: Annotated[Optional[str], Header()] = None,
):
    """
    Answer a follow-up question about a previously generated article comparison.

    Uses only the existing comparison content as context (no web search), so the
    research pipeline is not triggered on comparison follow-ups.
    """
    try:
        user, token = await require_user_and_token(authorization)
        db = _db_for_access_token(token)
        if not db:
            raise HTTPException(status_code=503, detail="Database client not configured.")

        uid = _auth_uid(user)

        convo_res = (
            db.table("conversations")
            .select("id, conversation_type")
            .eq("id", body.conversation_id)
            .eq("user_id", uid)
            .execute()
        )
        if not convo_res.data:
            raise HTTPException(status_code=404, detail="Conversation not found or access denied")

        conv_type = (convo_res.data[0] or {}).get("conversation_type") or "research_report"
        if conv_type != "article_comparison":
            raise HTTPException(
                status_code=400,
                detail="Conversation is not an article comparison.",
            )

        msgs_res = (
            db.table("messages")
            .select("content, metadata")
            .eq("conversation_id", body.conversation_id)
            .eq("role", "assistant")
            .order("created_at")
            .execute()
        )
        comparison_msg = next(
            (
                m for m in (msgs_res.data or [])
                if (m.get("metadata") or {}).get("comparison_type") == "article_comparison"
            ),
            None,
        )
        if not comparison_msg:
            raise HTTPException(
                status_code=404,
                detail="Original comparison report not found for this conversation.",
            )

        comp_metadata = comparison_msg.get("metadata") or {}
        article1_title = comp_metadata.get("article1_title") or "Article 1"
        article2_title = comp_metadata.get("article2_title") or "Article 2"
        comparison_content = comparison_msg.get("content") or ""

        system_prompt = (
            "You help students reason about a previously generated article comparison. "
            "Use ONLY the comparison content provided; do not search for or invent new "
            "information. Stay conversational, concise, and practical. Always end your "
            "answer with a short helpful offer that invites the student to dig deeper."
        )
        user_prompt = f"""You previously compared two articles for a student:

**Article 1:** {article1_title}
**Article 2:** {article2_title}

**Full comparison analysis:**
{comparison_content}

---

**Student's follow-up question:** "{body.message}"

**HOW TO RESPOND:**

1. **Format**: Conversational, not a formal report
   - Use bullet points and short bold headers when useful
   - Keep it concise (2-4 paragraphs max for simple questions; 3-5 bullets is great for direct asks)
   - Do NOT create numbered top-level sections like "1." or "Section 1"

2. **Answer from the comparison data**:
   - Reference specific themes or sections from the comparison
   - Quote relevant passages from either article when helpful
   - Be specific: "In the overlapping theme on X..." or "Article 1 says..."

3. **If the comparison DOES cover this topic**:
   - Answer directly and concisely
   - Pull out the key points
   - End with: "Want me to explain any of these points in more detail?"

4. **If the comparison DOESN'T cover this topic well**:
   - DO NOT just say "these sources won't help" or "they won't support your paper"
   - DO say what they CAN contribute (even if limited)
   - DO identify what's missing
   - DO suggest how to fill the gap (search terms, types of sources to look for)
   - End with: "Want help finding sources to fill this gap?"

5. **Always end with a helpful offer**, e.g.:
   - "Want me to elaborate on [X]?"
   - "Should I unpack the [theme] in more detail?"
   - "Would you like suggestions for additional sources on this?"

**EXAMPLE - Good response to "What about privacy?"**:

Neither article makes privacy its main focus, but here's what you can use:

**What Article 1 Provides:**
- Brief mention: "AI technologies enable surveillance and data collection"
- Identifies privacy as a recognized concern category
- BUT: No specific examples, no technical depth

**What Article 2 Provides:**
- Doesn't directly address surveillance
- However, the discussion of algorithmic influence (recommendation systems tracking behavior) relates to data collection
- The point about unregulated AI applies to privacy too

**What's Missing:**
You'd need sources specifically on:
- Facial recognition and surveillance systems
- Data privacy laws (GDPR, CCPA) vs. AI capabilities
- Corporate data collection practices

**How to Fill the Gap:**
Search Google Scholar for: "AI surveillance privacy" or "facial recognition privacy concerns".
Look for sources from: Electronic Frontier Foundation, AI Now Institute, or legal journals.

Want help finding those sources, or should I explain how Article 1's brief privacy mention connects to your argument?

---

Now answer the student's question: "{body.message}"
"""

        try:
            answer = call_claude(
                system_prompt,
                user_prompt,
                max_tokens=1500,
                temperature=0.5,
            )
        except Exception as e:
            logger.error("Comparison follow-up Claude call failed: %s", e)
            raise HTTPException(status_code=502, detail="Failed to generate follow-up answer")

        existing_followup_count = sum(
            1
            for m in (msgs_res.data or [])
            if (m.get("metadata") or {}).get("message_type") == "comparison_followup"
        )
        themes = _extract_themes_from_comparison(comparison_content)
        if existing_followup_count >= _COMPARISON_FOLLOWUP_SUGGESTION_LIMIT:
            suggested_questions = []
        else:
            suggested_questions = _generate_comparison_followup_suggestions(
                body.message, themes
            )

        db.table("messages").insert({
            "conversation_id": body.conversation_id,
            "role": "user",
            "content": body.message,
        }).execute()

        assistant_msg = {
            "conversation_id": body.conversation_id,
            "role": "assistant",
            "model_name": "Article Comparison Follow-up",
            "content": answer,
            "metadata": {
                "message_type": "comparison_followup",
                "followup_type": "comparison",  # kept for backward compatibility
                "sources_used": 0,
                "referenced_comparison": True,
                "article1_title": article1_title,
                "article2_title": article2_title,
                "followup_suggestions": suggested_questions,
            },
        }
        message_res = db.table("messages").insert(assistant_msg).execute()

        _insert_usage_event(
            uid,
            "comparison_followup_used",
            {
                "conversation_id": body.conversation_id,
                "query_length": len(body.message),
            },
        )

        return {
            "conversation_id": body.conversation_id,
            "new_messages": message_res.data,
            "conversation_type": "article_comparison",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in comparison_followup: %s", e)
        raise HTTPException(status_code=500, detail="Failed to process comparison follow-up")


@app.post("/citation-metadata")
@limiter.limit("40/hour")
async def citation_metadata_endpoint(
    request: Request,
    body: CitationMetadataRequest,
    authorization: Annotated[Optional[str], Header()] = None,
):
    """Fetch public URLs server-side and extract title, author, and year for citations."""
    await require_authenticated_user(authorization)

    seen = set()
    urls: List[str] = []
    for raw in body.urls:
        u = (raw or "").strip()
        if not u or u in seen:
            continue
        if len(u) > 4000:
            raise HTTPException(status_code=400, detail="URL too long")
        seen.add(u)
        urls.append(u)

    if not urls:
        raise HTTPException(status_code=400, detail="No valid URLs provided")

    timeout = httpx.Timeout(14.0, connect=6.0)
    sem = asyncio.Semaphore(5)

    async def one(client: httpx.AsyncClient, url: str) -> Dict[str, Optional[object]]:
        async with sem:
            return await _fetch_citation_metadata_for_url(client, url)

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            headers={"User-Agent": _CITATION_USER_AGENT},
            follow_redirects=True,
        ) as client:
            results = await asyncio.gather(*(one(client, u) for u in urls))
    except Exception as e:
        logger.error("citation_metadata_endpoint: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch citation metadata")

    return {"results": list(results)}