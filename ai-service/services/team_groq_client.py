"""
Team AI Pipeline — similar to groq_client.py but with team/user awareness.
"""
import os
import json
import traceback
import inspect
from groq import Groq
from .team_tools import TEAM_TOOL_FUNCTIONS
from .team_router import classify_team_intent
from .team_data_service import get_team_room

_client = None


def get_groq():
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


def structure_team_results(tool_results: dict, intent: str) -> str:
    sections = []

    for tool_name, data in tool_results.items():
        if data is None:
            continue

        if tool_name == "get_team_financial_summary" and isinstance(data, dict):
            s = "## Team Financial Summary\n"
            s += f"- Total Income: ₹{data.get('total_income', 0):,.2f}\n"
            s += f"- Total Expense: ₹{data.get('total_expense', 0):,.2f}\n"
            s += f"- Net Profit: ₹{data.get('net_profit', 0):,.2f}\n"
            s += f"- Transaction Count: {data.get('transaction_count', 0)}\n"
            s += f"- Average Transaction: ₹{data.get('avg_transaction', 0):,.2f}\n"
            sections.append(s)

        elif tool_name == "get_team_category_breakdown" and isinstance(data, list):
            s = "## Category Breakdown\n"
            for i, cat in enumerate(data[:15], 1):
                s += f"{i}. **{cat['category']}**: ₹{cat['total']:,.2f} ({cat['percentage']}%) — {cat['count']} txns\n"
            sections.append(s)

        elif tool_name == "get_team_member_spending" and isinstance(data, list):
            s = "## Member Spending Breakdown\n"
            for i, m in enumerate(data[:20], 1):
                s += f"{i}. **{m['user']}** (@{m['username']}) [{m['department']}]: "
                s += f"Income ₹{m['income']:,.2f} | Expense ₹{m['expense']:,.2f} | Net ₹{m['net']:,.2f} ({m['transaction_count']} txns)\n"
            sections.append(s)

        elif tool_name == "get_department_breakdown" and isinstance(data, list):
            s = "## Department Breakdown\n"
            for i, d in enumerate(data[:10], 1):
                s += f"{i}. **{d['department']}** ({d['member_count']} members): "
                s += f"Income ₹{d['income']:,.2f} | Expense ₹{d['expense']:,.2f} | Net ₹{d['net']:,.2f} ({d['transaction_count']} txns)\n"
            sections.append(s)

        elif tool_name == "get_team_recent_transactions" and isinstance(data, list):
            s = "## Recent Team Transactions\n"
            for t in data:
                s += f"- ₹{t['amount']:,.2f} ({t['type']}) — {t['category']} — {t['timestamp'][:10]} by {t['added_by']}\n"
            sections.append(s)

        elif tool_name == "get_team_top_expenses" and isinstance(data, list):
            s = "## Top Team Expenses\n"
            for i, t in enumerate(data, 1):
                s += f"{i}. ₹{t['amount']:,.2f} — {t['category']} — {t['timestamp'][:10]} by {t['added_by']}\n"
            sections.append(s)

        elif tool_name == "detect_team_anomalies" and isinstance(data, list):
            s = "## Anomalies Detected\n"
            if not data:
                s += "No anomalies detected.\n"
            else:
                for a in data[:10]:
                    s += f"- ⚠️ ₹{a['amount']:,.2f} ({a['type']}) in {a['category']} on {a['timestamp'][:10]} by {a['added_by']} — z-score: {a['z_score']}\n"
            sections.append(s)

        elif tool_name == "get_team_info" and isinstance(data, dict):
            s = f"## Team Info: {data.get('room_name', 'Unknown')}\n"
            s += f"- Total Members: {data.get('member_count', 0)}\n"
            for m in data.get("members", []):
                role_tag = " (Admin)" if m.get("role") == "admin" else ""
                s += f"- {m['name']} (@{m['username']}) — {m['department']}{role_tag}\n"
            sections.append(s)

        else:
            sections.append(f"## {tool_name}\n```json\n{json.dumps(data, default=str, indent=2)[:1000]}\n```\n")

    return "\n".join(sections) if sections else "No data retrieved from tools."


TEAM_RESPONSE_SYSTEM = """You are Sirius AI, an expert financial analyst for teams and collaborative businesses.
You are given structured financial data from a TEAM room where multiple members contribute.
Your job is to ANALYZE this data and give clear, actionable answers.

Rules:
- The data provided IS the truth. Analyze it, don't question it.
- Use the actual numbers from the data. Format currency as ₹X,XXX.XX (Indian Rupees).
- Be concise. Use bullet points and bold for key figures.
- When discussing individual members, reference them by name or @username.
- When discussing departments, compare their spending patterns.
- Give actionable team-level insights and recommendations.
- If data shows zero transactions, say "no transactions found" — don't say the system has no data.
- You CAN do math: calculate ratios, growth rates, averages, projections.
- Keep response under 300 words unless user asks for detail.
- Be direct. Start with the answer, then supporting details."""


async def team_chat(room_id: str, message: str, history: list = None):
    try:
        client = get_groq()

        # Step 1: Intent Classification
        classification = classify_team_intent(message)
        intent = classification["intent"]
        selected_tools = classification["tools"]
        params = classification["params"]

        print(f"[TEAM PIPELINE] Intent: {intent} | Tools: {selected_tools} | Params: {params}")

        # Step 2: Build tool args
        tool_args = {}
        if params.get("period"):
            tool_args["period"] = params["period"]
        if params.get("tx_type"):
            tool_args["tx_type"] = params["tx_type"]
        if params.get("category"):
            tool_args["category"] = params["category"]
        if params.get("limit"):
            tool_args["limit"] = params["limit"]

        # Step 3: Execute tools
        tool_results = {}
        tools_used = []

        for tool_name in selected_tools:
            fn = TEAM_TOOL_FUNCTIONS.get(tool_name)
            if not fn:
                continue

            sig = inspect.signature(fn)
            fn_params = set(sig.parameters.keys()) - {"room_id"}
            call_args = {k: v for k, v in tool_args.items() if k in fn_params and v is not None}

            try:
                result = await fn(room_id, **call_args)
                tool_results[tool_name] = result
                tools_used.append(tool_name)
                print(f"[TEAM TOOL] {tool_name}({call_args}) → {json.dumps(result, default=str)[:300]}")
            except Exception as e:
                print(f"[TEAM TOOL ERROR] {tool_name}: {e}")
                tool_results[tool_name] = None

        # Step 4: Structure data
        structured_data = structure_team_results(tool_results, intent)

        # Step 5: Final LLM Response
        room = get_team_room(room_id)
        room_ctx = ""
        if room:
            room_ctx = f"\nTeam Room: \"{room.get('name', 'Unknown')}\""

        messages = [
            {"role": "system", "content": TEAM_RESPONSE_SYSTEM + room_ctx},
        ]

        if history:
            for msg in history[-8:]:
                role = msg.get("role")
                content = msg.get("content")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})

        user_prompt = f"""User question: {message}

--- TEAM FINANCIAL DATA (from tools) ---
{structured_data}
--- END DATA ---

Analyze the above team data and answer the user's question. Reference specific members and departments where relevant."""

        messages.append({"role": "user", "content": user_prompt})

        final_response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=1024,
            temperature=0.3,
        )

        response_text = final_response.choices[0].message.content

        if not response_text:
            response_text = "I couldn't generate a response. Please try rephrasing."

        return {
            "response": response_text.strip(),
            "tools_used": tools_used,
            "intent": intent,
        }

    except Exception as e:
        print(f"[TEAM ERROR] Pipeline failed: {e}")
        traceback.print_exc()
        raise
