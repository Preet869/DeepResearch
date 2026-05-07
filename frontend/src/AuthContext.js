import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { config, BETA_SIGNUP_FULL_MESSAGE } from './config';

if (!supabase) {
  console.warn('Supabase environment variables not found. Authentication will not work.');
}

const AuthContext = createContext();
export { AuthContext };

function computeResearchCreationBlocked(q) {
  if (!q.loaded) return true;
  if (q.reports_quota_locked) return true;
  if (
    !q.is_admin &&
    q.reports_limit != null &&
    Number(q.reports_used) >= Number(q.reports_limit)
  ) {
    return true;
  }
  return false;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(null);
  const [usageQuota, setUsageQuota] = useState({
    loaded: false,
    is_admin: false,
    reports_quota_locked: false,
    reports_used: 0,
    reports_limit: null,
    reports_remaining: null,
  });

  const syncUsageQuotaFromApi = useCallback((data) => {
    if (!data || typeof data !== 'object') return;
    const isAdminUser = Boolean(data.is_admin);
    setUsageQuota({
      loaded: true,
      is_admin: isAdminUser,
      reports_quota_locked: Boolean(data.reports_quota_locked),
      reports_used: Number(data.reports_used) || 0,
      reports_limit: data.reports_limit == null ? null : Number(data.reports_limit),
      reports_remaining:
        data.reports_remaining == null ? null : Number(data.reports_remaining),
    });
    setIsAdmin(isAdminUser);
  }, []);

  const refreshUsageQuota = useCallback(
    async (accessToken) => {
      if (!accessToken) {
        setUsageQuota({
          loaded: true,
          is_admin: false,
          reports_quota_locked: false,
          reports_used: 0,
          reports_limit: null,
          reports_remaining: null,
        });
        setIsAdmin(false);
        return;
      }
      try {
        const res = await fetch(config.endpoints.usage, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          syncUsageQuotaFromApi(data);
        } else {
          setUsageQuota({
            loaded: true,
            is_admin: false,
            reports_quota_locked: false,
            reports_used: 0,
            reports_limit: null,
            reports_remaining: null,
          });
          setIsAdmin(false);
        }
      } catch {
        setUsageQuota({
          loaded: true,
          is_admin: false,
          reports_quota_locked: false,
          reports_used: 0,
          reports_limit: null,
          reports_remaining: null,
        });
        setIsAdmin(false);
      }
    },
    [syncUsageQuotaFromApi],
  );

  const researchCreationBlocked = useMemo(
    () => computeResearchCreationBlocked(usageQuota),
    [usageQuota],
  );

  useEffect(() => {
    const getSession = async () => {
      if (!supabase) {
        setLoading(false);
        setUsageQuota({
          loaded: true,
          is_admin: false,
          reports_quota_locked: false,
          reports_used: 0,
          reports_limit: null,
          reports_remaining: null,
        });
        setIsAdmin(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        setToken(session?.access_token ?? null);
        await refreshUsageQuota(session?.access_token ?? null);
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        setUser(session?.user ?? null);
        setToken(session?.access_token ?? null);
        await refreshUsageQuota(session?.access_token ?? null);
        setLoading(false);
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
    return undefined;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signUpWithBetaCap = async (data) => {
    if (!supabase) {
      return Promise.reject(new Error('Supabase not configured'));
    }
    const res = await fetch(config.endpoints.betaSignupStatus);
    if (!res.ok) {
      return Promise.reject(
        new Error('Signup availability could not be verified. Please try again later.'),
      );
    }
    const { signup_open: signupOpen } = await res.json();
    if (!signupOpen) {
      return Promise.reject(new Error(BETA_SIGNUP_FULL_MESSAGE));
    }
    return supabase.auth.signUp(data);
  };

  const signOut = async () => {
    if (!supabase) {
      return Promise.reject(new Error('Supabase not configured'));
    }
    await supabase.auth.signOut();
    await refreshUsageQuota(null);
  };

  const value = {
    signUp: signUpWithBetaCap,
    signIn: (data) =>
      supabase ? supabase.auth.signInWithPassword(data) : Promise.reject('Supabase not configured'),
    signOut,
    user,
    token,
    isAdmin,
    usageQuota,
    researchCreationBlocked,
    refreshUsageQuota,
    syncUsageQuotaFromApi,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
