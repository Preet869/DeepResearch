import os
import asyncio
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List, Dict
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from dotenv import load_dotenv
from supabase import create_client, Client
from tavily import TavilyClient

# Load environment variables
load_dotenv()

# --- Initialize Clients ---
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

app = FastAPI()

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# --- Pydantic Models ---
class ResearchRequest(BaseModel):
    prompt: str
    conversation_id: Optional[int] = None

# --- Helper Functions ---
async def generate_title(prompt: str):
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Generate a short, concise title (4-5 words) for the following user prompt."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=20
        )
        return response.choices[0].message.content.strip().strip('"')
    except Exception:
        return "New Research"

async def get_search_context(query: str):
    """Gets context from Tavily search."""
    try:
        # For this demo, we'll use a basic search.
        # For a more advanced use case, you could use `tavily_client.search`.
        response = tavily_client.get_search_context(query=query, search_depth="advanced")
        return response
    except Exception as e:
        print(f"Error getting search context: {e}")
        return f"Error getting search context: {e}"

async def generate_deep_research_report(prompt: str, context: str):
    """Generates a comprehensive report using OpenAI's GPT-4o and Tavily context."""
    report_prompt = f"""
You are an expert research analyst. Your goal is to provide a deep, comprehensive, and well-structured report based on the user's query and the provided web search context. The report should be so thorough that the user won't need to consult other sources like Google, YouTube, or Reddit.

**User's Query:** "{prompt}"

**Web Search Context:**
---
{context}
---

**Instructions:**
1.  **Synthesize, Don't Just Summarize:** Do not just list the information from the context. Weave the key points into a coherent, well-structured narrative.
2.  **Structure the Report:** Use markdown for clear headings, subheadings, bullet points, and bold text to organize the information logically. Start with a brief overview, then dive into detailed sections.
3.  **Go Beyond the Obvious:** Analyze the information, identify underlying themes, and provide insights. If there are conflicting viewpoints in the context, present them.
4.  **Maintain a Professional Tone:** Write in a clear, objective, and analytical style.

**Final Report:**
"""
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": report_prompt}],
            max_tokens=4000,
            temperature=0.4,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error generating report: {e}")
        return f"Error from OpenAI while generating report: {e}"

# --- API Endpoints ---
@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/conversations")
async def get_conversations(authorization: str = Header(...)):
    """Fetches all conversations for the logged-in user."""
    try:
        access_token = authorization.split(" ")[1]
        user_response = supabase.auth.get_user(access_token)
        user = user_response.user
        if not user: raise HTTPException(status_code=401, detail="Invalid token")
        query = supabase.table("conversations").select("id, title, created_at").eq("user_id", user.id).order("created_at", desc=True)
        response = query.execute()
        return response.data
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/messages/{conversation_id}")
async def get_messages(conversation_id: int, authorization: str = Header(...)):
    """Fetches all messages for a given conversation."""
    try:
        access_token = authorization.split(" ")[1]
        user_response = supabase.auth.get_user(access_token)
        user = user_response.user
        if not user: raise HTTPException(status_code=401, detail="Invalid token")
        convo_res = supabase.table("conversations").select("id").eq("id", conversation_id).eq("user_id", user.id).execute()
        if not convo_res.data: raise HTTPException(status_code=404, detail="Conversation not found or access denied")
        messages_res = supabase.table("messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=False).execute()
        return messages_res.data
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/research")
async def run_research(request: ResearchRequest, authorization: str = Header(...)):
    try:
        access_token = authorization.split(" ")[1]
        user_response = supabase.auth.get_user(access_token)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        convo_id = request.conversation_id

        if not convo_id:
            title = await generate_title(request.prompt)
            convo_res = supabase.table("conversations").insert({"user_id": user.id, "title": title}).execute()
            convo_id = convo_res.data[0]['id']
        else:
            convo_res = supabase.table("conversations").select("id").eq("id", convo_id).eq("user_id", user.id).execute()
            if not convo_res.data:
                raise HTTPException(status_code=404, detail="Conversation not found or access denied")

        # Save user message first
        supabase.table("messages").insert({
            "conversation_id": convo_id,
            "role": "user",
            "content": request.prompt
        }).execute()

        # Perform deep research
        search_context = await get_search_context(request.prompt)
        report = await generate_deep_research_report(request.prompt, search_context)

        # Save the final report
        message_res = supabase.table("messages").insert({
            "conversation_id": convo_id,
            "role": "assistant",
            "model_name": "DeepResearch Report",
            "content": report
        }).execute()

        return {"conversation_id": convo_id, "new_messages": message_res.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
