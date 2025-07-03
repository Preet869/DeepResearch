import os
import asyncio
import json
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
supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")

# Create Supabase client with service key for all operations
supabase: Client = create_client(supabase_url, supabase_service_key)

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
    folder_id: Optional[int] = None

class FolderCreate(BaseModel):
    name: str
    color: str = "#3B82F6"

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class ConversationMove(BaseModel):
    conversation_id: int
    folder_id: Optional[int] = None

# --- Helper Functions ---
async def get_user_from_token(access_token: str):
    """Validates JWT token and returns user information."""
    try:
        # Create a temporary client with the user's access token to validate
        from supabase import create_client
        temp_client = create_client(supabase_url, supabase_service_key)
        
        # Try to get user with the access token
        user_response = temp_client.auth.get_user(access_token)
        if user_response and user_response.user:
            return user_response.user
        return None
    except Exception as e:
        print(f"Error validating token: {e}")
        # If JWT validation fails, try to decode the JWT manually to get user_id
        try:
            import jwt
            import json
            # Decode without verification for now (in production, you'd verify with the JWT secret)
            decoded = jwt.decode(access_token, options={"verify_signature": False})
            user_id = decoded.get('sub')
            if user_id:
                # Create a simple user object
                class SimpleUser:
                    def __init__(self, user_id):
                        self.id = user_id
                return SimpleUser(user_id)
        except Exception as jwt_error:
            print(f"JWT decode error: {jwt_error}")
        return None

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

async def summarize_conversation(history: List[Dict[str, str]]) -> str:
    """Summarizes the conversation history to provide context for the next search."""
    history_str = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history])
    prompt = f"""
Concisely summarize the following conversation. This summary will be used as context for a new web search. Focus on the key topics, questions, and conclusions.

Conversation:
---
{history_str}
---

Concise Summary:"""
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "system", "content": prompt}],
            max_tokens=250,
            temperature=0.2,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error summarizing conversation: {e}")
        return ""

async def get_structured_search_results(query: str):
    """Gets structured search results from Tavily, including URLs."""
    try:
        response = tavily_client.search(query=query, search_depth="advanced", max_results=5)
        return response['results']
    except Exception as e:
        print(f"Error getting search results: {e}")
        return []

