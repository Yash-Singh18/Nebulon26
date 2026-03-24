import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createMissingConfigError() {
  return new Error(
    "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env."
  );
}

function createNoopQuery() {
  let proxy;

  proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve) =>
            resolve({
              data: null,
              error: createMissingConfigError(),
            });
        }

        return (..._args) => proxy;
      },
    }
  );

  return proxy;
}

function createFallbackSupabaseClient() {
  return {
    auth: {
      async signInWithOAuth() {
        return { data: null, error: createMissingConfigError() };
      },
      async signOut() {
        return { error: createMissingConfigError() };
      },
      async getSession() {
        return {
          data: { session: null },
          error: createMissingConfigError(),
        };
      },
      async getUser() {
        return {
          data: { user: null },
          error: createMissingConfigError(),
        };
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        };
      },
    },
    from() {
      return createNoopQuery();
    },
    rpc() {
      return createNoopQuery();
    },
    channel() {
      const channel = {
        on() {
          return channel;
        },
        subscribe() {
          return channel;
        },
        unsubscribe() {},
      };

      return channel;
    },
    removeChannel() {},
  };
}

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase URL or Anon Key is missing. Add them to frontend/.env."
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createFallbackSupabaseClient();
