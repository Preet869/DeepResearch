import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from './supabaseClient';
import { config, BETA_SIGNUP_FULL_MESSAGE } from './config';

if (!supabase) {
  console.warn('Supabase environment variables not found. Authentication will not work.');
}

const AuthContext = createContext();
export { AuthContext };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  // null = not yet loaded, true = admin, false = regular user
  const [isAdmin, setIsAdmin] = useState(null);

  const fetchIsAdmin = async (accessToken) => {
    if (!accessToken) {
      setIsAdmin(false);
      return;
    }
    try {
      const res = await fetch(config.endpoints.usage, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(Boolean(data.is_admin));
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const getSession = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        setToken(session?.access_token ?? null);
        await fetchIsAdmin(session?.access_token ?? null);
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          setUser(session?.user ?? null);
          setToken(session?.access_token ?? null);
          await fetchIsAdmin(session?.access_token ?? null);
          setLoading(false);
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
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

  const value = {
    signUp: signUpWithBetaCap,
    signIn: (data) => supabase ? supabase.auth.signInWithPassword(data) : Promise.reject('Supabase not configured'),
    signOut: () => supabase ? supabase.auth.signOut() : Promise.reject('Supabase not configured'),
    user,
    token,
    isAdmin,
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