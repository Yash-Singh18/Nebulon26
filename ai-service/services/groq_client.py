"""
6-Step AI Pipeline:
1. Intent Classification (LLaMA 8B — fast router)
2. Tool Selection (intent mapping + extracted params)
3. Tool Execution (parallel where possible)
4. Data Structuring (clean + contextualize results)
5. Final LLM Response (LLaMA 70B — storyteller)
6. Clean output for UI
"""
import os
import json
import traceback
from groq import Groq
from .tools import TOOL_FUNCTIONS
from .router import classify_intent
from .data_service import get_business

_client = None


def get_groq():
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


# ── STEP 4: Data Structuring ──
def structure_tool_results(tool_results: dict, intent: str) -> str:
    """Transform raw tool outputs into a clean, structured context block for the LLM."""
    sections = []

    for tool_name, data in tool_results.items():
        if data is None:
            continue

        if tool_name == "get_financial_summary" and isinstance(data, dict):
            s = "## Financial Summary\n"
            s += f"- Total Income: ${data.get('total_income', 0):,.2f}\n"
            s += f"- Total Expense: ${data.get('total_expense', 0):,.2f}\n"
            s += f"- Net Profit: ${data.get('net_profit', 0):,.2f}\n"
            s += f"- Transaction Count: {data.get('transaction_count', 0)}\n"
            s += f"- Average Transaction: ${data.get('avg_transaction', 0):,.2f}\n"
            if data.get("period_start"):
                s += f"- Period: {data['period_start'][:10]} to {data.get('period_end', 'now')[:10]}\n"
            sections.append(s)

        elif tool_name == "get_category_breakdown" and isinstance(data, list):
            s = "## Category Breakdown\n"
            if not data:
                s += "No data for this period.\n"
            else:
                for i, cat in enumerate(data[:15], 1):
                    s += f"{i}. **{cat['category']}**: ${cat['total']:,.2f} ({cat['percentage']}%) — {cat['count']} transactions\n"
            sections.append(s)

        elif tool_name == "get_time_trends" and isinstance(data, list):
            s = "## Time Trends\n"
            if not data:
                s += "No trend data for this period.\n"
            else:
                for entry in data[-20:]:  # Last 20 periods
                    s += f"- {entry['period']}: Income ${entry['income']:,.2f} | Expense ${entry['expense']:,.2f} | Net ${entry['net']:,.2f}\n"
            sections.append(s)

        elif tool_name == "detect_anomalies" and isinstance(data, list):
            s = "## Anomalies Detected\n"
            if not data:
                s += "No anomalies detected.\n"
            else:
                for a in data[:10]:
                    s += f"- ⚠️ ${a['amount']:,.2f} ({a['type']}) in {a['category']} on {a['timestamp'][:10]} — z-score: {a['z_score']} (category avg: ${a['category_mean']:,.2f})\n"
            sections.append(s)

        elif tool_name == "get_recent_transactions" and isinstance(data, list):
            s = "## Recent Transactions\n"
            if not data:
                s += "No transactions found.\n"
            else:
                for t in data:
                    s += f"- ${t['amount']:,.2f} ({t['type']}) — {t['category']} — {t['timestamp'][:10]}\n"
            sections.append(s)

        elif tool_name == "get_top_expenses" and isinstance(data, list):
            s = "## Top Expenses\n"
            if not data:
                s += "No expenses found.\n"
            else:
                for i, t in enumerate(data, 1):
                    s += f"{i}. ${t['amount']:,.2f} — {t['category']} — {t['timestamp'][:10]}\n"
            sections.append(s)

        elif tool_name == "compare_periods" and isinstance(data, dict):
            s = "## Period Comparison\n"
            p1 = data.get("period_1", {})
            p2 = data.get("period_2", {})
            changes = data.get("changes", {})
            s += f"**Period 1**: Income ${p1.get('income', 0):,.2f} | Expense ${p1.get('expense', 0):,.2f} | Net ${p1.get('net', 0):,.2f} ({p1.get('count', 0)} txns)\n"
            s += f"**Period 2**: Income ${p2.get('income', 0):,.2f} | Expense ${p2.get('expense', 0):,.2f} | Net ${p2.get('net', 0):,.2f} ({p2.get('count', 0)} txns)\n"
            if changes.get("income_change_pct") is not None:
                s += f"- Income change: {changes['income_change_pct']:+.1f}%\n"
            if changes.get("expense_change_pct") is not None:
                s += f"- Expense change: {changes['expense_change_pct']:+.1f}%\n"
            sections.append(s)

        else:
            # Fallback: dump as JSON
            sections.append(f"## {tool_name}\n```json\n{json.dumps(data, default=str, indent=2)[:1000]}\n```\n")

    return "\n".join(sections) if sections else "No data retrieved from tools."


