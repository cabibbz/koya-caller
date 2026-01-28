/**
 * useAuth Hook
 * Client-side hook for auth state management
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AuthState, KoyaUser } from "@/types/auth";
import type { Session } from "@supabase/supabase-js";

export function useAuth(): AuthState & {
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    tenantId: null,
    isAdmin: false,
  });

  const supabase = createClient();

  const updateState = useCallback((session: Session | null) => {
    const user = session?.user as KoyaUser | null;
    
    setState({
      user,
      session: session as AuthState["session"],
      isLoading: false,
      isAuthenticated: !!user,
      tenantId: user?.app_metadata?.tenant_id ?? null,
      isAdmin: user?.app_metadata?.is_admin === true,
    });
  }, []);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      updateState(session);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        updateState(session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, updateState]);

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      tenantId: null,
      isAdmin: false,
    });
  }, [supabase.auth]);

  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.refreshSession();
    updateState(session);
  }, [supabase.auth, updateState]);

  return {
    ...state,
    signOut,
    refreshSession,
  };
}
