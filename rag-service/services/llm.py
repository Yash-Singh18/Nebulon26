import random
from groq import Groq
from config import (
    GROQ_API_KEY_1,
    GROQ_API_KEY_2,
    GROQ_API_KEY_3,
    MAIN_MODEL,
    LIGHT_MODEL,
)


def _get_client() -> Groq:
    keys = [k for k in [GROQ_API_KEY_1, GROQ_API_KEY_2, GROQ_API_KEY_3] if k]
    if not keys:
        raise ValueError("No Groq API keys configured")
    return Groq(api_key=random.choice(keys))


def chat(
    messages: list[dict],
    model: str = None,
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model=model or MAIN_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


def chat_light(
    messages: list[dict],
    temperature: float = 0.1,
    max_tokens: int = 512,
) -> str:
    return chat(
        messages, model=LIGHT_MODEL, temperature=temperature, max_tokens=max_tokens
    )


def transcribe(audio_data, filename: str = "audio.webm", language: str = "en") -> str:
    client = _get_client()
    response = client.audio.transcriptions.create(
        model="whisper-large-v3",
        file=(filename, audio_data),
        language=language,
    )
    return response.text
