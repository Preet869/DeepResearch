import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import PromptInput from './PromptInput';
import LayeredResearchDisplay from './LayeredResearchDisplay';
import ResearchTimeline from './components/ResearchTimeline';
import { useAuth } from './AuthContext';

// We will add other components like ResultsDisplay here later

const MainPage = () => {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [exportSelections, setExportSelections] = useState([]);
  const { token } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const convoId = searchParams.get('convo_id');
    if (convoId) {
      setConversationId(parseInt(convoId));
      fetchMessages(parseInt(convoId));
    } else {
      setMessages([]);
      setConversationId(null);
    }
  }, [location.search, token]);

  const fetchMessages = async (convoId) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/messages/${convoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      } else {
        console.error("Failed to fetch messages");
        setMessages([]);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptSubmit = async (prompt) => {
    if (!token) {
      console.error("Authentication token not found.");
      return;
    }
    setIsLoading(true);

    const requestBody = { prompt, conversation_id: conversationId };

    try {
      const response = await fetch('http://127.0.0.1:8000/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Received from backend:', data);

        if (!conversationId) {
          setConversationId(data.conversation_id);
        }
        
        fetchMessages(data.conversation_id);

      } else {
        const errorData = await response.json();
        console.error('Error from backend:', errorData.detail);
      }
    } catch (error) {
      console.error('Error submitting prompt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowUp = (suggestion) => {
    handlePromptSubmit(suggestion);
  };

  const handleNodeSelect = (nodeIndex) => {
    setActiveNodeIndex(nodeIndex);
  };

  const handleAddFollowup = (query) => {
    handlePromptSubmit(query);
  };

  const handleExportToggle = (nodeIndex) => {
    setExportSelections(prev => 
      prev.includes(nodeIndex) 
        ? prev.filter(i => i !== nodeIndex)
        : [...prev, nodeIndex]
    );
  };

  // Update active node when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const userMessages = messages.filter(m => m.role === 'user');
      if (userMessages.length > 0) {
        setActiveNodeIndex(userMessages.length - 1);
      }
    }
  }, [messages]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto flex flex-col">
        {/* Main Content */}
        <div className="flex-grow overflow-y-auto">
          <LayeredResearchDisplay 
            messages={messages} 
            isLoading={isLoading} 
            onFollowUp={handleFollowUp}
            activeNodeIndex={activeNodeIndex}
            onNodeSelect={handleNodeSelect}
            onAddFollowup={handleAddFollowup}
            exportSelections={exportSelections}
            onExportToggle={handleExportToggle}
          />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-7xl mx-auto">
            <PromptInput onSubmit={handlePromptSubmit} isLoading={isLoading} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainPage; 