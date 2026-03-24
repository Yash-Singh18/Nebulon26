import io
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.llm import transcribe
from services.pipeline import run_pipeline

router = APIRouter()


@router.post("/voice")
async def voice_chat(
    audio: UploadFile = File(...),
    session_id: str = Form(...),
    language: str = Form("en"),
):
    try:
        audio_bytes = await audio.read()
        filename = audio.filename or "audio.webm"

        # Transcribe with Groq Whisper
        transcript = transcribe(
            audio_data=io.BytesIO(audio_bytes),
            filename=filename,
            language=language,
        )

        if not transcript or not transcript.strip():
            return {
                "response": "Could not understand the audio. Please try again.",
                "transcript": "",
                "confidence": 0,
                "confidence_level": "none",
                "source": "none",
                "category": "none",
            }

        # Run through RAG pipeline
        result = await run_pipeline(
            query=transcript.strip(),
            session_id=session_id,
            language=language,
        )

        return {
            "transcript": transcript.strip(),
            "response": result["response"],
            "confidence": result["confidence"],
            "confidence_level": result["confidence_level"],
            "source": result["source"],
            "category": result.get("category", "general"),
        }
    except Exception as e:
        print(f"Voice error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
