import { supabase } from "./client";

export async function getTransactions(businessId, { startDate, endDate } = {}) {
  try {
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("business_id", businessId)
      .order("timestamp", { ascending: false });

    if (startDate) query = query.gte("timestamp", startDate);
    if (endDate) query = query.lte("timestamp", endDate);

    const { data, error } = await query;
    if (error) throw error;
    return { transactions: data, error: null };
  } catch (error) {
    console.error("Get transactions error:", error.message);
    return { transactions: [], error };
  }
}

export async function addTransaction(transaction) {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .insert([transaction])
      .select()
      .single();
    if (error) throw error;
    return { transaction: data, error: null };
  } catch (error) {
    console.error("Add transaction error:", error.message);
    return { transaction: null, error };
  }
}

export async function addTransactionsBatch(transactions) {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .insert(transactions)
      .select();
    if (error) throw error;
    return { transactions: data, error: null };
  } catch (error) {
    console.error("Batch add transactions error:", error.message);
    return { transactions: [], error };
  }
}

export async function deleteTransaction(id) {
  try {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error("Delete transaction error:", error.message);
    return { error };
  }
}

export async function getCategories(businessId) {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select("category")
      .eq("business_id", businessId)
      .not("category", "is", null);
    if (error) throw error;
    const unique = [...new Set(data.map((d) => d.category).filter(Boolean))];
    return { categories: unique, error: null };
  } catch (error) {
    console.error("Get categories error:", error.message);
    return { categories: [], error };
  }
}
