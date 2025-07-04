import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from './Header';
import LayeredResearchDisplay from './LayeredResearchDisplay';

const ResearchPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState('');
  const [folderId, setFolderId] = useState(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [exportSelections, setExportSelections] = useState([]);
  const dropdownRef = useRef(null);

  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const loadConversation = useCallback(async (convoId) => {
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
  }, [token]);

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
  }, [searchParams, token, loadConversation]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update active node when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const userMessages = messages.filter(m => m.role === 'user');
      if (userMessages.length > 0) {
        setActiveNodeIndex(userMessages.length - 1);
      }
    }
  }, [messages]);

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

  // Timeline handlers
  const handleNodeSelect = (nodeIndex) => {
    setActiveNodeIndex(nodeIndex);
  };

  const handleAddFollowup = (query) => {
    setInputValue(query);
    // Auto-submit the follow-up
    handleSubmitFollowup(query);
  };

  const handleSubmitFollowup = async (query) => {
    if (!query.trim() || loading) return;

    setLoading(true);
    const userMessage = { role: 'user', content: query.trim() };
    setMessages(prev => [...prev, userMessage]);

    try {
      const requestBody = {
        prompt: query,
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

  const handleExportToggle = (nodeIndex) => {
    setExportSelections(prev => 
      prev.includes(nodeIndex) 
        ? prev.filter(i => i !== nodeIndex)
        : [...prev, nodeIndex]
    );
  };

  const handleFollowUp = (suggestion) => {
    setInputValue(suggestion);
    handleSubmitFollowup(suggestion);
  };

  // Export functions
  const exportToPDF = () => {
    if (messages.length === 0) return;
    
    const mainReport = messages.filter(m => m.role === 'assistant')[0];
    if (!mainReport) return;

    // Create a new window with print-friendly content
    const printWindow = window.open('', '_blank');
    const title = conversationTitle || 'Research Report';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 8.5in;
              margin: 0 auto;
              padding: 1in;
            }
            h1 { color: #1f2937; font-size: 24px; margin-bottom: 20px; }
            h2 { color: #374151; font-size: 20px; margin-top: 30px; margin-bottom: 15px; }
            p { margin: 12px 0; }
            @media print {
              body { margin: 0; padding: 0.5in; }
            }
          </style>
        </head>
        <body>
          <h1>📘 ${title}</h1>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; font-size: 14px; color: #6b7280;">
            Generated: ${new Date().toLocaleDateString()}
          </div>
          <div style="white-space: pre-wrap;">${mainReport.content}</div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const exportToMarkdown = () => {
    if (messages.length === 0) return;
    
    const mainReport = messages.filter(m => m.role === 'assistant')[0];
    if (!mainReport) return;

    const content = `# ${conversationTitle || 'Research Report'}\n\n${mainReport.content}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'research-report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    if (messages.length === 0) return;
    
    const data = {
      title: conversationTitle || 'Research Report',
      messages: messages,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'research-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isNewResearch = messages.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header - Back Button Only */}
        <div className="mb-6">
          <button
            onClick={goBackToDashboard}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            title="Back to Dashboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        </div>

        {/* Research Content */}
        <div className="space-y-6">
          {/* Welcome Section for New Research */}
          {isNewResearch && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="max-w-4xl mx-auto">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
          <LayeredResearchDisplay 
            messages={messages} 
            isLoading={loading}
            onFollowUp={handleFollowUp}
            activeNodeIndex={activeNodeIndex}
            onNodeSelect={handleNodeSelect}
            onAddFollowup={handleAddFollowup}
            exportSelections={exportSelections}
            onExportToggle={handleExportToggle}
          />

          {/* Loading State */}
          {loading && messages.length === 0 && (
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

        {/* Input Section - Compact Design */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10">
          <div className="max-w-7xl mx-auto">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center space-x-3">
                <div className="flex-1 relative">
                  <input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask a research question..."
                    className="w-full px-4 py-3 pr-16 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  
                  {/* Export Button - Only show when there are messages */}
                  {messages.length > 0 && (
                    <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
                      <div className="relative" ref={dropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowExportDropdown(!showExportDropdown)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                          title="Export options"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        
                        {/* Export Dropdown */}
                        {showExportDropdown && (
                          <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-44 z-20">
                            <button
                              onClick={() => {
                                exportToPDF();
                                setShowExportDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center text-xs"
                            >
                              <span className="mr-2">📄</span>
                              Export PDF
                            </button>
                            <button
                              onClick={() => {
                                exportToMarkdown();
                                setShowExportDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center text-xs"
                            >
                              <span className="mr-2">📝</span>
                              Markdown
                            </button>
                            <button
                              onClick={() => {
                                exportToJSON();
                                setShowExportDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center text-xs"
                            >
                              <span className="mr-2">💾</span>
                              JSON Data
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={!inputValue.trim() || loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center text-sm font-medium"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Research
                    </>
                  )}
                </button>
              </div>
              
              {/* Help text - smaller and more subtle */}
              {!isNewResearch && inputValue.length === 0 && (
                <div className="flex items-center justify-center mt-2 text-xs text-gray-500">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Press Enter to ask a follow-up question
                </div>
              )}
            </form>
          </div>
        </div>
        
        {/* Add bottom padding to prevent content from being hidden behind fixed input */}
        <div className="h-20"></div>
      </div>
    </div>
  );
};

export default ResearchPage; 