import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from './Header';
import LayeredResearchDisplay from './LayeredResearchDisplay';
import ExportManager from './components/ExportManager';
import CitationHelper from './components/CitationHelper';
import SourceTracker from './components/SourceTracker';
import Analytics from './components/Analytics';
import Schedule from './components/Schedule';
import ResearchLibrary from './components/ResearchLibrary';

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
  const [expandedFollowUpSlot, setExpandedFollowUpSlot] = useState(null);
  const [customFollowUpQuery, setCustomFollowUpQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportManager, setShowExportManager] = useState(false);
  const [showCitationHelper, setShowCitationHelper] = useState(false);
  const [showSourceTracker, setShowSourceTracker] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showResearchLibrary, setShowResearchLibrary] = useState(false);
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

  const handleDeleteResearch = async () => {
    if (!conversationId) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Show success message briefly before navigating
        alert(data.message);
        navigate('/dashboard');
      } else {
        throw new Error('Failed to delete research');
      }
    } catch (error) {
      console.error('Error deleting research:', error);
      alert('Failed to delete research. Please try again.');
    } finally {
      setShowDeleteModal(false);
    }
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

  const handleFollowUpSlotClick = (slot) => {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length > slot) {
      // If slot has content, navigate to it
      handleNodeSelect(slot);
    } else {
      // If slot is empty, expand the follow-up section
      setExpandedFollowUpSlot(expandedFollowUpSlot === slot ? null : slot);
      // Clear any existing custom query when switching slots
      setCustomFollowUpQuery('');
    }
  };

  const generateSuggestedPrompts = () => {
    if (messages.length === 0) return [];
    
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const originalQuery = lastUserMessage?.content || '';
    
    return [
      `What are the potential risks and challenges with ${originalQuery.toLowerCase()}?`,
      `How does this compare to alternative approaches?`,
      `What are the economic implications of ${originalQuery.toLowerCase()}?`,
      `What are the latest developments in this field?`,
      `What are the ethical considerations involved?`,
      `How might this evolve in the next 5-10 years?`
    ];
  };

  const handleSuggestedPromptSelect = (prompt) => {
    setCustomFollowUpQuery(prompt);
  };

  const handleFollowUpSubmit = () => {
    if (!customFollowUpQuery.trim()) return;
    
    setExpandedFollowUpSlot(null);
    handleAddFollowup(customFollowUpQuery);
    setCustomFollowUpQuery('');
  };

  const handleFollowUpCancel = () => {
    setExpandedFollowUpSlot(null);
    setCustomFollowUpQuery('');
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
    <div className="h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-4 overflow-hidden">
        {/* Header - Back Button Only */}
        <div className="mb-3">
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

        {/* Dashboard Layout */}
        <div className="flex gap-6" style={{ height: 'calc(100vh - 200px)' }}>
          {/* Left Sidebar - Research Dashboard */}
          <div className="w-80 flex-shrink-0 overflow-y-auto dashboard-scroll">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 min-h-full">
              {/* Timeline Tracker */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Research Timeline</h3>
                <div className="space-y-3">
                  {/* Original Research */}
                  <button
                    onClick={() => messages.filter(m => m.role === 'user').length > 0 ? handleNodeSelect(0) : null}
                    disabled={messages.filter(m => m.role === 'user').length === 0}
                    className={`w-full flex items-center p-3 rounded-lg border transition-colors ${
                      messages.filter(m => m.role === 'user').length > 0
                        ? activeNodeIndex === 0
                          ? 'bg-blue-100 border-blue-300 hover:bg-blue-200'
                          : 'bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer'
                        : 'bg-gray-50 border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 ${
                      messages.filter(m => m.role === 'user').length > 0
                        ? activeNodeIndex === 0
                          ? 'bg-blue-700 text-white'
                          : 'bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      1
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {(() => {
                          const userMessages = messages.filter(m => m.role === 'user');
                          const firstUserMessage = userMessages[0];
                          if (firstUserMessage) {
                            return firstUserMessage.content;
                          }
                          return 'Original Research';
                        })()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {messages.filter(m => m.role === 'user').length > 0 
                          ? activeNodeIndex === 0 ? 'Currently Viewing' : 'Click to View'
                          : 'Ready to start'}
                      </div>
                    </div>
                    {exportSelections[0] && (
                      <div className="ml-2 text-green-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                        </svg>
                      </div>
                    )}
                  </button>

                  {/* Follow-up Slots */}
                  {[1, 2, 3].map((slot) => (
                    <button
                      key={slot}
                      onClick={() => handleFollowUpSlotClick(slot)}
                      className={`w-full flex items-center p-3 rounded-lg border transition-colors ${
                        messages.filter(m => m.role === 'user').length > slot 
                          ? activeNodeIndex === slot
                            ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                            : 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer'
                          : expandedFollowUpSlot === slot
                            ? 'bg-purple-100 border-purple-300 shadow-sm'
                            : 'bg-purple-50 border-purple-200 hover:bg-purple-100 cursor-pointer'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 ${
                        messages.filter(m => m.role === 'user').length > slot 
                          ? activeNodeIndex === slot
                            ? 'bg-blue-600 text-white'
                            : 'bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        {messages.filter(m => m.role === 'user').length > slot ? '✓' : `${slot + 1}`}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {(() => {
                            const userMessages = messages.filter(m => m.role === 'user');
                            const userMessage = userMessages[slot];
                            if (userMessage) {
                              return userMessage.content;
                            }
                            return userMessages.length > slot 
                              ? `Follow-up ${slot + 1}`
                              : `Follow-up ${slot + 1}`;
                          })()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {messages.filter(m => m.role === 'user').length > slot 
                            ? activeNodeIndex === slot ? 'Currently Viewing' : 'Click to View'
                            : expandedFollowUpSlot === slot ? 'Adding Follow-up' : `Click to Add Follow-up`}
                        </div>
                      </div>
                      {exportSelections[slot] && (
                        <div className="ml-2 text-green-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Research Tools Panel */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Research Tools</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => setShowExportManager(true)}
                    className="w-full p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium">Export Manager</span>
                      {Object.values(exportSelections).some(Boolean) && (
                        <span className="ml-auto text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {Object.values(exportSelections).filter(Boolean).length} selected
                        </span>
                      )}
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => setShowCitationHelper(true)}
                    className="w-full p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium">Citation Helper</span>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => setShowSourceTracker(true)}
                    className="w-full p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="text-sm font-medium">Source Tracker</span>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => setShowAnalytics(true)}
                    className="w-full p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-sm font-medium">Analytics</span>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => setShowSchedule(true)}
                    className="w-full p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium">Schedule</span>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => setShowResearchLibrary(true)}
                    className="w-full p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span className="text-sm font-medium">Research Library</span>
                    </div>
                  </button>
                  
                  {/* Delete Research Button - Only show if conversation exists */}
                  {conversationId && (
                    <button 
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full p-3 text-left rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="text-sm font-medium text-red-700">Delete Research</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Main Content Area */}
          <div className="flex-1 min-w-0 overflow-y-auto dashboard-scroll">
            <div className="pb-6 min-h-full">
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

                {/* Research Content - Tab-like behavior */}
                {!isNewResearch && (
                  <>
                    {/* Show main research content only when no follow-up slot is expanded */}
                    {expandedFollowUpSlot === null && (
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
                    )}
                    
                    {/* Follow-up Research Tab - Replaces main content when expanded */}
                    {(() => {
                      const userMessageCount = messages.filter(m => m.role === 'user').length;
                      const shouldShow = expandedFollowUpSlot !== null && userMessageCount < expandedFollowUpSlot + 1;
                      console.log('Follow-up section debug:', {
                        expandedFollowUpSlot,
                        userMessageCount,
                        shouldShow
                      });
                      return shouldShow;
                    })() && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                        <div className="max-w-4xl mx-auto">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center">
                              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                                <span className="text-lg font-bold text-purple-600">{expandedFollowUpSlot + 1}</span>
                              </div>
                              <div>
                                <h2 className="text-xl font-bold text-gray-900">Add Follow-up Research {expandedFollowUpSlot + 1}</h2>
                                <p className="text-gray-600">Continue your research with a new question</p>
                              </div>
                            </div>
                            <button
                              onClick={handleFollowUpCancel}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          {/* Suggested Follow-up Questions */}
                          <div className="mb-8">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggested Follow-up Questions:</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {generateSuggestedPrompts().map((prompt, index) => (
                                <button
                                  key={index}
                                  onClick={() => handleSuggestedPromptSelect(prompt)}
                                  className="p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 hover:border-purple-300"
                                >
                                  <div className="flex items-start">
                                    <svg className="w-5 h-5 text-purple-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    <span className="text-sm text-gray-700">{prompt}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Custom Follow-up Input */}
                          <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                              Or write your own follow-up question:
                            </label>
                            <textarea
                              value={customFollowUpQuery}
                              onChange={(e) => setCustomFollowUpQuery(e.target.value)}
                              placeholder="Enter your follow-up research question..."
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                              rows={3}
                            />
                          </div>

                          {/* Action Buttons */}
                          <div className="flex justify-end space-x-4">
                            <button
                              onClick={handleFollowUpCancel}
                              className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleFollowUpSubmit}
                              disabled={!customFollowUpQuery.trim()}
                              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                              Start Research
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

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
            </div>
          </div>
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

      {/* Tool Modals */}
      {showExportManager && (
        <ExportManager
          messages={messages}
          conversationTitle={conversationTitle}
          exportSelections={exportSelections}
          onClose={() => setShowExportManager(false)}
        />
      )}

      {showCitationHelper && (
        <CitationHelper
          messages={messages}
          onClose={() => setShowCitationHelper(false)}
        />
      )}

      {showSourceTracker && (
        <SourceTracker
          messages={messages}
          onClose={() => setShowSourceTracker(false)}
        />
      )}

      {showAnalytics && (
        <Analytics
          messages={messages}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {showSchedule && (
        <Schedule
          messages={messages}
          onClose={() => setShowSchedule(false)}
        />
      )}

      {showResearchLibrary && (
        <ResearchLibrary
          messages={messages}
          onClose={() => setShowResearchLibrary(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Research</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this research? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteResearch}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchPage; 