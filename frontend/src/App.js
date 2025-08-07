import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Dashboard from './Dashboard';
import ResearchPage from './ResearchPage';
import ComparisonPage from './ComparisonPage';
import LoginPage from './LoginPage';
import DebugInfo from './DebugInfo';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

const ErrorFallback = () => (
  <div style={{ 
    padding: '20px', 
    textAlign: 'center', 
    fontFamily: 'Arial, sans-serif',
    maxWidth: '600px',
    margin: '50px auto'
  }}>
    <h1>🚀 DeepResearch</h1>
    <p>Welcome to DeepResearch! This is a research assistant application.</p>
    <p>Please configure the following environment variables in Vercel:</p>
    <ul style={{ textAlign: 'left', display: 'inline-block' }}>
      <li><code>REACT_APP_SUPABASE_URL</code> - Your Supabase project URL</li>
      <li><code>REACT_APP_SUPABASE_ANON_KEY</code> - Your Supabase anonymous key</li>
      <li><code>REACT_APP_API_URL</code> - Your Railway backend URL</li>
    </ul>
    <p>Once configured, the application will work properly.</p>
  </div>
);

function App() {
  // Check if required environment variables are missing
  const missingVars = [];
  if (!process.env.REACT_APP_SUPABASE_URL) missingVars.push('REACT_APP_SUPABASE_URL');
  if (!process.env.REACT_APP_SUPABASE_ANON_KEY) missingVars.push('REACT_APP_SUPABASE_ANON_KEY');
  if (!process.env.REACT_APP_API_URL) missingVars.push('REACT_APP_API_URL');

  if (missingVars.length > 0) {
    return <ErrorFallback />;
  }

  return (
    <AuthProvider>
      <Router>
        {process.env.NODE_ENV === 'development' && <DebugInfo />}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/research" 
            element={
              <ProtectedRoute>
                <ResearchPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/compare" 
            element={
              <ProtectedRoute>
                <ComparisonPage />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
