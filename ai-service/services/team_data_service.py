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
        query = sb.table("team_transactions").select("*").eq("room_id", room_id).eq("status", status)
        if start_date:
            query = query.gte("timestamp", start_date)
        if end_date:
            query = query.lte("timestamp", end_date)
        result = query.order("timestamp", desc=True).execute()
        transactions = result.data or []

        # Fetch profiles separately (no direct FK from team_transactions to profiles)
        if transactions:
            user_ids = list({t["added_by"] for t in transactions})
            profiles_result = sb.table("profiles").select("id, name, username").in_("id", user_ids).execute()
            profile_map = {p["id"]: p for p in (profiles_result.data or [])}
            for t in transactions:
                t["profiles"] = profile_map.get(t["added_by"])

        return transactions
    except Exception as e:
        print(f"get_team_transactions error: {e}")
        return []


def get_team_room(room_id: str):
    try:
        sb = get_supabase()
        result = sb.table("team_rooms").select("*").eq("id", room_id).maybe_single().execute()
        return result.data
    except Exception as e:
        print(f"get_team_room error: {e}")
        return None


def get_team_members(room_id: str):
    try:
        sb = get_supabase()
        result = sb.table("team_members").select("*").eq("room_id", room_id).execute()
        members = result.data or []

        if members:
            user_ids = list({m["user_id"] for m in members})
            profiles_result = sb.table("profiles").select("id, name, username").in_("id", user_ids).execute()
            profile_map = {p["id"]: p for p in (profiles_result.data or [])}
            for m in members:
                m["profiles"] = profile_map.get(m["user_id"])

        return members
    except Exception as e:
        print(f"get_team_members error: {e}")
        return []
