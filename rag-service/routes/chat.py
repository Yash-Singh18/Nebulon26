from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.pipeline import run_pipeline

router = APIRouter()


class ChatRequest(BaseModel):
    query: str
    session_id: str
    language: str = "en"


class ChatResponse(BaseModel):
    response: str
    confidence: float
    confidence_level: str
    source: str
    category: str


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        result = await run_pipeline(
            query=request.query,
            session_id=request.session_id,
            language=request.language,
        )
        return ChatResponse(
            response=result["response"],
            confidence=result["confidence"],
            confidence_level=result["confidence_level"],
            source=result["source"],
            category=result.get("category", "general"),
        )
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
