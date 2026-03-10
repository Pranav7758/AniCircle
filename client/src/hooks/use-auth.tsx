import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { queryClient } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  username: string | null;
  shortId: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isRecoveryMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  clearRecoveryMode: () => void;
  loginWithGoogle: () => Promise<void>;
  session: Session | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let profileFetchTimeout: NodeJS.Timeout | null = null;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        
        setSession(session);
        if (session?.user) {
          // Start profile fetch with timeout
          profileFetchTimeout = setTimeout(() => {
            console.warn("Profile fetch timeout");
            if (isMounted) {
              setUser({
                id: session.user.id,
                email: session.user.email || "",
                username: session.user.user_metadata?.full_name || "User",
                shortId: null,
              });
              setIsLoading(false);
            }
          }, 3000);
          
          try {
            await fetchProfile(session.user.id, session.user.email, session.user.user_metadata?.full_name);
            if (profileFetchTimeout && isMounted) {
              clearTimeout(profileFetchTimeout);
            }
          } catch (err) {
            console.error("Profile fetch error:", err);
            if (isMounted) {
              setUser({
                id: session.user.id,
                email: session.user.email || "",
                username: session.user.user_metadata?.full_name || "User",
                shortId: null,
              });
              setIsLoading(false);
            }
          }
        } else {
          setUser(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error getting session:", error);
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        console.log("Auth event:", event);
        
        if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
          setIsLoading(false);
          if (profileFetchTimeout) clearTimeout(profileFetchTimeout);
          return;
        }
        
        if (event === "PASSWORD_RECOVERY") {
          setIsRecoveryMode(true);
          return;
        }
        
        // Handle sign in events
        if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
          fetchProfile(session.user.id, session.user.email, session.user.user_metadata?.full_name);
        }
      }
    );

    return () => {
      isMounted = false;
      if (profileFetchTimeout) clearTimeout(profileFetchTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string, email?: string, displayName?: string) => {
    // Set basic user immediately to unblock UI
    const basicUser = {
      id: userId,
      email: email || "",
      username: displayName || email?.split("@")[0] || "User",
      shortId: null as string | null,
    };
    
    setUser(basicUser);
    setIsLoading(false);

    // Fetch full profile in background (don't block on this)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error && error.code === "PGRST116") {
        // Profile doesn't exist, create it
        const username = displayName || email?.split("@")[0] || "User";
        const { data: newProfile } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            email: email || "",
            username: username,
          })
          .select()
          .single();

        if (newProfile) {
          setUser({
            id: newProfile.id,
            email: newProfile.email || "",
            username: newProfile.username,
            shortId: newProfile.short_id,
          });
        }
      } else if (data) {
        setUser({
          id: data.id,
          email: data.email || "",
          username: data.username,
          shortId: data.short_id,
        });
      }
    } catch (error) {
      console.error("Background profile fetch error:", error);
      // Don't block - user is already set
    }
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const register = async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        email: email,
        username: username,
      });

      if (profileError) {
        console.error("Error creating profile:", profileError);
      }
    }
  };

  const logout = async () => {
    try {
      queryClient.clear();
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      setUser(null);
      setSession(null);
      setIsLoading(false);
      if (error) {
        console.error("Logout error:", error);
      }
    } catch (error) {
      console.error("Logout error:", error);
      setUser(null);
      setSession(null);
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?type=recovery`,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const clearRecoveryMode = () => {
    setIsRecoveryMode(false);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isRecoveryMode, login, register, logout, resetPassword, updatePassword, clearRecoveryMode, loginWithGoogle, session }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
