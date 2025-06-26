import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

const Header = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };


  return (
    <header className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/research/new" className="text-2xl font-bold">DeepResearch</Link>
        <nav className="space-x-4">
          <Link to="/research/new" className="hover:text-gray-300">New Research</Link>
          <Link to="/my-research" className="hover:text-gray-300">My Research</Link>
          <button onClick={handleLogout} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
