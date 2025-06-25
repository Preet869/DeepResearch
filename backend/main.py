from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
class ResearchRequest(BaseModel):
    prompt: str

@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/research")
async def run_research(request: ResearchRequest):
    return {"status": "received", "prompt": request.prompt} 
