import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from './Header';
import ResponseCard from './ResponseCard';

const ResearchPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState('');
  const [folderId, setFolderId] = useState(null);

  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const convoId = searchParams.get('convo_id');
    const folderIdParam = searchParams.get('folder_id');
    
    if (convoId) {
      setConversationId(parseInt(convoId));
      loadConversation(parseInt(convoId));
    }
    
    if (folderIdParam) {
      setFolderId(parseInt(folderIdParam));
    }
  }, [searchParams, token]);

  const loadConversation = async (convoId) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/messages/${convoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        
        // Get conversation title from first user message
        const firstUserMessage = data.find(msg => msg.role === 'user');
        if (firstUserMessage) {
          setConversationTitle(firstUserMessage.content.slice(0, 50) + '...');
        }
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    setLoading(true);
    const userMessage = { role: 'user', content: inputValue.trim() };
    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = inputValue.trim();
    setInputValue('');

    try {
      const requestBody = {
        prompt: currentInput,
        conversation_id: conversationId || undefined,
        folder_id: folderId || undefined
      };

      const response = await fetch('http://127.0.0.1:8000/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        
        if (!conversationId) {
          setConversationId(data.conversation_id);
          // Update URL to include conversation ID
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.set('convo_id', data.conversation_id);
          navigate(`/research?${newSearchParams.toString()}`, { replace: true });
        }
        
        if (data.new_messages && data.new_messages.length > 0) {
          setMessages(prev => [...prev, ...data.new_messages]);
        }
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        model_name: 'Error'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const goBackToDashboard = () => {
    navigate('/dashboard');
  };

  const isNewResearch = messages.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={goBackToDashboard}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isNewResearch ? 'New Research' : conversationTitle || 'Research Session'}
                </h1>
                <p className="text-gray-600">
                  {isNewResearch 
                    ? 'Start your research with AI-powered insights and data visualization'
                    : 'Continue your research conversation'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Research Content */}
        <div className="space-y-6">
          {/* Welcome Section for New Research */}
          {isNewResearch && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="max-w-2xl mx-auto">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">What would you like to research?</h2>
                <p className="text-gray-600 mb-8">
                  Ask any question and get comprehensive, academic-style reports with data visualizations and proper citations.
                </p>
                
                {/* Example Questions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {[
                    "Latest developments in renewable energy",
                    "Impact of AI on healthcare systems",
                    "Sustainable agriculture trends",
                    "Remote work productivity studies"
                  ].map((example, index) => (
                    <button
                      key={index}
                      onClick={() => setInputValue(example)}
                      className="p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                    >
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span className="text-sm text-gray-700">{example}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <ResponseCard key={index} message={message} />
          ))}

          {/* Loading State */}
          {loading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="flex items-center space-x-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <div>
                  <p className="font-medium text-gray-900">Researching your query...</p>
                  <p className="text-sm text-gray-600">Gathering information and generating insights</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Section */}
        <div className="mt-8 sticky bottom-0 bg-gray-50 pt-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask a research question..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="3"
                    disabled={loading}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || loading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Research
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {!isNewResearch && (
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Continue the conversation or ask a follow-up question
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResearchPage; 