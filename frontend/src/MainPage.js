import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Header from './Header';
import PromptInput from './PromptInput';
import ResultsDisplay from './ResultsDisplay';
import { useAuth } from './AuthProvider';

const MainPage = () => {
  const { session } = useAuth();
  const { conversationId: paramId } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(paramId || null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (paramId && session) {
        setIsLoading(true);
        try {
          const response = await fetch(`http://127.0.0.1:8000/messages/${paramId}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          });
          if (!response.ok) throw new Error('Failed to fetch conversation history.');
          const data = await response.json();
          setMessages(data);
        } catch (error) {
          console.error(error);
          alert(error.message);
        } finally {
          setIsLoading(false);
        }
      } else {
        setMessages([]);
        setConversationId(null);
      }
    };

    fetchHistory();
  }, [paramId, session]);

  const handlePromptSubmit = async (prompt) => {
    if (!session) {
      alert('You must be logged in to perform research.');
      return;
    }

    setIsLoading(true);

    const userMessage = {
      role: 'user',
      content: prompt,
      created_at: new Date().toISOString(),
    };

    // For a new conversation, we clear old messages
    if (!conversationId) {
        setMessages([userMessage]);
    } else {
        setMessages(prev => [...prev, userMessage]);
    }

    try {
      // We no longer clear results, we will append to them
      const response = await fetch('http://127.0.0.1:8000/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          prompt,
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Revert optimistic update on error
        setMessages(prev => prev.slice(0, prev.length - 1));
        throw new Error(errorData.detail || 'Something went wrong');
      }

      const data = await response.json();
      setConversationId(data.conversation_id);
      
      // We replace the optimistic user message with the server-confirmed one,
      // and append the new AI messages.
      setMessages(prev => {
        const optimisticState = prev.slice(0, prev.length - 1);
        return [...optimisticState, ...data.new_messages];
      });


    } catch (error) {
      console.error('Error submitting prompt:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="container mx-auto p-4">
        <PromptInput onSubmit={handlePromptSubmit} isLoading={isLoading} />
        <div className="mt-8">
          {/* We now pass the array of messages to ResultsDisplay */}
          <ResultsDisplay isLoading={isLoading} messages={messages} />
        </div>
      </main>
    </div>
  );
};

export default MainPage;