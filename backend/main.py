import os
import asyncio
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List, Dict
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
import google.generativeai as genai
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# --- Initialize Clients ---
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
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

# --- UPDATED AI Service Functions ---
async def query_openai(history: List[Dict[str, str]]):
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-3.5-turbo", messages=history, max_tokens=1500
        )
        return response.choices[0].message.content
    except Exception as e: return f"Error from OpenAI: {e}"

async def query_claude(history: List[Dict[str, str]]):
    system_prompt = "You are an expert research assistant."
    user_messages = [msg for msg in history if msg['role'] != 'system']
    try:
        response = await anthropic_client.messages.create(
            model="claude-3-haiku-20240307", max_tokens=1500, messages=user_messages, system=system_prompt
        )
        return response.content[0].text
    except Exception as e: return f"Error from Anthropic: {e}"

def sync_query_gemini(history: List[Dict[str, str]]):
    gemini_history = [{'role': 'user' if msg['role'] == 'user' else 'model', 'parts': [msg['content']]} for msg in history[:-1]]
    last_prompt = history[-1]['content']
    try:
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(last_prompt)
        return response.text
    except Exception as e: return f"Error from Gemini: {e}"

async def query_gemini(history: List[Dict[str, str]]):
    return await asyncio.to_thread(sync_query_gemini, history)

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
        if not user: raise HTTPException(status_code=401, detail="Invalid token")

        history = []
        convo_id = request.conversation_id

        if convo_id:
            convo_res = supabase.table("conversations").select("id").eq("id", convo_id).eq("user_id", user.id).execute()
            if not convo_res.data:
                raise HTTPException(status_code=404, detail="Conversation not found or access denied")

            messages_res = supabase.table("messages").select("role, content").eq("conversation_id", convo_id).order("created_at").execute()
            for msg in messages_res.data:
                history.append({"role": msg["role"], "content": msg["content"]})
        
        history.append({"role": "user", "content": request.prompt})
        
        if not convo_id:
            title = await generate_title(request.prompt)
            convo_res = supabase.table("conversations").insert({"user_id": user.id, "title": title}).execute()
            convo_id = convo_res.data[0]['id']

        ai_tasks = [query_openai(history), query_claude(history), query_gemini(history)]
        openai_res, claude_res, gemini_res = await asyncio.gather(*ai_tasks)

        messages_to_save = [
            {"conversation_id": convo_id, "role": "user", "content": request.prompt},
            {"conversation_id": convo_id, "role": "assistant", "model_name": "OpenAI", "content": openai_res},
            {"conversation_id": convo_id, "role": "assistant", "model_name": "Claude", "content": claude_res},
            {"conversation_id": convo_id, "role": "assistant", "model_name": "Gemini", "content": gemini_res}
        ]
        
        message_res = supabase.table("messages").insert(messages_to_save).execute()

        return {"conversation_id": convo_id, "new_messages": message_res.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
