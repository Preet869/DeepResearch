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
def call_claude(system_prompt: str, user_content: str, max_tokens: int = 2000) -> str:
    """Synchronous Claude API call. Returns text content."""
    if not claude_client:
        raise RuntimeError("Claude client not initialized. Check ANTHROPIC_API_KEY.")
    message = claude_client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": user_content}],
        system=system_prompt,
    )
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
async def extract_article_content(url: str) -> Dict[str, str]:
    """Extracts article content from a URL using Tavily extract, with search fallback."""
    if not tavily_client:
        logger.warning("Article extraction skipped for %s: Tavily not configured", url)
        return {"title": "", "content": "", "url": url}
    try:
        response = tavily_client.extract(urls=[url])
        if response and response.get("results"):
            result = response["results"][0]
            return {
                "title": result.get("title", ""),
                "content": (
                    result.get("raw_content", result.get("content", ""))[:6000]
                ),
                "url": url,
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
            return {
                "title": result.get("title", ""),
                "content": result.get("content", "")[:6000],
                "url": result.get("url", url),
            }
    except Exception as e:
        logger.error("Article extraction failed for %s: %s", url, e)

    return {"title": "", "content": "", "url": url}


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
async def generate_article_comparison_report(
    article1: Dict, article2: Dict, focus: str = "overall", context: Optional[str] = None
) -> str:
    """Generates a structured comparison report between two articles."""
    focus_instructions = {
        "methodology": "Focus primarily on comparing research methods, data collection, and analytical frameworks.",
        "findings": "Focus on comparing key findings, results, and evidence presented in both articles.",
        "overall": "Provide a comprehensive comparison covering methodology, findings, writing style, and implications.",
    }
    focus_instruction = focus_instructions.get(focus, focus_instructions["overall"])
    context_section = f"\nUser context: {context}\nTailor your analysis to be relevant to this context." if context else ""

    system = f"""You are an academic writing assistant helping students compare research articles.
{focus_instruction}{context_section}

Be practical and student-focused. Every assessment must be grounded in the actual article content provided.

Important: When generating numerical scores for the chart, add a note that these are AI-assessed scores based on the provided content excerpts, not computed metrics. Be conservative — avoid scores above 8 unless evidence clearly justifies it."""

    user = f"""Compare these two articles:

ARTICLE 1: {article1.get('title', 'Article 1')}
{article1.get('content', '')[:6000]}

ARTICLE 2: {article2.get('title', 'Article 2')}
{article2.get('content', '')[:6000]}

Write a structured comparison report with:
1. Executive Summary (4-5 bullet points)
2. Comparative Overview (table: thesis, methodology, main finding, evidence quality)
3. Detailed Analysis (methodology, evidence quality, practical implications, scholarly rigor)
4. Synthesis (complementary insights, conflicting areas)
5. Final Recommendation (which to cite for what purpose, citation strategy)

End with this JSON block:
```json
{{
  "graph_data": {{
    "title": "Article Comparison: {article1.get('title', 'Article 1')[:30]} vs {article2.get('title', 'Article 2')[:30]}",
    "type": "bar",
    "data": [
      {{"name": "Methodology Rigor", "value": <score_1_1-10>, "value2": <score_2_1-10>}},
      {{"name": "Evidence Quality", "value": <score_1_1-10>, "value2": <score_2_1-10>}},
      {{"name": "Practical Relevance", "value": <score_1_1-10>, "value2": <score_2_1-10>}},
      {{"name": "Scholarly Rigor", "value": <score_1_1-10>, "value2": <score_2_1-10>}}
    ],
    "x_label": "Evaluation Criteria",
    "y_label": "Score (1-10)",
    "description": "Comparative scoring of both articles across key academic criteria",
    "key_insight": "One sentence about which article is stronger and for what purpose",
    "why_matters": "Why this comparison helps the student",
    "insight_type": "primary",
    "ai_insights": ["Methodological insight", "Evidence insight", "Practical recommendation"],
    "comparison_summary": {{
      "similarity_score": <0-100>,
      "key_differences": ["difference 1", "difference 2", "difference 3"],
      "complementary_areas": ["area 1", "area 2"],
      "conflicting_areas": ["area 1", "area 2"],
      "student_recommendation": "Which article to prioritize and why",
      "citation_strategy": "How to use both articles effectively"
    }}
  }}
}}
```"""

    try:
        return call_claude(system, user, max_tokens=5000)
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

        query = db.table("conversations").select("id, title, created_at, folder_id").eq("user_id", uid)
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

        convo_res = db.table("conversations").select("id").eq("id", conversation_id).eq("user_id", uid).execute()
        if not convo_res.data:
            raise HTTPException(status_code=404, detail="Conversation not found or access denied")

        messages_res = db.table("messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=False).execute()
        return messages_res.data or []
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
            conversation_data = {"user_id": uid, "title": title}
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
                    return {"conversation_id": convo_id, "new_messages": message_res.data}
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
            "quota_just_reached": just_reached
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
        conversation_data = {"user_id": uid, "title": title}
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

        message_to_save = {
            "conversation_id": convo_id,
            "role": "assistant",
            "model_name": "Article Comparison Report",
            "content": report_content,
            "metadata": metadata_json,
        }
        message_res = db.table("messages").insert(message_to_save).execute()

        return {"conversation_id": convo_id, "new_messages": message_res.data}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in compare_articles: %s", e)
        raise HTTPException(status_code=500, detail="Failed to compare articles")


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