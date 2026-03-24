import statistics
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from .team_data_service import get_team_transactions, get_team_room, get_team_members


def _resolve_dates(start_date: str = None, end_date: str = None, period: str = None):
    now = datetime.now(timezone.utc)
    if period:
        p = period.lower().strip()
        period_map = {
            "24h": timedelta(hours=24), "last_24h": timedelta(hours=24), "today": timedelta(hours=24),
            "7d": timedelta(days=7), "last_7d": timedelta(days=7), "week": timedelta(days=7),
            "30d": timedelta(days=30), "last_30d": timedelta(days=30), "month": timedelta(days=30),
            "90d": timedelta(days=90), "6mo": timedelta(days=180), "1y": timedelta(days=365),
            "all": None, "all_time": None,
        }
        delta = period_map.get(p)
        if delta is not None:
            return (now - delta).isoformat(), now.isoformat()
        return None, None
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


async def get_team_financial_summary(room_id: str, period: str = None, start_date: str = None, end_date: str = None) -> dict:
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_team_transactions(room_id, s, e)
    if not txs:
        return {"total_income": 0, "total_expense": 0, "net_profit": 0, "transaction_count": 0, "avg_transaction": 0,
                "period_start": s, "period_end": e, "note": "No approved transactions found"}
    income = sum(float(t["amount"]) for t in txs if t["type"] == "income")
    expense = sum(float(t["amount"]) for t in txs if t["type"] == "expense")
    amounts = [float(t["amount"]) for t in txs]
    return {
        "total_income": round(income, 2), "total_expense": round(expense, 2),
        "net_profit": round(income - expense, 2), "transaction_count": len(txs),
        "avg_transaction": round(sum(amounts) / len(amounts), 2),
        "period_start": s, "period_end": e,
    }


async def get_team_category_breakdown(room_id: str, period: str = None, tx_type: str = None, start_date: str = None, end_date: str = None) -> list:
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_team_transactions(room_id, s, e)
    if tx_type:
        txs = [t for t in txs if t["type"] == tx_type]
    cats = defaultdict(lambda: {"total": 0.0, "count": 0})
    for t in txs:
        cat = t.get("category") or "Uncategorized"
        cats[cat]["total"] += float(t["amount"])
        cats[cat]["count"] += 1
    grand_total = sum(c["total"] for c in cats.values()) or 1
    return sorted(
        [{"category": name, "total": round(d["total"], 2), "count": d["count"],
          "percentage": round(d["total"] / grand_total * 100, 1)} for name, d in cats.items()],
        key=lambda x: x["total"], reverse=True
    )


async def get_team_member_spending(room_id: str, period: str = None, start_date: str = None, end_date: str = None) -> list:
    """Get spending breakdown by team member."""
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_team_transactions(room_id, s, e)
    members = get_team_members(room_id)

    member_map = {}
    for m in members:
        p = m.get("profiles") or {}
        member_map[m["user_id"]] = {
            "name": p.get("name") or p.get("username") or "Unknown",
            "username": p.get("username") or "",
            "department": m.get("department") or "No Dept",
        }

    by_user = defaultdict(lambda: {"income": 0.0, "expense": 0.0, "count": 0})
    for t in txs:
        uid = t["added_by"]
        by_user[uid][t["type"]] += float(t["amount"])
        by_user[uid]["count"] += 1

    result = []
    for uid, data in by_user.items():
        info = member_map.get(uid, {"name": "Unknown", "username": "", "department": "N/A"})
        result.append({
            "user": info["name"],
            "username": info["username"],
            "department": info["department"],
            "income": round(data["income"], 2),
            "expense": round(data["expense"], 2),
            "net": round(data["income"] - data["expense"], 2),
            "transaction_count": data["count"],
        })
    return sorted(result, key=lambda x: x["expense"], reverse=True)


async def get_department_breakdown(room_id: str, period: str = None, start_date: str = None, end_date: str = None) -> list:
    """Get spending breakdown by department."""
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_team_transactions(room_id, s, e)
    members = get_team_members(room_id)

    user_dept = {}
    for m in members:
        user_dept[m["user_id"]] = m.get("department") or "No Department"

    by_dept = defaultdict(lambda: {"income": 0.0, "expense": 0.0, "count": 0, "members": set()})
    for t in txs:
        dept = user_dept.get(t["added_by"], "Unknown")
        by_dept[dept][t["type"]] += float(t["amount"])
        by_dept[dept]["count"] += 1
        by_dept[dept]["members"].add(t["added_by"])

    return sorted(
        [{"department": dept, "income": round(d["income"], 2), "expense": round(d["expense"], 2),
          "net": round(d["income"] - d["expense"], 2), "transaction_count": d["count"],
          "member_count": len(d["members"])} for dept, d in by_dept.items()],
        key=lambda x: x["expense"], reverse=True
    )


async def get_team_recent_transactions(room_id: str, limit: int = 20, tx_type: str = None, category: str = None, period: str = None, start_date: str = None, end_date: str = None) -> list:
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_team_transactions(room_id, s, e)
    if tx_type:
        txs = [t for t in txs if t["type"] == tx_type]
    if category:
        txs = [t for t in txs if (t.get("category") or "").lower() == category.lower()]
    limited = txs[:min(limit, 50)]
    return [
        {
            "amount": float(t["amount"]), "type": t["type"],
            "category": t.get("category") or "Uncategorized", "timestamp": t["timestamp"],
            "added_by": (t.get("profiles") or {}).get("username") or (t.get("profiles") or {}).get("name") or "Unknown",
        }
        for t in limited
    ]


async def get_team_top_expenses(room_id: str, limit: int = 10, period: str = None, category: str = None, start_date: str = None, end_date: str = None) -> list:
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_team_transactions(room_id, s, e)
    expenses = [t for t in txs if t["type"] == "expense"]
    if category:
        expenses = [t for t in expenses if (t.get("category") or "").lower() == category.lower()]
    expenses.sort(key=lambda t: float(t["amount"]), reverse=True)
    return [
        {
            "amount": float(t["amount"]),
            "category": t.get("category") or "Uncategorized",
            "timestamp": t["timestamp"],
            "added_by": (t.get("profiles") or {}).get("username") or (t.get("profiles") or {}).get("name") or "Unknown",
        }
        for t in expenses[:limit]
    ]


async def detect_team_anomalies(room_id: str, period: str = None, start_date: str = None, end_date: str = None) -> list:
    s, e = _resolve_dates(start_date, end_date, period)
    txs = get_team_transactions(room_id, s, e)
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
                    "amount": float(t["amount"]), "type": t["type"], "category": cat,
                    "timestamp": t["timestamp"], "z_score": round(z, 2), "category_mean": round(mean, 2),
                    "added_by": (t.get("profiles") or {}).get("username") or "Unknown",
                })
    return sorted(anomalies, key=lambda x: x["z_score"], reverse=True)


async def get_team_info(room_id: str) -> dict:
    """Get team room info with member list."""
    room = get_team_room(room_id)
    members = get_team_members(room_id)
    member_list = []
    for m in members:
        p = m.get("profiles") or {}
        member_list.append({
            "name": p.get("name") or p.get("username") or "Unknown",
            "username": p.get("username") or "",
            "department": m.get("department") or "No Dept",
            "role": m.get("role", "member"),
        })
    return {
        "room_name": room.get("name", "Unknown") if room else "Unknown",
        "member_count": len(members),
        "members": member_list,
    }


# Tool registry
TEAM_TOOL_FUNCTIONS = {
    "get_team_financial_summary": get_team_financial_summary,
    "get_team_category_breakdown": get_team_category_breakdown,
    "get_team_member_spending": get_team_member_spending,
    "get_department_breakdown": get_department_breakdown,
    "get_team_recent_transactions": get_team_recent_transactions,
    "get_team_top_expenses": get_team_top_expenses,
    "detect_team_anomalies": detect_team_anomalies,
    "get_team_info": get_team_info,
}
