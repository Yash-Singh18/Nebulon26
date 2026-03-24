from services.query_processor import preprocess_query, classify_query, generate_multi_queries
from services.retriever import retrieve_and_score
from services.memory import store_query, get_recent_queries, get_business_type, set_business_type
from services.llm import chat, chat_light

RAG_SYSTEM_PROMPT = """You are a business consultant AI for small and medium-sized businesses.

You MUST answer ONLY using the provided context.
Do NOT use prior knowledge.
If the answer is not fully present in the context, say so and supplement with practical advice grounded in the context.

Be practical, actionable, and specific in your advice.
Use bullet points and clear formatting for readability.
If relevant, mention specific tools, strategies, or next steps the business owner can take.
Keep responses concise but thorough.

Context:
{context}

Previous conversation context:
{memory_context}

Business type: {business_type}"""

FALLBACK_SYSTEM_PROMPT = """You are a business consultant AI for small and medium-sized businesses.

Answer using your general business expertise. Be practical, actionable, and specific.
Use bullet points and clear formatting for readability.
Tailor your advice to the business context if known.

Previous conversation context:
{memory_context}

Business type: {business_type}"""

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "es": "Spanish", "fr": "French",
    "de": "German", "zh": "Chinese", "ja": "Japanese", "ar": "Arabic",
    "pt": "Portuguese", "ko": "Korean", "ru": "Russian", "it": "Italian",
}


async def run_pipeline(query: str, session_id: str, language: str = "en") -> dict:
    """Execute the full RAG pipeline."""

    # Step 1: Preprocess
    cleaned_query = preprocess_query(query)
    if not cleaned_query:
        return {
            "response": "Please provide a question.",
            "confidence": 0,
            "confidence_level": "none",
            "source": "none",
            "category": "none",
        }

    # Step 2: Get memory context
    business_type = get_business_type(session_id)
    recent_queries = get_recent_queries(session_id)
    memory_context = ""
    if recent_queries:
        memory_context = "Recent questions: " + " | ".join(recent_queries)

    # Step 3: Classify query
    classification = classify_query(cleaned_query, business_type)
    category = classification.get("category", "general")

    # Step 4: Detect business type from message
    biz_keywords = [
        "my business is", "i run a", "i own a", "my company is",
        "we are a", "i have a", "my shop", "my store", "my restaurant",
    ]
    if any(kw in cleaned_query.lower() for kw in biz_keywords):
        bt_response = chat_light(
            [
                {
                    "role": "system",
                    "content": "Extract the business type/industry from this message. Reply with just the business type, nothing else.",
                },
                {"role": "user", "content": cleaned_query},
            ]
        )
        set_business_type(session_id, bt_response.strip())
        business_type = bt_response.strip()

    # Step 5: Generate multi-queries (original + 2 alternatives)
    alt_queries = generate_multi_queries(cleaned_query, category)
    queries = list(set([cleaned_query] + alt_queries))[:3]

    # Step 6: RETRIEVAL FIRST (MANDATORY)
    retrieval = retrieve_and_score(queries)

    # Step 7: Store query in memory
    store_query(session_id, cleaned_query)

    # Step 8: Confidence gate -> generate response
    if retrieval["confidence_level"] in ("strong", "medium"):
        # RAG response with retrieved context
        context = "\n\n---\n\n".join(
            [chunk["text"] for chunk in retrieval["chunks"]]
        )

        hint = ""
        if retrieval["confidence_level"] == "medium":
            hint = "\n\nNote: The context may not fully cover this topic. Supplement with practical business knowledge where needed, but prioritize the provided context."

        system_prompt = RAG_SYSTEM_PROMPT.format(
            context=context + hint,
            memory_context=memory_context or "No previous context",
            business_type=business_type or "Not specified",
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": cleaned_query},
        ]

        if language != "en":
            lang_name = LANGUAGE_NAMES.get(language, language)
            messages[0]["content"] += f"\n\nIMPORTANT: Respond in {lang_name} language."

        response = chat(messages)
        source = "rag"
    else:
        # Fallback to LLM without RAG context
        system_prompt = FALLBACK_SYSTEM_PROMPT.format(
            memory_context=memory_context or "No previous context",
            business_type=business_type or "Not specified",
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": cleaned_query},
        ]

        if language != "en":
            lang_name = LANGUAGE_NAMES.get(language, language)
            messages[0]["content"] += f"\n\nIMPORTANT: Respond in {lang_name} language."

        response = chat(messages)
        source = "fallback"

    # Step 9: Post-processing
    response = response.strip()

    return {
        "response": response,
        "confidence": retrieval["confidence"],
        "confidence_level": retrieval["confidence_level"],
        "source": source,
        "category": category,
        "chunks_used": len(retrieval["chunks"]),
    }
