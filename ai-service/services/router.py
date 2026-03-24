"""
STEP 1: Intent Classification using LLaMA 8B (fast, cheap)
STEP 2: Tool Selection via intent mapping + smart fallback

Classifies user queries into intents and maps them to the right tools.
"""
import os
import json
from groq import Groq

_router_client = None

INTENTS = {
    "summary": {
        "description": "User wants an overall financial summary or performance overview",
        "tools": ["get_financial_summary", "get_category_breakdown"],
    },
    "expense_query": {
        "description": "User asks about expenses — biggest, top, specific category, where money goes",
        "tools": ["get_top_expenses", "get_category_breakdown"],
    },
    "income_query": {
        "description": "User asks about income, revenue, earnings",
        "tools": ["get_financial_summary", "get_category_breakdown"],
    },
    "trend_analysis": {
        "description": "User wants to see trends, patterns over time, growth, decline",
        "tools": ["get_time_trends", "get_financial_summary"],
    },
    "anomaly_detection": {
        "description": "User asks about anomalies, unusual spending, outliers, risks, red flags",
        "tools": ["detect_anomalies", "get_top_expenses"],
    },
    "comparison": {
        "description": "User wants to compare periods, month over month, category vs category",
        "tools": ["compare_periods", "get_category_breakdown"],
    },
    "recent_activity": {
        "description": "User asks about recent transactions, latest expenses, what happened today/recently",
        "tools": ["get_recent_transactions", "get_financial_summary"],
    },
    "category_detail": {
        "description": "User asks about a specific category — how much spent on X, breakdown of Y",
        "tools": ["get_category_breakdown", "get_recent_transactions"],
    },
    "recommendation": {
        "description": "User wants advice, suggestions, tips, how to save, what to improve",
        "tools": ["get_financial_summary", "get_category_breakdown", "detect_anomalies"],
    },
    "prediction": {
        "description": "User wants forecasts, predictions, projections, future outlook",
        "tools": ["get_time_trends", "get_financial_summary"],
    },
    "general": {
        "description": "General question, greeting, or unclear intent — fetch broad data",
        "tools": ["get_financial_summary"],
    },
}


def _get_router_client():
    global _router_client
    if _router_client is None:
        key = os.getenv("GROQ_API_KEY_ROUTER") or os.getenv("GROQ_API_KEY")
        _router_client = Groq(api_key=key)
    return _router_client


def classify_intent(message: str) -> dict:
    """Use LLaMA 8B to classify user intent. Returns intent name + extracted params."""
    client = _get_router_client()

    intent_list = "\n".join(
        f'- "{name}": {info["description"]}'
        for name, info in INTENTS.items()
    )

    system = f"""You are an intent classifier for a financial analytics chatbot.
Classify the user's message into exactly ONE intent and extract any parameters.

Available intents:
{intent_list}

Also extract these parameters if present:
- period: time period mentioned (map to: 24h, 7d, 30d, 90d, 6mo, 1y, all)
- category: specific category mentioned (e.g. "rent", "food", "utilities")
- tx_type: "income" or "expense" if specified
- limit: number of items requested (e.g. "top 5" → 5)

Respond ONLY with valid JSON, nothing else:
{{"intent": "intent_name", "period": "...", "category": "...", "tx_type": "...", "limit": null, "reasoning": "one line why"}}

If a param is not mentioned, set it to null. For period, default to "all" if no time mentioned."""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": message},
            ],
            max_tokens=200,
            temperature=0,
        )

        text = response.choices[0].message.content.strip()
        # Extract JSON from response (handle markdown code blocks)
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        result = json.loads(text)
        intent_name = result.get("intent", "general")
        if intent_name not in INTENTS:
            intent_name = "general"

        print(f"[ROUTER] intent={intent_name} | period={result.get('period')} | category={result.get('category')} | tx_type={result.get('tx_type')} | reasoning={result.get('reasoning')}")

        return {
            "intent": intent_name,
            "tools": INTENTS[intent_name]["tools"],
            "params": {
                "period": result.get("period"),
                "category": result.get("category"),
                "tx_type": result.get("tx_type"),
                "limit": result.get("limit"),
            },
        }

    except Exception as e:
        print(f"[ROUTER] Classification failed: {e}, falling back to general")
        return {
            "intent": "general",
            "tools": ["get_financial_summary", "get_category_breakdown"],
            "params": {"period": "all", "category": None, "tx_type": None, "limit": None},
        }
