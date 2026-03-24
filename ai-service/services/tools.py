import statistics
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from .data_service import get_transactions, get_business


def _resolve_dates(start_date: str = None, end_date: str = None, period: str = None):
    """Convert human-friendly period or ISO dates into actual ISO date strings."""
    now = datetime.now(timezone.utc)

    # If a period shorthand is given, use it
    if period:
        p = period.lower().strip()
        period_map = {
            "24h": timedelta(hours=24),
            "last_24h": timedelta(hours=24),
            "today": timedelta(hours=24),
            "7d": timedelta(days=7),
            "last_7d": timedelta(days=7),
            "week": timedelta(days=7),
            "last_week": timedelta(days=7),
            "30d": timedelta(days=30),
            "last_30d": timedelta(days=30),
            "month": timedelta(days=30),
            "last_month": timedelta(days=30),
            "90d": timedelta(days=90),
            "last_90d": timedelta(days=90),
            "6mo": timedelta(days=180),
            "last_6mo": timedelta(days=180),
            "6_months": timedelta(days=180),
            "1y": timedelta(days=365),
            "last_1y": timedelta(days=365),
            "year": timedelta(days=365),
            "last_year": timedelta(days=365),
            "all": None,
            "all_time": None,
        }
        delta = period_map.get(p)
        if delta is not None:
            return (now - delta).isoformat(), now.isoformat()
        else:
            return None, None  # all time

    # Try parsing provided dates
    resolved_start = None
    resolved_end = None

    if start_date:
        try:
            resolved_start = datetime.fromisoformat(start_date.replace("Z", "+00:00")).isoformat()
        except (ValueError, AttributeError):
            pass

    if end_date:
        try:
            resolved_end = datetime.fromisoformat(end_date.replace("Z", "+00:00")).isoformat()
        except (ValueError, AttributeError):
            resolved_end = now.isoformat()

    return resolved_start, resolved_end


async def get_financial_summary(business_id: str, start_date: str = None, end_date: str = None, period: str = None) -> dict:
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_transactions(business_id, s, e)

    if not txs:
        return {
            "total_income": 0, "total_expense": 0, "net_profit": 0,
            "transaction_count": 0, "avg_transaction": 0,
            "period_start": s, "period_end": e,
            "note": "No transactions found in this period"
        }

    income = sum(float(t["amount"]) for t in txs if t["type"] == "income")
    expense = sum(float(t["amount"]) for t in txs if t["type"] == "expense")
    amounts = [float(t["amount"]) for t in txs]

    return {
        "total_income": round(income, 2),
        "total_expense": round(expense, 2),
        "net_profit": round(income - expense, 2),
        "transaction_count": len(txs),
        "avg_transaction": round(sum(amounts) / len(amounts), 2),
        "period_start": s,
        "period_end": e,
    }


async def get_category_breakdown(business_id: str, start_date: str = None, end_date: str = None, period: str = None, tx_type: str = None) -> list:
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_transactions(business_id, s, e)
    if tx_type:
        txs = [t for t in txs if t["type"] == tx_type]

    cats = defaultdict(lambda: {"total": 0.0, "count": 0})
    for t in txs:
        cat = t.get("category") or "Uncategorized"
        cats[cat]["total"] += float(t["amount"])
        cats[cat]["count"] += 1

    grand_total = sum(c["total"] for c in cats.values()) or 1
    result = []
    for name, data in sorted(cats.items(), key=lambda x: x[1]["total"], reverse=True):
        result.append({
            "category": name,
            "total": round(data["total"], 2),
            "count": data["count"],
            "percentage": round(data["total"] / grand_total * 100, 1),
        })
    return result


async def get_time_trends(business_id: str, interval: str = "day", start_date: str = None, end_date: str = None, period: str = None) -> list:
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_transactions(business_id, s, e)

    buckets = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for t in txs:
        ts = t["timestamp"][:10]
        if interval == "month":
            key = ts[:7]
        elif interval == "week":
            d = datetime.fromisoformat(ts)
            key = f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"
        else:
            key = ts
        buckets[key][t["type"]] += float(t["amount"])

    result = []
    for p in sorted(buckets.keys()):
        data = buckets[p]
        result.append({
            "period": p,
            "income": round(data["income"], 2),
            "expense": round(data["expense"], 2),
            "net": round(data["income"] - data["expense"], 2),
        })
    return result


async def detect_anomalies(business_id: str, start_date: str = None, end_date: str = None, period: str = None) -> list:
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_transactions(business_id, s, e)
    if len(txs) < 4:
        return []

    by_cat = defaultdict(list)
    for t in txs:
        by_cat[t.get("category") or "Uncategorized"].append(t)

    anomalies = []
    for cat, items in by_cat.items():
        amounts = [float(t["amount"]) for t in items]
        if len(amounts) < 3:
            continue
        mean = statistics.mean(amounts)
        std = statistics.stdev(amounts)
        if std == 0:
            continue
        for t in items:
            z = abs(float(t["amount"]) - mean) / std
            if z > 2:
                anomalies.append({
                    "id": t["id"],
                    "amount": float(t["amount"]),
                    "type": t["type"],
                    "category": cat,
                    "timestamp": t["timestamp"],
                    "z_score": round(z, 2),
                    "category_mean": round(mean, 2),
                })

    return sorted(anomalies, key=lambda x: x["z_score"], reverse=True)