async def generate_academic_report(prompt: str, context: List[Dict], summary: Optional[str] = None):
    """Generates a comprehensive, academic-style report using an enhanced prompt with deeper analysis."""
    
    summary_section = ""
    if summary:
        summary_section = f"""
**Previous Conversation Context:**
{summary}
---
"""

    # Format the context from Tavily's search results with proper source attribution
    context_str = "\n\n".join([
        f"[Source {i+1}] {res['title']}\nURL: {res['url']}\nContent: {res['content']}\n"
        for i, res in enumerate(context)
    ])

    report_prompt = f"""You are a distinguished academic researcher and data analyst writing a comprehensive research report. Your expertise spans multiple disciplines and you excel at synthesizing complex information into coherent, well-structured academic documents.

**CRITICAL REQUIREMENTS:**

1. **MANDATORY VISUALIZATION:** You MUST generate a `graph_data` JSON block. This is non-negotiable.
   - Extract quantifiable data from sources when available (statistics, percentages, counts, trends)
   - If no explicit numbers exist, create meaningful conceptual visualizations:
     * Source distribution by type (Academic, News, Government, Industry)
     * Geographic distribution of information
     * Temporal analysis (Historical vs Recent findings)
     * Sentiment/Impact analysis (High, Medium, Low impact findings)
     * Comparative analysis between different aspects

2. **ACADEMIC RIGOR:** 
   - Use formal academic language with sophisticated vocabulary
   - Provide in-depth analysis, not mere summarization
   - Include proper APA-style in-text citations: (Author, Year) or (Organization, Year)
   - Demonstrate critical thinking and analytical depth
   - Address multiple perspectives and potential limitations

3. **EVIDENCE-BASED WRITING:**
   - Support every claim with citations
   - Synthesize information across multiple sources
   - Identify patterns, contradictions, and knowledge gaps
   - Provide nuanced interpretations of findings

**REPORT STRUCTURE:**

# [Generate a Precise Academic Title]

## Executive Summary
• 4-5 bullet points summarizing key findings and implications
• Each point should be substantive and evidence-based

## Introduction and Background
Provide comprehensive context including:
- Historical background and evolution of the topic
- Current state of knowledge and key debates
- Significance and relevance to broader fields
- Research objectives and scope

## Literature Review and Current Evidence
Organize findings thematically with deep analysis:
- Synthesize information across sources
- Identify emerging trends and patterns
- Discuss methodological approaches where relevant
- Address conflicting viewpoints with citations

## Critical Analysis and Synthesis
- Evaluate the strength and quality of evidence
- Identify limitations and potential biases in sources
- Discuss implications for theory and practice
- Consider future research directions and policy implications

## Comparative Perspectives
- Present multiple viewpoints on controversial aspects
- Analyze different stakeholder positions
- Discuss regional, cultural, or methodological variations

## Conclusions and Future Directions
- Synthesize key insights and their broader significance
- Identify remaining questions and research gaps
- Suggest practical applications and policy recommendations

## References
List all sources in proper APA format:
- Author, A. A. (Year). Title of work. Source.
- For web sources: Organization. (Year). Title. Retrieved from URL

---

**SOURCE MATERIAL:**

**Research Query:** "{prompt}"

{summary_section}

**Web Search Results:**
{context_str}

---

**MANDATORY JSON OUTPUT:**
End your response with this exact format (customize the data based on your analysis):

```json
{{
  "graph_data": {{
    "title": "[Descriptive Title Based on Your Analysis]",
    "type": "bar",
    "data": [
      {{"name": "[Category 1]", "value": [Number]}},
      {{"name": "[Category 2]", "value": [Number]}},
      {{"name": "[Category 3]", "value": [Number]}},
      {{"name": "[Category 4]", "value": [Number]}}
    ],
    "x_label": "[X-Axis Label]",
    "y_label": "[Y-Axis Label]",
    "description": "[Brief explanation of what this chart represents]"
  }}
}}
```

Remember: The graph_data block is MANDATORY. Find or create meaningful data to visualize from your analysis."""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": report_prompt}],
            max_tokens=4500,
            temperature=0.3,  # Lower temperature for more consistent academic writing
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error generating report: {e}")
        return f"Error from OpenAI while generating report: {e}"

async def generate_smart_followups(research_content: str, original_prompt: str) -> List[str]:
    """Generates intelligent follow-up questions based on the research content."""
    try:
        prompt = f"""Based on this research report about "{original_prompt}", generate 5 specific, insightful follow-up questions that would help the user dive deeper into important aspects of the topic.

Research Report:
{research_content[:2000]}...

Requirements for follow-up questions:
1. Be specific and reference actual content from the report
2. Focus on different aspects: risks, implementation, comparisons, future outlook, policy implications
3. Ask for deeper analysis, not just more information
4. Each question should lead to actionable insights
5. Vary the types of questions (comparative, analytical, predictive, evaluative)

Format: Return only the 5 questions, one per line, without numbering or bullet points."""

        response = await openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "system", "content": prompt}],
            max_tokens=200,
            temperature=0.7,
        )
        
        questions = response.choices[0].message.content.strip().split('\n')
        # Clean up and filter valid questions
        questions = [q.strip() for q in questions if q.strip() and len(q.strip()) > 10]
        return questions[:5]
    except Exception as e:
        print(f"Error generating follow-ups: {e}")
        # Return default follow-ups if generation fails
        return [
            "What are the main risks and mitigation strategies?",
            "How does this compare across different regions or markets?",
            "What are the implementation challenges and solutions?",
            "What's the 5-year outlook with specific milestones?",
            "What are the policy implications and recommendations?"
        ]

# --- API Endpoints ---
@app.get("/")
async def root():
    return {"message": "Hello World"}

