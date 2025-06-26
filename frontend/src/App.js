import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import MainPage from './MainPage';
import { useAuth } from './AuthProvider';
import './App.css';
import MyResearchPage from './MyResearchPage';

function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={!session ? <LoginPage /> : <Navigate to="/research/new" />} 
        />
        <Route 
          path="/research/new" 
          element={session ? <MainPage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/research/:conversationId" 
          element={session ? <MainPage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/my-research" 
          element={session ? <MyResearchPage /> : <Navigate to="/" />} 
        />
      </Routes>
    </Router>
  );
}

export default App;
