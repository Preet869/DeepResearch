import os
import asyncio
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Initialize API Clients ---
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

app = FastAPI()

# --- CORS Middleware ---
origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class ResearchRequest(BaseModel):
    prompt: str

# --- AI Service Functions ---
async def query_openai(prompt: str):
    """Sends a prompt to OpenAI and returns the response."""
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an expert research assistant. Provide a comprehensive, detailed, and well-structured answer."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1500
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error from OpenAI: {e}"

async def query_claude(prompt: str):
    """Sends a prompt to Anthropic and returns the response."""
    try:
        response = await anthropic_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
            system="You are an expert research assistant. Provide a comprehensive, detailed, and well-structured answer."
        )
        return response.content[0].text
    except Exception as e:
        return f"Error from Anthropic: {e}"

def sync_query_gemini(prompt: str):
    """(Sync) Sends a prompt to Gemini and returns the response."""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error from Gemini: {e}"

async def query_gemini(prompt: str):
    """Runs the synchronous Gemini query in a thread to avoid blocking."""
    return await asyncio.to_thread(sync_query_gemini, prompt)

# --- API Endpoints ---
@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.post("/research")
async def run_research(request: ResearchRequest):
    """Receives a prompt, queries all AI models in parallel, and returns their responses."""
    # Run all three AI queries concurrently
    openai_task = query_openai(request.prompt)
    claude_task = query_claude(request.prompt)
    gemini_task = query_gemini(request.prompt)

    # Wait for all tasks to complete
    results = await asyncio.gather(openai_task, claude_task, gemini_task)
    openai_response, claude_response, gemini_response = results
    
    return {
        "status": "success",
        "openai_response": openai_response,
        "claude_response": claude_response,
        "gemini_response": gemini_response
    }