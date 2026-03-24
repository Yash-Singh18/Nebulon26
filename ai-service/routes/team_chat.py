from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.team_groq_client import team_chat

router = APIRouter()


class TeamChatRequest(BaseModel):
    room_id: str
    message: str
    history: list = []


class TeamChatResponse(BaseModel):
    response: str
    tools_used: list = []
    intent: Optional[str] = None


@router.post("/api/team-chat", response_model=TeamChatResponse)
async def team_chat_endpoint(req: TeamChatRequest):
    try:
        result = await team_chat(
            room_id=req.room_id,
            message=req.message,
            history=req.history,
        )
        return TeamChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
