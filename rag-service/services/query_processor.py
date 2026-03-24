import json
from services.llm import chat_light


def preprocess_query(query: str) -> str:
    return query.strip()


def classify_query(query: str, business_type: str = "") -> dict:
    system_prompt = """You are a query classifier for a business consulting chatbot.
Classify the user query into ONE of these categories:
- finance: financial management, accounting, cash flow, budgeting, invoicing
- tax: tax planning, deductions, compliance, GST/VAT, filing
- marketing: marketing strategies, customer acquisition, branding, social media, SEO
- growth: business growth, scaling, strategy, product development, competition
- legal: legal matters, business structure, contracts, compliance, IP
- hr: hiring, team management, payroll, employee relations, culture
- technology: software, tools, automation, digital transformation, cybersecurity
- funding: loans, investors, grants, financing, bootstrapping
- general: general business advice or doesn't fit above categories

Respond ONLY in JSON: {"category": "...", "sub_topic": "brief description"}"""

    context = f"Business type: {business_type}\n" if business_type else ""

    response = chat_light(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"{context}Query: {query}"},
        ]
    )

    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(cleaned)
    except Exception:
        return {"category": "general", "sub_topic": query[:50]}


def generate_multi_queries(query: str, category: str = "general") -> list[str]:
    system_prompt = """Generate exactly 2 alternative search queries for a business knowledge base.
The queries should capture different aspects or phrasings of the original question.
Keep queries concise and specific to small/medium business context.
Respond ONLY as a JSON array: ["query 1", "query 2"]"""

    response = chat_light(
        [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Category: {category}\nOriginal query: {query}",
            },
        ]
    )

    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        queries = json.loads(cleaned)
        if isinstance(queries, list):
            return [str(q) for q in queries[:2]]
    except Exception:
        pass

    return []
