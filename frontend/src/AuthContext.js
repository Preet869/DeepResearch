import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from './supabaseClient';

if (!supabase) {
  console.warn('Supabase environment variables not found. Authentication will not work.');
}

const AuthContext = createContext();
export { AuthContext };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

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
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(
        (event, session) => {
          setUser(session?.user ?? null);
          setToken(session?.access_token ?? null);
          setLoading(false);
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const value = {
    signUp: (data) => supabase ? supabase.auth.signUp(data) : Promise.reject('Supabase not configured'),
    signIn: (data) => supabase ? supabase.auth.signInWithPassword(data) : Promise.reject('Supabase not configured'),
    signOut: () => supabase ? supabase.auth.signOut() : Promise.reject('Supabase not configured'),
    user,
    token,
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