import os
import json
import traceback
from groq import Groq
from .tools import TOOL_DEFINITIONS, TOOL_FUNCTIONS
from .data_service import get_business

_client = None


def get_groq():
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


SYSTEM_PROMPT = """You are Sirius AI, a financial analyst for small and medium businesses.
You have tools that fetch real financial data. ALWAYS call tools to get data before answering.

Available tools:
- get_financial_summary: overall income/expense/profit totals
- get_category_breakdown: spending by category with percentages
- get_time_trends: income/expense over time (day/week/month buckets)
- detect_anomalies: find unusual transactions via z-score
- get_recent_transactions: list individual transactions (use for specific queries, recent activity, or when you need raw data to compute something yourself)
- get_top_expenses: biggest expenses sorted by amount
- compare_periods: compare two time periods side by side

CRITICAL — Time filtering:
- All tools accept a "period" parameter. USE IT for time-based queries: "24h", "7d", "30d", "90d", "6mo", "1y", "all"
- Do NOT try to format dates yourself. Use the period shorthand.
- "expenses in last 24 hours" → period="24h". "this month" → period="30d". "this year" → period="1y".

Instructions:
- Call tools FIRST, then analyze the returned data. Tool data is the truth.
- If a query needs data the tools don't directly provide, use get_recent_transactions to get raw data and calculate the answer yourself.
- You CAN and SHOULD do math on tool results: averages, comparisons, percentages, projections.
- Format currency as $X,XXX.XX. Use bullet points. Be concise and actionable.
- If tools return zero transactions for a period, say there are no transactions in that specific period — don't say the system has no data.
- You may call multiple tools in one turn if needed.
"""


async def chat(business_id: str, message: str, history: list = None):
    try:
        client = get_groq()

        # Get business context
        business = get_business(business_id)

        business_context = ""
        if business:
            business_context = f"\n\nCurrent business: \"{business.get('name', 'Unknown')}\" (Type: {business.get('type', 'N/A')})"
            if business.get("description"):
                business_context += f"\nDescription: {business['description']}"

        system = SYSTEM_PROMPT + business_context

        messages = [{"role": "system", "content": system}]

        # Add conversation history
        if history:
            for msg in history[-10:]:
                role = msg.get("role")
                content = msg.get("content")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})

        # Always ensure the latest user message is present
        if not history or messages[-1].get("content") != message:
            messages.append({"role": "user", "content": message})

        tools_used = []

        # First call — LLM decides which tools to use
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            max_tokens=1024,
        )

        response_message = response.choices[0].message

        # Handle tool calls
        if response_message.tool_calls:
            # Append assistant message as dict
            assistant_msg = {
                "role": "assistant",
                "content": response_message.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in response_message.tool_calls
                ],
            }
            messages.append(assistant_msg)

            for tool_call in response_message.tool_calls:
                fn_name = tool_call.function.name
                try:
                    args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    args = {}

                tools_used.append(fn_name)

                # Execute the tool — inject business_id
                fn = TOOL_FUNCTIONS.get(fn_name)
                if fn:
                    result = await fn(business_id, **args)
                    tool_result = json.dumps(result, default=str)
                else:
                    tool_result = json.dumps({"error": f"Unknown tool: {fn_name}"})

                print(f"[TOOL] {fn_name}({args}) → {tool_result[:500]}")

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result,
                })

            # Second call — LLM formulates answer using tool results
            final_response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                max_tokens=1024,
            )

            return {
                "response": final_response.choices[0].message.content,
                "tools_used": tools_used,
            }

        # No tools called — direct response
        return {
            "response": response_message.content or "I couldn't generate a response. Please try rephrasing your question.",
            "tools_used": [],
        }

    except Exception as e:
        print(f"[ERROR] chat failed: {e}")
        traceback.print_exc()
        raise
