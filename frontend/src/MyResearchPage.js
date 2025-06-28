import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from './Header';
import { useAuth } from './AuthContext';

const MyResearchPage = () => {
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    const fetchConversations = async () => {
      if (!token) return;
      try {
        const response = await fetch('http://127.0.0.1:8000/conversations', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setConversations(data);
        } else {
          setError('Failed to fetch conversations.');
        }
      } catch (e) {
        setError('An error occurred while fetching conversations.');
        console.error(e);
      }
    };
    fetchConversations();
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">My Research</h1>
        {error && <p className="text-red-500">{error}</p>}
        <div className="bg-white rounded-lg shadow">
          <ul className="divide-y divide-gray-200">
            {conversations.map((convo) => (
              <li key={convo.id} className="p-4 hover:bg-gray-50">
                <Link to={`/?convo_id=${convo.id}`} className="block">
                  <h2 className="font-semibold">{convo.title}</h2>
                  <p className="text-sm text-gray-500">
                    {new Date(convo.created_at).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
};

export default MyResearchPage; 