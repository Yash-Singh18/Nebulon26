import os
from supabase import create_client

_client = None


def get_supabase():
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        _client = create_client(url, key)
    return _client


def get_team_transactions(room_id: str, start_date: str = None, end_date: str = None, status: str = "approved"):
    try:
        sb = get_supabase()
        query = sb.table("team_transactions").select(
            "*, profiles:added_by(id, name, username)"
        ).eq("room_id", room_id).eq("status", status)
        if start_date:
            query = query.gte("timestamp", start_date)
        if end_date:
            query = query.lte("timestamp", end_date)
        result = query.order("timestamp", desc=True).execute()
        return result.data or []
    except Exception:
        return []


def get_team_room(room_id: str):
    try:
        sb = get_supabase()
        result = sb.table("team_rooms").select("*").eq("id", room_id).maybe_single().execute()
        return result.data
    except Exception:
        return None


def get_team_members(room_id: str):
    try:
        sb = get_supabase()
        result = sb.table("team_members").select(
            "*, profiles:user_id(id, name, username)"
        ).eq("room_id", room_id).execute()
        return result.data or []
    except Exception:
        return []