# ── STEP 5: Final Response Prompt ──
RESPONSE_SYSTEM = """You are Sirius AI, an expert financial analyst for small and medium businesses.
You are given structured financial data from tools. Your job is to ANALYZE this data and give the user a clear, actionable answer.

Rules:
- The data provided IS the truth. Analyze it, don't question it.
- Use the actual numbers from the data. Format currency as $X,XXX.XX.
- Be concise. Use bullet points and bold for key figures.
- Give actionable insights and recommendations, not just restate numbers.
- If data shows zero transactions for a period, say "no transactions in [specific period]" — don't say the system has no data overall.
- For predictions/forecasts, use trends from the data and clearly mark them as projections.
- You CAN do math: calculate ratios, growth rates, averages, projections from the data.
- Keep response under 250 words unless user asks for detail.
- Be direct. Start with the answer, then supporting details."""


async def chat(business_id: str, message: str, history: list = None):
    try:
        client = get_groq()

        # ── STEP 1: Intent Classification (LLaMA 8B) ──
        classification = classify_intent(message)
        intent = classification["intent"]
        selected_tools = classification["tools"]
        params = classification["params"]

        print(f"[PIPELINE] Intent: {intent} | Tools: {selected_tools} | Params: {params}")

        # ── STEP 2: Build tool arguments from extracted params ──
        tool_args = {}
        if params.get("period"):
            tool_args["period"] = params["period"]
        if params.get("tx_type"):
            tool_args["tx_type"] = params["tx_type"]
        if params.get("category"):
            tool_args["category"] = params["category"]
        if params.get("limit"):
            tool_args["limit"] = params["limit"]

        # ── STEP 3: Execute tools ──
        tool_results = {}
        tools_used = []

        for tool_name in selected_tools:
            fn = TOOL_FUNCTIONS.get(tool_name)
            if not fn:
                continue

            # Build args specific to each tool (not all accept all params)
            import inspect
            sig = inspect.signature(fn)
            fn_params = set(sig.parameters.keys()) - {"business_id"}
            call_args = {k: v for k, v in tool_args.items() if k in fn_params and v is not None}

            try:
                result = await fn(business_id, **call_args)
                tool_results[tool_name] = result
                tools_used.append(tool_name)
                print(f"[TOOL] {tool_name}({call_args}) → {json.dumps(result, default=str)[:300]}")
            except Exception as e:
                print(f"[TOOL ERROR] {tool_name}: {e}")
                tool_results[tool_name] = None

        # ── STEP 4: Structure data ──
        structured_data = structure_tool_results(tool_results, intent)

        # ── STEP 5: Final LLM Response (LLaMA 70B) ──
        business = get_business(business_id)
        business_ctx = ""
        if business:
            business_ctx = f"\nBusiness: \"{business.get('name', 'Unknown')}\" (Type: {business.get('type', 'N/A')})"

        messages = [
            {"role": "system", "content": RESPONSE_SYSTEM + business_ctx},
        ]

        # Add conversation history for context
        if history:
            for msg in history[-8:]:
                role = msg.get("role")
                content = msg.get("content")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})

        # The user message with injected data context
        user_prompt = f"""User question: {message}

--- FINANCIAL DATA (from tools) ---
{structured_data}
--- END DATA ---

Analyze the above data and answer the user's question. Be specific with numbers."""

        messages.append({"role": "user", "content": user_prompt})

        final_response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=1024,
            temperature=0.3,
        )

        response_text = final_response.choices[0].message.content

        # ── STEP 6: Clean output ──
        if not response_text:
            response_text = "I couldn't generate a response. Please try rephrasing your question."

        return {
            "response": response_text.strip(),
            "tools_used": tools_used,
            "intent": intent,
        }

    except Exception as e:
        print(f"[ERROR] Pipeline failed: {e}")
        traceback.print_exc()
        raise