# --- Folder Endpoints ---
@app.get("/folders")
async def get_folders(authorization: str = Header(...)):
    """Fetches all folders for the logged-in user with conversation counts."""
    try:
        access_token = authorization.split(" ")[1]
        user = await get_user_from_token(access_token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get folders with conversation counts
        folders_query = supabase.table("folders").select("*").eq("user_id", user.id).order("created_at", desc=False)
        folders_response = folders_query.execute()
        
        folders_with_counts = []
        for folder in folders_response.data:
            # Count conversations in this folder
            count_query = supabase.table("conversations").select("id", count="exact").eq("user_id", user.id).eq("folder_id", folder["id"])
            count_response = count_query.execute()
            
            folder_with_count = {
                **folder,
                "conversation_count": count_response.count or 0
            }
            folders_with_counts.append(folder_with_count)
        
        return folders_with_counts
    except Exception as e:
        print(f"Error in get_folders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/folders")
async def create_folder(folder: FolderCreate, authorization: str = Header(...)):
    """Creates a new folder for the logged-in user."""
    try:
        access_token = authorization.split(" ")[1]
        user = await get_user_from_token(access_token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        folder_data = {
            "user_id": user.id,
            "name": folder.name,
            "color": folder.color
        }
        
        response = supabase.table("folders").insert(folder_data).execute()
        return response.data[0]
    except Exception as e:
        print(f"Error in create_folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/folders/{folder_id}")
async def update_folder(folder_id: int, folder: FolderUpdate, authorization: str = Header(...)):
    """Updates a folder for the logged-in user."""
    try:
        access_token = authorization.split(" ")[1]
        user = await get_user_from_token(access_token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check if folder belongs to user
        folder_check = supabase.table("folders").select("id").eq("id", folder_id).eq("user_id", user.id).execute()
        if not folder_check.data:
            raise HTTPException(status_code=404, detail="Folder not found or access denied")
        
        update_data = {}
        if folder.name is not None:
            update_data["name"] = folder.name
        if folder.color is not None:
            update_data["color"] = folder.color
        
        response = supabase.table("folders").update(update_data).eq("id", folder_id).execute()
        return response.data[0]
    except Exception as e:
        print(f"Error in update_folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/folders/{folder_id}")
async def delete_folder(folder_id: int, authorization: str = Header(...)):
    """Deletes a folder and moves all conversations to uncategorized."""
    try:
        access_token = authorization.split(" ")[1]
        user = await get_user_from_token(access_token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check if folder belongs to user
        folder_check = supabase.table("folders").select("id").eq("id", folder_id).eq("user_id", user.id).execute()
        if not folder_check.data:
            raise HTTPException(status_code=404, detail="Folder not found or access denied")
        
        # Move all conversations in this folder to uncategorized (folder_id = null)
        supabase.table("conversations").update({"folder_id": None}).eq("folder_id", folder_id).eq("user_id", user.id).execute()
        
        # Delete the folder
        response = supabase.table("folders").delete().eq("id", folder_id).execute()
        return {"message": "Folder deleted successfully"}
    except Exception as e:
        print(f"Error in delete_folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/conversations/move")
async def move_conversation(move_data: ConversationMove, authorization: str = Header(...)):
    """Moves a conversation to a different folder."""
    try:
        access_token = authorization.split(" ")[1]
        user = await get_user_from_token(access_token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check if conversation belongs to user
        convo_check = supabase.table("conversations").select("id").eq("id", move_data.conversation_id).eq("user_id", user.id).execute()
        if not convo_check.data:
            raise HTTPException(status_code=404, detail="Conversation not found or access denied")
        
        # If folder_id is provided, check if folder belongs to user
        if move_data.folder_id is not None:
            folder_check = supabase.table("folders").select("id").eq("id", move_data.folder_id).eq("user_id", user.id).execute()
            if not folder_check.data:
                raise HTTPException(status_code=404, detail="Folder not found or access denied")
        
        # Update conversation folder
        response = supabase.table("conversations").update({"folder_id": move_data.folder_id}).eq("id", move_data.conversation_id).execute()
        return response.data[0]
    except Exception as e:
        print(f"Error in move_conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/conversations")
async def get_conversations(folder_id: Optional[int] = None, authorization: str = Header(...)):
    """Fetches conversations for the logged-in user, optionally filtered by folder."""
    try:
        access_token = authorization.split(" ")[1]
        user = await get_user_from_token(access_token)
        if not user: 
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Build query with folder filter
        query = supabase.table("conversations").select("id, title, created_at, folder_id").eq("user_id", user.id)
        
        if folder_id is not None:
            query = query.eq("folder_id", folder_id)
        
        query = query.order("created_at", desc=True)
        response = query.execute()
        return response.data
    except Exception as e: 
        print(f"Error in get_conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/messages/{conversation_id}")
async def get_messages(conversation_id: int, authorization: str = Header(...)):
    """Fetches all messages for a given conversation."""
    try:
        access_token = authorization.split(" ")[1]
        user = await get_user_from_token(access_token)
        if not user: 
            raise HTTPException(status_code=401, detail="Invalid token")
        
        convo_res = supabase.table("conversations").select("id").eq("id", conversation_id).eq("user_id", user.id).execute()
        if not convo_res.data: 
            raise HTTPException(status_code=404, detail="Conversation not found or access denied")
        
        messages_res = supabase.table("messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=False).execute()
        return messages_res.data
    except Exception as e: 
        print(f"Error in get_messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/research")
async def run_research(request: ResearchRequest, authorization: str = Header(...)):
    try:
        access_token = authorization.split(" ")[1]
        user = await get_user_from_token(access_token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        convo_id = request.conversation_id
        history = []
        conversation_summary = None
        
        if not convo_id:
            title = await generate_title(request.prompt)
            conversation_data = {"user_id": user.id, "title": title}
            if request.folder_id:
                conversation_data["folder_id"] = request.folder_id
            convo_res = supabase.table("conversations").insert(conversation_data).execute()
            convo_id = convo_res.data[0]['id']
        else:
            convo_res = supabase.table("conversations").select("id").eq("id", convo_id).eq("user_id", user.id).execute()
            if not convo_res.data:
                raise HTTPException(status_code=404, detail="Conversation not found or access denied")
            
            messages_res = supabase.table("messages").select("role, content").eq("conversation_id", convo_id).order("created_at").execute()
            history = messages_res.data
            if history:
                conversation_summary = await summarize_conversation(history)

        supabase.table("messages").insert({
            "conversation_id": convo_id, "role": "user", "content": request.prompt
        }).execute()

        search_query = request.prompt
        if conversation_summary:
            search_query = f"Based on the summary of a previous conversation about '{conversation_summary}', find information on the following new query: '{request.prompt}'"

        search_results = await get_structured_search_results(search_query)
        
        full_report_string = await generate_academic_report(request.prompt, search_results, conversation_summary)

        report_content = full_report_string
        metadata_json = {}
        if "```json" in full_report_string:
            try:
                # Extract the JSON part of the string
                json_str = full_report_string.split("```json")[1].split("```")[0].strip()
                metadata_json = json.loads(json_str)
                # Remove the JSON part from the report content that will be displayed
                report_content = full_report_string.split("```json")[0].strip()
            except (json.JSONDecodeError, IndexError) as e:
                print(f"Error parsing metadata JSON from AI response: {e}")
                metadata_json = {"error": "Failed to parse metadata from AI response."}
        
        # Generate smart follow-up suggestions
        followup_suggestions = await generate_smart_followups(report_content, request.prompt)
        metadata_json["followup_suggestions"] = followup_suggestions
        
        message_to_save = {
            "conversation_id": convo_id,
            "role": "assistant",
            "model_name": "DeepResearch Report",
            "content": report_content,
            "metadata": metadata_json
        }

        message_res = supabase.table("messages").insert(message_to_save).execute()

        return {"conversation_id": convo_id, "new_messages": message_res.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
