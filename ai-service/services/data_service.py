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


def get_transactions(business_id: str, start_date: str = None, end_date: str = None):
    try:
        sb = get_supabase()
        query = sb.table("transactions").select("*").eq("business_id", business_id)
        if start_date:
            query = query.gte("timestamp", start_date)
        if end_date:
            query = query.lte("timestamp", end_date)
        result = query.order("timestamp", desc=True).execute()
        return result.data or []
    except Exception:
        return []


def get_business(business_id: str):
    try:
        sb = get_supabase()
        result = sb.table("businesses").select("*").eq("id", business_id).maybe_single().execute()
        return result.data
    except Exception:
        return None
