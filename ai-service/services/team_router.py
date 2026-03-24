"""
Team-specific intent classification.
Extended from router.py with team/user-aware intents.
"""
import os
import json
from groq import Groq

_router_client = None

TEAM_INTENTS = {
    "summary": {
        "description": "User wants an overall team financial summary or performance overview",
        "tools": ["get_team_financial_summary", "get_team_category_breakdown"],
    },
    "expense_query": {
        "description": "User asks about team expenses — biggest, top, specific category",
        "tools": ["get_team_top_expenses", "get_team_category_breakdown"],
    },
    "income_query": {
        "description": "User asks about team income, revenue, earnings",
        "tools": ["get_team_financial_summary", "get_team_category_breakdown"],
    },
    "member_analysis": {
        "description": "User asks about specific members, who spent most, individual contributions",
        "tools": ["get_team_member_spending", "get_team_financial_summary"],
    },
    "department_analysis": {
        "description": "User asks about departments, which department spends most, dept comparison",
        "tools": ["get_department_breakdown", "get_team_financial_summary"],
    },
    "anomaly_detection": {
        "description": "User asks about anomalies, unusual spending, risks, red flags",
        "tools": ["detect_team_anomalies", "get_team_top_expenses"],
    },
    "recent_activity": {
        "description": "User asks about recent transactions, latest expenses, who added what",
        "tools": ["get_team_recent_transactions", "get_team_financial_summary"],
    },
    "team_info": {
        "description": "User asks about team members, who is in the team, team structure",
        "tools": ["get_team_info", "get_team_member_spending"],
    },
    "category_detail": {
        "description": "User asks about a specific category breakdown",
        "tools": ["get_team_category_breakdown", "get_team_recent_transactions"],
    },
    "recommendation": {
        "description": "User wants advice, suggestions, how to reduce costs",
        "tools": ["get_team_financial_summary", "get_team_category_breakdown", "get_department_breakdown", "detect_team_anomalies"],
    },
    "general": {
        "description": "General question or unclear intent",
        "tools": ["get_team_financial_summary"],
    },
}


def _get_router_client():
    global _router_client
    if _router_client is None:
        key = os.getenv("GROQ_API_KEY_ROUTER") or os.getenv("GROQ_API_KEY")
        _router_client = Groq(api_key=key)
    return _router_client


def classify_team_intent(message: str) -> dict:
    client = _get_router_client()

    intent_list = "\n".join(
        f'- "{name}": {info["description"]}'
        for name, info in TEAM_INTENTS.items()
    )

    system = f"""You are an intent classifier for a TEAM financial analytics chatbot.
This chatbot serves teams/rooms where multiple users track finances together.
Classify the user's message into exactly ONE intent and extract any parameters.

Available intents:
{intent_list}

Also extract these parameters if present:
- period: time period (map to: 24h, 7d, 30d, 90d, 6mo, 1y, all)
- category: specific category (e.g. "rent", "food", "utilities")
- tx_type: "income" or "expense" if specified
- limit: number of items requested
- username: specific team member mentioned

Respond ONLY with valid JSON:
{{"intent": "intent_name", "period": "...", "category": "...", "tx_type": "...", "limit": null, "username": "...", "reasoning": "one line why"}}

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
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        result = json.loads(text)
        intent_name = result.get("intent", "general")
        if intent_name not in TEAM_INTENTS:
            intent_name = "general"

        print(f"[TEAM ROUTER] intent={intent_name} | period={result.get('period')} | username={result.get('username')}")

        return {
            "intent": intent_name,
            "tools": TEAM_INTENTS[intent_name]["tools"],
            "params": {
                "period": result.get("period"),
                "category": result.get("category"),
                "tx_type": result.get("tx_type"),
                "limit": result.get("limit"),
                "username": result.get("username"),
            },
        }

    except Exception as e:
        print(f"[TEAM ROUTER] Classification failed: {e}, falling back to general")
        return {
            "intent": "general",
            "tools": ["get_team_financial_summary", "get_team_category_breakdown"],
            "params": {"period": "all", "category": None, "tx_type": None, "limit": None, "username": None},
        }
