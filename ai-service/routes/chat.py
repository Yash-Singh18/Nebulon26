from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.groq_client import chat

router = APIRouter()


class ChatRequest(BaseModel):
    business_id: str
    message: str
    history: list = []


class ChatResponse(BaseModel):
    response: str
    tools_used: list = []


@router.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    try:
        result = await chat(
            business_id=req.business_id,
            message=req.message,
            history=req.history,
        )
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
