import React from 'react';
import { useAuth } from './AuthContext';
import { config } from './config';

const DebugInfo = () => {
  const { user, token } = useAuth();

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '10px', 
      borderRadius: '5px', 
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 1000
    }}>
      <h4>Debug Info</h4>
      <div><strong>API URL:</strong> {config.API_BASE_URL}</div>
      <div><strong>User:</strong> {user ? user.email : 'Not logged in'}</div>
      <div><strong>Token:</strong> {token ? 'Present' : 'Missing'}</div>
      <div><strong>Environment:</strong> {process.env.NODE_ENV}</div>
      <div><strong>Supabase URL:</strong> {process.env.REACT_APP_SUPABASE_URL ? 'Set' : 'Missing'}</div>
      <div><strong>Supabase Key:</strong> {process.env.REACT_APP_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}</div>
    </div>
  );
};

export default DebugInfo;
