import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from './Header';
import { useAuth } from './AuthProvider';
import { supabase } from './supabaseClient'; // We need this for the session

const MyResearchPage = () => {
  const { session } = useAuth();
  const [researches, setResearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!session) return;

      try {
        const response = await fetch('http://127.0.0.1:8000/conversations', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch research data.');
        }

        const data = await response.json();
        setResearches(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [session]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">My Research</h1>
        
        {loading && <p>Loading research...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <ul className="space-y-4">
              {researches.length > 0 ? (
                researches.map((convo) => (
                  <Link to={`/research/${convo.id}`} key={convo.id}>
                    <li className="p-4 border rounded-md hover:bg-gray-50 cursor-pointer">
                      <p className="font-semibold text-lg">{convo.title}</p>
                      <p className="text-sm text-gray-500">
                        Created on: {new Date(convo.created_at).toLocaleString()}
                      </p>
                    </li>
                  </Link>
                ))
              ) : (
                <p>You have no saved research yet.</p>
              )}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyResearchPage;