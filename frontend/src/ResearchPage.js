import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from './Header';
import LayeredResearchDisplay from './LayeredResearchDisplay';
import ExportManager from './components/ExportManager';
import CitationHelper from './components/CitationHelper';
import Analytics from './components/Analytics';
import ResearchLibrary from './components/ResearchLibrary';
import { config } from './config';
import { apiFetch, AUTH_REQUIRED, getSupabaseAccessToken } from './apiClient';
import analyticsService from './services/analyticsService';
import { Icon, PIPELINE_STEP_DOT_COLORS, pipelineStepDotStyle } from './components/shared';
import { useAuth } from './AuthContext';

function IntroSettingPill({ icon, label }) {
  return (
    <span
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid var(--line-strong)',
        background: 'var(--bg-2)',
        color: 'var(--mut)',
        letterSpacing: '.04em',
      }}
    >
      {icon} {label}
    </span>
  );
}

/** Large serif card + pills + Investigate (matches intro; optional PDF export in toolbar row). */
function ResearchQueryComposer({
  value,
  onChange,
  onSubmit,
  loading,
  autoFocus = false,
  placeholder,
  hintText = 'Enter to send · Shift + Enter for a new line',
  showExport = false,
  exportDropdownRef,
  showExportDropdown,
  onToggleExport,
  onExportPdf,
  formClassName = '',
  submitDisabled,
}) {
  const quotaLocked = submitDisabled === true;
  const disabled =
    loading || !String(value || '').trim() || quotaLocked;

  return (
    <form onSubmit={onSubmit} className={formClassName}>
      <div
        style={{
          padding: 18,
          borderRadius: 16,
          background: 'var(--card)',
          border: '1px solid var(--line-strong)',
          boxShadow: '0 30px 60px -30px rgba(124, 92, 255, 0.4)',
        }}
      >
        <textarea
          value={value}
          onChange={onChange}
          autoFocus={autoFocus}
          rows={3}
          placeholder={placeholder}
          disabled={loading || quotaLocked}
          className="placeholder:opacity-55"
          style={{
            width: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--fg)',
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 'clamp(22px, 3.2vw, 28px)',
            lineHeight: 1.25,
            letterSpacing: '-0.01em',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!disabled) {
                onSubmit(e);
              }
            }
          }}
        />
        <div className="mt-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <IntroSettingPill icon="◇" label="Depth · standard" />
            <IntroSettingPill icon="◯" label="Tone · academic" />
            <IntroSettingPill icon="✱" label="Cite · APA" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showExport && (
              <div className="relative" ref={exportDropdownRef}>
                <button
                  type="button"
                  onClick={onToggleExport}
                  className="mono flex items-center justify-center rounded-xl px-2 py-2 transition-colors border border-transparent hover:bg-[var(--bg-2)] hover:border-[var(--line)]"
                  style={{ color: 'var(--mut)' }}
                  title="Export"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </button>
                {showExportDropdown && (
                  <div
                    className="absolute bottom-full right-0 mb-2 rounded-xl py-1 min-w-[11rem] z-30 border shadow-lg"
                    style={{
                      background: 'var(--card)',
                      borderColor: 'var(--line-strong)',
                      boxShadow: '0 16px 40px -12px rgba(0,0,0,0.2)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={onExportPdf}
                      className="mono w-full text-left px-3 py-2.5 flex items-center gap-2 text-xs transition-colors hover:bg-[var(--bg-2)]"
                      style={{ color: 'var(--fg)' }}
                    >
                      <span>📄</span>
                      Export PDF
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={disabled}
              className="btn btn-new-research flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45 shrink-0"
              style={{ borderRadius: 9999 }}
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Investigate
                  <Icon.Arrow />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <p
        className="mono mt-2.5 text-center text-[11px] sm:text-left"
        style={{ color: 'var(--mut2)', letterSpacing: '0.04em' }}
      >
        {hintText}
      </p>
    </form>
  );
}

const ResearchPage = () => {
  const { researchCreationBlocked, refreshUsageQuota, usageQuota } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState('');
  const [folderId, setFolderId] = useState(null);
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [exportSelections, setExportSelections] = useState([]);
  const [expandedFollowUpSlot, setExpandedFollowUpSlot] = useState(null);
  const [customFollowUpQuery, setCustomFollowUpQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportManager, setShowExportManager] = useState(false);
  const [showCitationHelper, setShowCitationHelper] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showResearchLibrary, setShowResearchLibrary] = useState(false);
  const [pageStartTime] = useState(Date.now());

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await getSupabaseAccessToken();
      if (!t || cancelled) return;
      await refreshUsageQuota(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUsageQuota]);

  const convoIdFromUrl = searchParams.get('convo_id');
  /** Immersive first step: no sidebar until the user sends a query (unless opening an existing conversation). */
  const showFullScreenIntro = messages.length === 0 && !convoIdFromUrl;

  const loadConversation = useCallback(async (convoId) => {
    const startTime = Date.now();
    try {
      const response = await apiFetch(config.endpoints.messages(convoId));
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        
        // Get conversation title from first user message
        const firstUserMessage = data.find(msg => msg.role === 'user');
        if (firstUserMessage) {
          setConversationTitle(firstUserMessage.content.slice(0, 50) + '...');
        }

        // Track conversation load
        analyticsService.track('conversation_loaded', {
          conversation_id: convoId,
          messages_count: data.length,
          load_time_ms: Date.now() - startTime,
          has_title: !!firstUserMessage
        });
      }
    } catch (error) {
      if (error?.message !== AUTH_REQUIRED && error?.code !== AUTH_REQUIRED) {
        console.error('Error loading conversation:', error);
        analyticsService.trackError('conversation_load_failed', error.message, error.stack, {
          conversation_id: convoId
        });
      }
    }
  }, []);

  useEffect(() => {
    const convoId = searchParams.get('convo_id');
    const folderIdParam = searchParams.get('folder_id');
    
    // Track page view
    analyticsService.trackPageView('research_page', {
      has_conversation_id: !!convoId,
      has_folder_id: !!folderIdParam,
      is_new_research: !convoId
    });
    
    if (convoId) {
      setConversationId(parseInt(convoId));
      loadConversation(parseInt(convoId));
    }
    
    if (folderIdParam) {
      setFolderId(parseInt(folderIdParam));
    }

    // Cleanup function to track page exit
    return () => {
      analyticsService.track('research_page_exit', {
        time_on_page_ms: Date.now() - pageStartTime,
        conversation_id: conversationId,
        messages_sent: messages.filter(m => m.role === 'user').length,
        tools_used: {
          export_manager: showExportManager,
          citation_helper: showCitationHelper,
          analytics: showAnalytics,
          research_library: showResearchLibrary
        }
      });
    };
  }, [searchParams, loadConversation]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (researchCreationBlocked || !inputValue.trim() || loading) return;

    const startTime = Date.now();
    const queryText = inputValue.trim();
    const isNewResearch = !conversationId;
    
    setLoading(true);
    const userMessage = { role: 'user', content: queryText };
    setMessages(prev => [...prev, userMessage]);
    
    // Track research initiation
    if (isNewResearch) {
      analyticsService.trackResearchStart(null, queryText, folderId);
    } else {
      analyticsService.trackSearch(queryText, { folder_id: folderId }, 'research_followup');
    }
    
    setInputValue('');

    try {
      const requestBody = {
        prompt: queryText,
        conversation_id: conversationId || undefined,
        folder_id: folderId || undefined
      };

      const response = await apiFetch(config.endpoints.research, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        const processingTime = Date.now() - startTime;
        
        if (!conversationId) {
          setConversationId(data.conversation_id);
          // Update URL to include conversation ID
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.set('convo_id', data.conversation_id);
          navigate(`/research?${newSearchParams.toString()}`, { replace: true });
          
          // Update the research started event with the actual conversation ID
          analyticsService.trackResearchStart(data.conversation_id, queryText, folderId);
        }
        
        if (data.new_messages && data.new_messages.length > 0) {
          setMessages(prev => [...prev, ...data.new_messages]);
          
          // Track successful research response
          analyticsService.trackSearchResults(
            queryText,
            data.new_messages.length,
            processingTime,
            data.sources || []
          );
        }
        const t = await getSupabaseAccessToken();
        if (t) await refreshUsageQuota(t);
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      console.error('Error:', error);
      analyticsService.trackError('research_request_failed', error.message, error.stack, {
        query: queryText,
        conversation_id: conversationId,
        is_new_research: isNewResearch
      });
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        model_name: 'Error'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResearch = async () => {
    if (!conversationId) return;

    try {
      const response = await apiFetch(`${config.endpoints.conversations}/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        
        // Track research deletion
        analyticsService.track('research_deleted', {
          conversation_id: conversationId,
          messages_count: messages.length,
          session_duration_ms: Date.now() - pageStartTime
        });
        
        // Show success message briefly before navigating
        alert(data.message);
        navigate('/dashboard');
      } else {
        throw new Error('Failed to delete research');
      }
    } catch (error) {
      console.error('Error deleting research:', error);
      analyticsService.trackError('research_delete_failed', error.message, error.stack, {
        conversation_id: conversationId
      });
      alert('Failed to delete research. Please try again.');
    } finally {
      setShowDeleteModal(false);
    }
  };

  // Timeline handlers
  const handleNodeSelect = (nodeIndex) => {
    setExpandedFollowUpSlot(null);
    setCustomFollowUpQuery('');
    setActiveNodeIndex(nodeIndex);

    // Track timeline navigation
    analyticsService.trackContentInteraction('timeline_node', 'selected', {
      node_index: nodeIndex,
      conversation_id: conversationId,
      total_nodes: messages.filter(m => m.role === 'user').length
    });
  };

  const handleAddFollowup = (query) => {
    setInputValue(query);
    // Auto-submit the follow-up
    handleSubmitFollowup(query);
  };

  const handleFollowUpSlotClick = (slot) => {
    const userMessages = messages.filter(m => m.role === 'user');
    if (researchCreationBlocked && userMessages.length <= slot) return;
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

  const handleFollowUpSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (researchCreationBlocked || !customFollowUpQuery.trim() || loading) return;

    setExpandedFollowUpSlot(null);
    handleAddFollowup(customFollowUpQuery);
    setCustomFollowUpQuery('');
  };

  const handleFollowUpCancel = () => {
    setExpandedFollowUpSlot(null);
    setCustomFollowUpQuery('');
  };

  const handleSubmitFollowup = async (query) => {
    if (researchCreationBlocked || !query.trim() || loading) return;

    setLoading(true);
    const userMessage = { role: 'user', content: query.trim() };
    setMessages(prev => [...prev, userMessage]);

    try {
      const requestBody = {
        prompt: query,
        conversation_id: conversationId || undefined,
        folder_id: folderId || undefined
      };

      const response = await apiFetch(`${config.API_BASE_URL}/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        const t = await getSupabaseAccessToken();
        if (t) await refreshUsageQuota(t);
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
    if (researchCreationBlocked) return;
    setInputValue(suggestion);
    handleSubmitFollowup(suggestion);
  };

  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const betaDepthCap =
    usageQuota.reports_limit != null ? Number(usageQuota.reports_limit) : 5;

  const showFollowUpSlotPanel =
    expandedFollowUpSlot !== null && userMessageCount < expandedFollowUpSlot + 1;
  /** Sidebar: original report row is "current" only when not composing a follow-up in another slot. */
  const originalReportTimelineActive =
    userMessageCount > 0 && expandedFollowUpSlot === null && activeNodeIndex === 0;
  const followUpViewingReport = (slot) =>
    userMessageCount > slot && expandedFollowUpSlot === null && activeNodeIndex === slot;

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header />
      
      <div className="flex-1 flex flex-col min-h-0 px-4 sm:px-6 lg:px-8 pt-4 pb-0 overflow-hidden">
        {showFullScreenIntro ? (
          /* Full-screen question step — no timeline sidebar */
          <div
            className="flex-1 flex flex-col min-h-0 overflow-y-auto dot-paper rounded-xl border border-[var(--line)]"
            style={{ minHeight: 'calc(100vh - 5.5rem)' }}
          >
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 lg:px-12 py-8 md:py-14">
              <div className="w-full max-w-4xl mx-auto">
                <span className="sticker">
                  <span className="dot" /> new investigation
                </span>
                <h1
                  className="serif"
                  style={{
                    margin: '20px 0 0',
                    fontSize: 'clamp(40px, 8vw, 88px)',
                    lineHeight: 0.95,
                    letterSpacing: '-.025em',
                    color: 'var(--fg)',
                  }}
                >
                  What do you want to <span style={{ fontStyle: 'italic', color: 'var(--violet)' }}>know</span>?
                </h1>
                <p
                  style={{
                    marginTop: 18,
                    fontSize: 17,
                    lineHeight: 1.5,
                    color: 'var(--mut)',
                    maxWidth: 640,
                    fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, sans-serif',
                  }}
                >
                  Ask your research question in plain English. We&apos;ll handle the rest — sources,
                  structure, citations, charts.
                </p>

                {researchCreationBlocked ? (
                  <div
                    className="mt-7 rounded-2xl border px-6 py-8"
                    style={{
                      background: 'var(--card)',
                      borderColor: 'var(--line-strong)',
                      maxWidth: 560,
                    }}
                  >
                    <p className="serif text-xl" style={{ color: 'var(--fg)', margin: 0, lineHeight: 1.45 }}>
                      That&apos;s{' '}
                      <b style={{ color: 'var(--fg)' }}>
                        {betaDepthCap} {betaDepthCap === 1 ? 'report' : 'reports'}
                      </b>{' '}
                      deep — beta cap. Deletes won&apos;t refill.
                    </p>
                    <button
                      type="button"
                      className="btn btn-new-research mt-5"
                      style={{ borderRadius: 9999 }}
                      onClick={() => navigate('/dashboard')}
                    >
                      Back to library
                    </button>
                  </div>
                ) : (
                  <ResearchQueryComposer
                    formClassName="mt-7"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onSubmit={handleSubmit}
                    loading={loading}
                    autoFocus
                    placeholder="e.g. How are personalized neoantigen vaccines reshaping melanoma treatment outcomes?"
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          /* After the first query (or when resuming via convo_id): sidebar + main */
          <div className="flex gap-6 flex-1 min-h-0 items-stretch">
          {/* Left sidebar: shell fills column height; body scrolls inside the card */}
          <div className="w-80 flex-shrink-0 min-h-0 flex flex-col self-stretch">
            <div
              className="rounded-xl shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden"
              style={{ background: 'var(--card)', border: '1px solid var(--line-strong)' }}
            >
              <div className="flex-1 min-h-0 overflow-y-auto dashboard-scroll p-6">
              {/* Timeline Tracker */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--fg)' }}>Research Timeline</h3>
                <div className="space-y-3">
                  {/* Original Research */}
                  <button
                    onClick={() => messages.filter(m => m.role === 'user').length > 0 ? handleNodeSelect(0) : null}
                    disabled={messages.filter(m => m.role === 'user').length === 0}
                    className={`w-full flex items-center p-3 rounded-lg border transition-colors ${
                      messages.filter(m => m.role === 'user').length > 0
                        ? activeNodeIndex === 0
                          ? 'cursor-pointer'
                          : 'cursor-pointer'
                        : 'cursor-not-allowed opacity-80'
                    }`}
                    style={
                      messages.filter(m => m.role === 'user').length > 0
                        ? originalReportTimelineActive
                          ? { background: 'var(--bg-2)', borderColor: 'var(--violet)', borderWidth: 1 }
                          : { background: 'var(--paper)', borderColor: 'var(--line)' }
                        : { background: 'var(--bg-2)', borderColor: 'var(--line)' }
                    }
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 mono"
                      style={
                        messages.filter(m => m.role === 'user').length > 0
                          ? pipelineStepDotStyle(PIPELINE_STEP_DOT_COLORS[0], {
                              emphasize: originalReportTimelineActive,
                            })
                          : { background: 'var(--line-strong)', color: 'var(--mut)' }
                      }
                    >
                      1
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--fg)' }}>
                        {(() => {
                          const userMessages = messages.filter(m => m.role === 'user');
                          const firstUserMessage = userMessages[0];
                          if (firstUserMessage) {
                            return firstUserMessage.content;
                          }
                          return 'Original Research';
                        })()}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--mut)' }}>
                        {messages.filter(m => m.role === 'user').length > 0 
                          ? originalReportTimelineActive ? 'Currently Viewing' : 'Click to View'
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
                      className="w-full flex items-center p-3 rounded-lg border transition-colors cursor-pointer"
                      style={
                        messages.filter(m => m.role === 'user').length > slot
                          ? followUpViewingReport(slot)
                            ? { background: 'var(--bg-2)', borderColor: 'var(--violet)' }
                            : { background: 'var(--paper)', borderColor: 'var(--line)' }
                          : expandedFollowUpSlot === slot
                            ? { background: 'var(--bg-2)', borderColor: 'var(--violet)', boxShadow: '0 1px 4px rgba(124,92,255,.15)' }
                            : { background: 'var(--paper)', borderColor: 'var(--line)' }
                      }
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 mono"
                        style={
                          messages.filter(m => m.role === 'user').length > slot
                            ? pipelineStepDotStyle(PIPELINE_STEP_DOT_COLORS[slot], {
                                emphasize: followUpViewingReport(slot),
                              })
                            : { background: 'var(--line-strong)', color: 'var(--mut)' }
                        }
                      >
                        {messages.filter(m => m.role === 'user').length > slot ? '✓' : `${slot + 1}`}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--fg)' }}>
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
                        <div className="text-xs" style={{ color: 'var(--mut)' }}>
                          {messages.filter(m => m.role === 'user').length > slot 
                            ? followUpViewingReport(slot) ? 'Currently Viewing' : 'Click to View'
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
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--fg)' }}>Research Tools</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => {
                      setShowExportManager(true);
                      analyticsService.trackFeatureUsage('export_manager', 'opened', {
                        conversation_id: conversationId,
                        messages_count: messages.length,
                        selections_count: Object.values(exportSelections).filter(Boolean).length
                      });
                    }}
                    className="w-full p-3 text-left rounded-lg transition-colors hover:opacity-95"
                    style={{ border: '1px solid var(--line)', background: 'var(--paper)' }}
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-3" style={{ color: 'var(--mut)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    onClick={() => {
                      setShowCitationHelper(true);
                      analyticsService.trackFeatureUsage('citation_helper', 'opened', {
                        conversation_id: conversationId,
                        messages_count: messages.length
                      });
                    }}
                    className="w-full p-3 text-left rounded-lg transition-colors hover:opacity-95"
                    style={{ border: '1px solid var(--line)', background: 'var(--paper)' }}
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-3" style={{ color: 'var(--mut)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium">Citation Helper</span>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setShowAnalytics(true);
                      analyticsService.trackFeatureUsage('analytics', 'opened', {
                        conversation_id: conversationId,
                        messages_count: messages.length
                      });
                    }}
                    className="w-full p-3 text-left rounded-lg transition-colors hover:opacity-95"
                    style={{ border: '1px solid var(--line)', background: 'var(--paper)' }}
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-3" style={{ color: 'var(--mut)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-sm font-medium">Analytics</span>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setShowResearchLibrary(true);
                      analyticsService.trackFeatureUsage('research_library', 'opened', {
                        conversation_id: conversationId,
                        messages_count: messages.length
                      });
                    }}
                    className="w-full p-3 text-left rounded-lg transition-colors hover:opacity-95"
                    style={{ border: '1px solid var(--line)', background: 'var(--paper)' }}
                  >
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-3" style={{ color: 'var(--mut)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          </div>

          {/* Right Main Content Area */}
          <div className="flex-1 min-w-0 min-h-0 self-stretch overflow-y-auto overflow-x-hidden dashboard-scroll dot-paper rounded-xl border border-[var(--line)]">
            <div className="pb-6">
              {/* Research Content */}
              <div className="space-y-6 p-4 sm:p-5">
                  {/* Resuming a conversation from URL before messages load */}
                  {messages.length === 0 && convoIdFromUrl && (
                    <div
                      className="flex flex-col items-center justify-center py-24 px-4"
                      style={{ color: 'var(--mut)' }}
                    >
                      <div
                        className="animate-spin rounded-full h-10 w-10 border-2 border-transparent mb-4"
                        style={{ borderTopColor: 'var(--violet)', borderRightColor: 'var(--violet)' }}
                      />
                      <p className="mono text-sm">Loading conversation…</p>
                    </div>
                  )}

                  {/* Research Content - Tab-like behavior */}
                  {messages.length > 0 && (
                    <>
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

                      {showFollowUpSlotPanel && (
                        <div
                          className="rounded-xl p-6 sm:p-8"
                          style={{
                            background: 'var(--card)',
                            border: '1px solid var(--line-strong)',
                            boxShadow: '0 24px 48px -28px rgba(124, 92, 255, 0.22)',
                          }}
                        >
                          <div className="max-w-4xl mx-auto">
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-4 min-w-0">
                                <div
                                  className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center mono text-sm font-semibold"
                                  style={{
                                    background: 'var(--bg-2)',
                                    border: '1px solid var(--line-strong)',
                                    color: 'var(--violet)',
                                  }}
                                >
                                  {expandedFollowUpSlot + 1}
                                </div>
                                <div className="min-w-0">
                                  <h2 className="serif text-xl sm:text-2xl" style={{ color: 'var(--fg)' }}>
                                    Add follow-up {expandedFollowUpSlot + 1}
                                  </h2>
                                  <p className="text-sm mt-1" style={{ color: 'var(--mut)' }}>
                                    Continue your investigation with a new question
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={handleFollowUpCancel}
                                className="shrink-0 p-2 rounded-lg transition-colors mono text-sm"
                                style={{ color: 'var(--mut2)' }}
                                aria-label="Close follow-up"
                              >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

                            <div className="mb-8">
                              <h3 className="mono text-xs mb-4" style={{ color: 'var(--mut2)', letterSpacing: '0.06em' }}>
                                SUGGESTED PROMPTS
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {generateSuggestedPrompts().map((prompt, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    disabled={researchCreationBlocked}
                                    onClick={() => handleSuggestedPromptSelect(prompt)}
                                    className="p-4 rounded-xl transition-colors text-left"
                                    style={{
                                      background: 'var(--paper)',
                                      border: '1px solid var(--line)',
                                      color: 'var(--fg)',
                                      opacity: researchCreationBlocked ? 0.45 : 1,
                                      cursor: researchCreationBlocked ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    <div className="flex items-start gap-3">
                                      <svg
                                        className="w-5 h-5 mt-0.5 flex-shrink-0"
                                        style={{ color: 'var(--violet)' }}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                        />
                                      </svg>
                                      <span className="text-sm leading-snug" style={{ color: 'var(--mut)' }}>
                                        {prompt}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <ResearchQueryComposer
                              value={customFollowUpQuery}
                              onChange={(e) => setCustomFollowUpQuery(e.target.value)}
                              onSubmit={handleFollowUpSubmit}
                              loading={loading}
                              submitDisabled={researchCreationBlocked}
                              placeholder="Enter your follow-up research question…"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
          </div>
          </div>
        )}
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

      {showAnalytics && (
        <Analytics
          messages={messages}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {showResearchLibrary && (
        <ResearchLibrary onClose={() => setShowResearchLibrary(false)} />
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