async def get_recent_transactions(business_id: str, limit: int = 20, tx_type: str = None, category: str = None, period: str = None, start_date: str = None, end_date: str = None) -> list:
    """Get recent transactions with optional filters."""
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_transactions(business_id, s, e)

    if tx_type:
        txs = [t for t in txs if t["type"] == tx_type]
    if category:
        txs = [t for t in txs if (t.get("category") or "").lower() == category.lower()]

    # Already sorted desc by timestamp from data_service
    limited = txs[:min(limit, 50)]

    return [
        {
            "amount": float(t["amount"]),
            "type": t["type"],
            "category": t.get("category") or "Uncategorized",
            "timestamp": t["timestamp"],
        }
        for t in limited
    ]


async def get_top_expenses(business_id: str, limit: int = 10, period: str = None, start_date: str = None, end_date: str = None, category: str = None) -> list:
    """Get the largest expenses, optionally filtered."""
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_transactions(business_id, s, e)
    expenses = [t for t in txs if t["type"] == "expense"]
    if category:
        expenses = [t for t in expenses if (t.get("category") or "").lower() == category.lower()]

    expenses.sort(key=lambda t: float(t["amount"]), reverse=True)
    return [
        {
            "amount": float(t["amount"]),
            "category": t.get("category") or "Uncategorized",
            "timestamp": t["timestamp"],
        }
        for t in expenses[:limit]
    ]


async def compare_periods(business_id: str, period1_start: str = None, period1_end: str = None, period2_start: str = None, period2_end: str = None) -> dict:
    """Compare financial metrics between two time periods."""
    txs1 = get_transactions(business_id, period1_start, period1_end)
    txs2 = get_transactions(business_id, period2_start, period2_end)

    def summarize(txs):
        income = sum(float(t["amount"]) for t in txs if t["type"] == "income")
        expense = sum(float(t["amount"]) for t in txs if t["type"] == "expense")
        return {"income": round(income, 2), "expense": round(expense, 2), "net": round(income - expense, 2), "count": len(txs)}

    s1 = summarize(txs1)
    s2 = summarize(txs2)

    def pct_change(old, new):
        if old == 0:
            return None
        return round(((new - old) / abs(old)) * 100, 1)

    return {
        "period_1": s1,
        "period_2": s2,
        "changes": {
            "income_change_pct": pct_change(s1["income"], s2["income"]),
            "expense_change_pct": pct_change(s1["expense"], s2["expense"]),
            "net_change_pct": pct_change(s1["net"], s2["net"]),
        },
    }


# Tool definitions for Groq function calling
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_financial_summary",
            "description": "Get overall financial summary: total income, expense, net profit, count. Use the 'period' parameter for easy time filtering.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "enum": ["24h", "7d", "30d", "90d", "6mo", "1y", "all"], "description": "Time period shorthand. Use this instead of start/end dates."},
                    "start_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                    "end_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_category_breakdown",
            "description": "Get income or expense breakdown by category with totals, counts, and percentages.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "enum": ["24h", "7d", "30d", "90d", "6mo", "1y", "all"], "description": "Time period shorthand."},
                    "tx_type": {"type": "string", "enum": ["income", "expense"], "description": "Filter by type"},
                    "start_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                    "end_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_time_trends",
            "description": "Get income/expense time series bucketed by day, week, or month.",
            "parameters": {
                "type": "object",
                "properties": {
                    "interval": {"type": "string", "enum": ["day", "week", "month"], "description": "Bucket interval (default: day)"},
                    "period": {"type": "string", "enum": ["24h", "7d", "30d", "90d", "6mo", "1y", "all"], "description": "Time period shorthand."},
                    "start_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                    "end_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "detect_anomalies",
            "description": "Detect anomalous/unusual transactions using z-score analysis per category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "enum": ["24h", "7d", "30d", "90d", "6mo", "1y", "all"], "description": "Time period shorthand."},
                    "start_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                    "end_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_transactions",
            "description": "Get a list of recent individual transactions. Use this when the user asks about specific transactions, recent activity, or when you need raw transaction data to calculate something.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max number of transactions to return (default 20, max 50)"},
                    "tx_type": {"type": "string", "enum": ["income", "expense"], "description": "Filter by type"},
                    "category": {"type": "string", "description": "Filter by category name"},
                    "period": {"type": "string", "enum": ["24h", "7d", "30d", "90d", "6mo", "1y", "all"], "description": "Time period shorthand."},
                    "start_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                    "end_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_top_expenses",
            "description": "Get the largest expense transactions, sorted by amount descending.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "How many to return (default 10)"},
                    "period": {"type": "string", "enum": ["24h", "7d", "30d", "90d", "6mo", "1y", "all"], "description": "Time period shorthand."},
                    "category": {"type": "string", "description": "Filter by category name"},
                    "start_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                    "end_date": {"type": "string", "description": "ISO date (only if period is not used)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_periods",
            "description": "Compare financial metrics between two time periods (e.g. this month vs last month).",
            "parameters": {
                "type": "object",
                "properties": {
                    "period1_start": {"type": "string", "description": "Start of first period (ISO date)"},
                    "period1_end": {"type": "string", "description": "End of first period (ISO date)"},
                    "period2_start": {"type": "string", "description": "Start of second period (ISO date)"},
                    "period2_end": {"type": "string", "description": "End of second period (ISO date)"},
                },
                "required": ["period1_start", "period1_end", "period2_start", "period2_end"],
            },
        },
    },
]

# Map names to functions
TOOL_FUNCTIONS = {
    "get_financial_summary": get_financial_summary,
    "get_category_breakdown": get_category_breakdown,
    "get_time_trends": get_time_trends,
    "detect_anomalies": detect_anomalies,
    "get_recent_transactions": get_recent_transactions,
    "get_top_expenses": get_top_expenses,
    "compare_periods": compare_periods,
}
