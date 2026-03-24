import { supabase } from "./client";

export async function getTeamTransactions(roomId, { status, startDate, endDate } = {}) {
  try {
    let query = supabase
      .from("team_transactions")
      .select("*")
      .eq("room_id", roomId)
      .order("timestamp", { ascending: false });

    if (status) query = query.eq("status", status);
    if (startDate) query = query.gte("timestamp", startDate);
    if (endDate) query = query.lte("timestamp", endDate);

    const { data, error } = await query;
    if (error) throw error;
    return { transactions: data, error: null };
  } catch (error) {
    console.error("Get team transactions error:", error.message);
    return { transactions: [], error };
  }
}

export async function addTeamTransactionsBatch(transactions) {
  try {
    const { data, error } = await supabase
      .from("team_transactions")
      .insert(transactions)
      .select();
    if (error) throw error;
    return { transactions: data, error: null };
  } catch (error) {
    console.error("Batch add team transactions error:", error.message);
    return { transactions: [], error };
  }
}

export async function addTeamTransaction(transaction) {
  try {
    const { data, error } = await supabase
      .from("team_transactions")
      .insert([transaction])
      .select()
      .single();
    if (error) throw error;
    return { transaction: data, error: null };
  } catch (error) {
    console.error("Add team transaction error:", error.message);
    return { transaction: null, error };
  }
}

export async function approveTransaction(id, approverId) {
  try {
    const { data, error } = await supabase
      .from("team_transactions")
      .update({ status: "approved", approved_by: approverId })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return { transaction: data, error: null };
  } catch (error) {
    console.error("Approve transaction error:", error.message);
    return { transaction: null, error };
  }
}

export async function rejectTransaction(id, approverId) {
  try {
    const { data, error } = await supabase
      .from("team_transactions")
      .update({ status: "rejected", approved_by: approverId })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return { transaction: data, error: null };
  } catch (error) {
    console.error("Reject transaction error:", error.message);
    return { transaction: null, error };
  }
}

export async function deleteTeamTransaction(id) {
  try {
    const { error } = await supabase
      .from("team_transactions")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error("Delete team transaction error:", error.message);
    return { error };
  }
}

export async function getPendingTransactions(roomId) {
  try {
    const { data, error } = await supabase
      .from("team_transactions")
      .select("*")
      .eq("room_id", roomId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { transactions: data, error: null };
  } catch (error) {
    console.error("Get pending transactions error:", error.message);
    return { transactions: [], error };
  }
}
