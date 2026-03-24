import { supabase } from "./client";

export async function getBusinesses() {
  try {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { businesses: data, error: null };
  } catch (error) {
    console.error("Get businesses error:", error.message);
    return { businesses: [], error };
  }
}

export async function getBusiness(id) {
  try {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return { business: data, error: null };
  } catch (error) {
    console.error("Get business error:", error.message);
    return { business: null, error };
  }
}

export async function createBusiness(businessData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("businesses")
      .insert([{ owner_id: user.id, ...businessData }])
      .select()
      .single();
    if (error) throw error;
    return { business: data, error: null };
  } catch (error) {
    console.error("Create business error:", error.message);
    return { business: null, error };
  }
}

export async function updateBusiness(id, updates) {
  try {
    const { data, error } = await supabase
      .from("businesses")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return { business: data, error: null };
  } catch (error) {
    console.error("Update business error:", error.message);
    return { business: null, error };
  }
}

export async function deleteBusiness(id) {
  try {
    const { error } = await supabase
      .from("businesses")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error("Delete business error:", error.message);
    return { error };
  }
}
