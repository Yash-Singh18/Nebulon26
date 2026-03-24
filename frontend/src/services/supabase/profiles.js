import { supabase } from "./client";

export async function getProfile(userId) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return { profile: data, error: null };
  } catch (error) {
    console.error("Get profile error:", error.message);
    return { profile: null, error };
  }
}

export async function createProfile(userId, profileData) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .insert([{ id: userId, ...profileData }])
      .select()
      .single();

    if (error) throw error;
    return { profile: data, error: null };
  } catch (error) {
    console.error("Create profile error:", error.message);
    return { profile: null, error };
  }
}
