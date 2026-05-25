import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from './Header';
import LayeredResearchDisplay from './LayeredResearchDisplay';
import ExportManager from './components/ExportManager';
import { getResearchTurns } from './utils/researchExportTurns';
import CitationHelper from './components/CitationHelper';
import Analytics from './components/Analytics';
import ResearchLibrary from './components/ResearchLibrary';
import OnboardingTooltip from './components/OnboardingTooltip';
import { config, MAX_COMPARISON_FOLLOWUPS } from './config';
import { apiFetch, AUTH_REQUIRED, getSupabaseAccessToken } from './apiClient';
import analyticsService from './services/analyticsService';
import { Icon, PIPELINE_STEP_DOT_COLORS, pipelineStepDotStyle } from './components/shared';
import { useAuth } from './AuthContext';

// Research question examples for rotating placeholder
const RESEARCH_EXAMPLES = [
  "e.g., What study designs are best for researching vaccine effectiveness?",
  "e.g., How do observational studies handle confounding variables?",
  "e.g., What are the main causes of academic burnout in university students?",
  "e.g., How does carbon pricing affect industrial emissions?",
];

// Hook for rotating placeholder text with typing animation
function useRotatingPlaceholder(examples, intervalMs = 5000) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    if (examples.length <= 1) {
      setDisplayText(examples[0] || '');
      setIsTyping(false);
      setShowCursor(false);
      return;
    }

    const currentText = examples[currentIndex];
    let charIndex = 0;
    setDisplayText('');
    setIsTyping(true);
    setShowCursor(false);

    // Typing animation
    const typeInterval = setInterval(() => {
      if (charIndex < currentText.length) {
        setDisplayText(currentText.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        setShowCursor(true);
        
        // Wait longer before erasing - calculate time needed for full typing + display time
        const typingTime = currentText.length * 75;
        const displayTime = Math.max(3000, intervalMs - typingTime); // Ensure at least 3s display after typing
        
        setTimeout(() => {
          setShowCursor(false);
          // Quick erase effect
          let eraseIndex = currentText.length;
          const eraseInterval = setInterval(() => {
            if (eraseIndex > 0) {
              setDisplayText(currentText.slice(0, eraseIndex));
              eraseIndex--;
            } else {
              clearInterval(eraseInterval);
              setCurrentIndex((prevIndex) => (prevIndex + 1) % examples.length);
            }
          }, 25); // Slightly faster erase speed
        }, displayTime);
      }
    }, 75); // Speed of typing (75ms per character)

    return () => clearInterval(typeInterval);
  }, [currentIndex, examples, intervalMs]);

  return { text: displayText, isTyping, showCursor };
}

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

/** Guidance text component for proper research question usage */
function ResearchGuidance() {
  return (
    <div className="mb-5" style={{ maxWidth: 640 }}>
      <h3 
        className="mono text-xs font-medium mb-3"
        style={{ 
          color: 'var(--mut)', 
          letterSpacing: '0.08em',
          textTransform: 'uppercase'
        }}
      >
        Ask a Research Question
      </h3>
      
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cyan)', boxShadow: '0 0 10px var(--cyan)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
            Good:
          </span>
          <span 
            className="text-sm"
            style={{ color: 'var(--fg)' }}
          >
            "How does <span className="marker-half">sleep deprivation</span> affect <span className="marker-half">academic performance</span>?"
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--hot)', boxShadow: '0 0 10px var(--hot)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
            Not:
          </span>
          <span 
            className="text-sm"
            style={{ color: 'var(--fg)' }}
          >
            Your <span className="marker-half">full assignment brief</span>
          </span>
        </div>
      </div>
      
      <p 
        className="text-sm font-medium"
        style={{ 
          color: 'var(--mut)', 
          lineHeight: 1.5 
        }}
      >
        <strong className="marker-half" style={{ fontWeight: 600 }}>DeepResearch</strong> finds sources and synthesizes research — <strong className="marker-half" style={{ fontWeight: 600 }}>you write the essay</strong>.
      </p>
    </div>
  );
}

/** Assignment Brief Detection Modal */
function AssignmentBriefModal({ 
  isOpen, 
  onClose, 
  assignmentData, 
  onQuestionSelect, 
  onRunAnyway,
  loading 
}) {
  if (!isOpen || !assignmentData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line-strong)',
        }}
      >
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{ background: 'var(--bg-2)' }}
              >
                👋
              </div>
              <div>
                <h3 
                  className="text-xl font-semibold"
                  style={{ color: 'var(--fg)' }}
                >
                  That looks like a full assignment brief
                </h3>
                <p 
                  className="text-sm mt-1"
                  style={{ color: 'var(--mut)' }}
                >
                  Let's make this work better for you
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--mut2)' }}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Explanation */}
          <div 
            className="rounded-xl p-4 mb-6"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
          >
            <p 
              className="text-sm leading-relaxed"
              style={{ color: 'var(--fg)' }}
            >
              <strong>DeepResearch works best with focused questions</strong> rather than full assignment instructions. 
              This approach gives you more targeted research that you can use to build your complete response.
            </p>
          </div>

          {/* Suggested Questions */}
          <div className="mb-6">
            <h4 
              className="text-sm font-medium mb-4"
              style={{ color: 'var(--fg)' }}
            >
              Here are some focused questions I extracted from your assignment:
            </h4>
            <div className="space-y-3">
              {assignmentData.suggested_questions?.map((question, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onQuestionSelect(question)}
                  disabled={loading}
                  className="w-full p-4 rounded-xl transition-all text-left group hover:scale-[1.01] hover:shadow-sm"
                  style={{
                    background: 'var(--paper)',
                    border: '1px solid var(--line)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    transform: 'translateZ(0)', // Fix for Safari
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5"
                      style={{ 
                        background: 'var(--violet)', 
                        color: 'white',
                        boxShadow: '0 2px 8px rgba(124, 92, 255, 0.3)' 
                      }}
                    >
                      {index + 1}
                    </div>
                    <span 
                      className="text-sm leading-relaxed transition-colors"
                      style={{ color: 'var(--fg)' }}
                    >
                      {question}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={onRunAnyway}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl font-medium transition-colors"
              style={{
                border: '1px solid var(--line)',
                background: 'var(--paper)',
                color: 'var(--mut)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Processing...' : 'Run it anyway'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (assignmentData.suggested_questions?.[0]) {
                  onQuestionSelect(assignmentData.suggested_questions[0]);
                }
              }}
              disabled={loading || !assignmentData.suggested_questions?.[0]}
              className="flex-1 btn btn-new-research px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2"
              style={{ 
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Ask a question
                  <Icon.Arrow />
                </>
              )}
            </button>
          </div>

          {/* Helper Text */}
          <p 
            className="text-xs text-center mt-4"
            style={{ color: 'var(--mut2)' }}
          >
            💡 <strong>Tip:</strong> You can always refine your question after seeing the results
          </p>
        </div>
      </div>
    </div>
  );
}

/** Large serif card + pills + Investigate (matches intro; optional PDF export in toolbar row). */
const ResearchQueryComposer = React.forwardRef(({
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
  enableRotatingPlaceholder = false,
}, ref) => {
  const rotatingPlaceholder = useRotatingPlaceholder(RESEARCH_EXAMPLES, 5000);
  
  const quotaLocked = submitDisabled === true;
  const disabled =
    loading || !String(value || '').trim() || quotaLocked;

  return (
    <form onSubmit={onSubmit} className={formClassName}>
      {/* Add CSS for blinking cursor animation */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
      <div
        ref={ref}
        style={{
          padding: 18,
          borderRadius: 16,
          background: 'var(--card)',
          border: '1px solid var(--line-strong)',
          boxShadow: '0 30px 60px -30px rgba(124, 92, 255, 0.4)',
        }}
      >
        <div style={{ position: 'relative' }}>
          <textarea
            value={value}
            onChange={onChange}
            autoFocus={autoFocus}
            rows={3}
            placeholder={enableRotatingPlaceholder ? '' : placeholder}
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
              position: 'relative',
              zIndex: 2,
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
          {enableRotatingPlaceholder && !value && (
            <div 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'flex-start',
                paddingTop: '0.125em',
                opacity: 0.55,
                color: 'var(--mut)',
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 'clamp(22px, 3.2vw, 28px)',
                lineHeight: 1.25,
                letterSpacing: '-0.01em',
                zIndex: 1,
              }}
            >
              {rotatingPlaceholder.text}
              {rotatingPlaceholder.showCursor && (
                <span 
                  style={{ 
                    marginLeft: '1px',
                    animation: 'blink 1s infinite',
                    fontWeight: 'normal'
                  }}
                >
                  |
                </span>
              )}
            </div>
          )}
        </div>
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
});

const ResearchPage = () => {
  const { researchCreationBlocked, refreshUsageQuota, usageQuota } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversationType, setConversationType] = useState(null);
  const [conversationTitle, setConversationTitle] = useState('');
  const [folderId, setFolderId] = useState(null);
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [expandedFollowUpSlot, setExpandedFollowUpSlot] = useState(null);
  const [customFollowUpQuery, setCustomFollowUpQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportManager, setShowExportManager] = useState(false);
  const [exportInitialScope, setExportInitialScope] = useState({ mode: 'turn', turnIndex: 0 });
  const [showCitationHelper, setShowCitationHelper] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showResearchLibrary, setShowResearchLibrary] = useState(false);
  const [pageStartTime] = useState(Date.now());
  const [showAssignmentBriefModal, setShowAssignmentBriefModal] = useState(false);
  const [assignmentBriefData, setAssignmentBriefData] = useState(null);
  const [originalAssignmentQuery, setOriginalAssignmentQuery] = useState('');
  const [showOnboardingTooltip, setShowOnboardingTooltip] = useState(false);
  const inputContainerRef = useRef(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const convoIdFromUrl = searchParams.get('convo_id');
  /** Immersive first step: no sidebar until the user sends a query (unless opening an existing conversation). */
  const showFullScreenIntro = messages.length === 0 && !convoIdFromUrl;

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

  // Check if user should see onboarding tooltip
  useEffect(() => {
    const hasSeenTooltip = localStorage.getItem('hasSeenResearchTooltip');
    // Show tooltip only on the full-screen intro (first visit, no existing conversation)
    if (!hasSeenTooltip && showFullScreenIntro && !loading) {
      // Small delay to ensure the page has rendered
      const timer = setTimeout(() => {
        setShowOnboardingTooltip(true);
        // Track that the tooltip was shown
        analyticsService.track('onboarding_tooltip_shown', {
          page_type: 'research_intro',
          time_to_show_ms: Date.now() - pageStartTime
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [showFullScreenIntro, loading, pageStartTime]);

  const loadConversation = useCallback(async (convoId) => {
    const startTime = Date.now();
    try {
      const response = await apiFetch(config.endpoints.messages(convoId));
      
      if (response.ok) {
        const data = await response.json();
        // Backend now returns { messages, conversation_type }; tolerate the
        // older array-only shape during deploy transitions.
        const messagesList = Array.isArray(data) ? data : (data.messages || []);
        const convType = Array.isArray(data) ? null : (data.conversation_type || null);
        setMessages(messagesList);
        setConversationType(convType);

        const firstUserMessage = messagesList.find(msg => msg.role === 'user');
        if (firstUserMessage) {
          setConversationTitle(firstUserMessage.content.slice(0, 50) + '...');
        }

        analyticsService.track('conversation_loaded', {
          conversation_id: convoId,
          messages_count: messagesList.length,
          load_time_ms: Date.now() - startTime,
          has_title: !!firstUserMessage,
          conversation_type: convType
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

  const handleSubmit = async (e, forceProcess = false) => {
    e?.preventDefault();
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
      // Route comparison follow-ups to the comparison endpoint so the web
      // research pipeline is not triggered on conversations that started as
      // article comparisons.
      const isComparisonFollowup =
        !!conversationId && conversationType === 'article_comparison';

      const endpoint = isComparisonFollowup
        ? config.endpoints.comparisonFollowup
        : config.endpoints.research;

      const requestBody = isComparisonFollowup
        ? {
            conversation_id: conversationId,
            message: queryText,
          }
        : {
            prompt: queryText,
            conversation_id: conversationId || undefined,
            folder_id: folderId || undefined,
            force_process: forceProcess,
          };

      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        const processingTime = Date.now() - startTime;

        if (data.conversation_type) {
          setConversationType(data.conversation_type);
        }

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
          // Check if the response contains assignment brief guidance
          const lastMessage = data.new_messages[data.new_messages.length - 1];
          console.log('Research response received:', { 
            messageCount: data.new_messages.length, 
            hasMetadata: !!lastMessage?.metadata,
            hasAssignmentGuidance: !!lastMessage?.metadata?.assignment_guidance,
            forceProcess: forceProcess,
            wordCount: queryText.split(' ').length
          });
          if (lastMessage?.metadata?.assignment_guidance && !forceProcess) {
            // Show assignment brief modal instead of displaying the message
            setOriginalAssignmentQuery(queryText);
            setAssignmentBriefData({
              message: "This looks like an assignment brief! DeepResearch works best with focused research questions rather than full assignment instructions.",
              suggested_questions: lastMessage.metadata.suggested_questions || [],
              can_proceed: true
            });
            setShowAssignmentBriefModal(true);
            
            // Remove the user message since we're showing the modal instead
            setMessages(prev => prev.slice(0, -1));
            
            // Track assignment brief detection
            analyticsService.track('assignment_brief_detected', {
              word_count: lastMessage.metadata.original_word_count,
              conversation_id: data.conversation_id,
              suggested_questions_count: lastMessage.metadata.suggested_questions?.length || 0
            });
          } else {
            // Normal flow - add messages to conversation
            setMessages(prev => [...prev, ...data.new_messages]);
            
            // Check if user just reached quota limit - store in localStorage for dashboard
            if (data.quota_just_reached) {
              localStorage.setItem('deepresearch_show_beta_review', 'true');
            }
            
            // Track successful research response
            analyticsService.trackSearchResults(
              queryText,
              data.new_messages.length,
              processingTime,
              data.sources || []
            );
          }
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

  // Assignment brief modal handlers
  const handleAssignmentQuestionSelect = (question) => {
    setInputValue(question);
    setShowAssignmentBriefModal(false);
    setAssignmentBriefData(null);
    
    // Track question selection
    analyticsService.track('assignment_question_selected', {
      original_query: originalAssignmentQuery,
      selected_question: question,
      conversation_id: conversationId
    });
    
    // Auto-submit the selected question
    setTimeout(() => {
      if (conversationId) {
        // Use followup handler for existing conversations
        handleSubmitFollowup(question);
      } else {
        // Use main submit handler for new conversations
        const event = { preventDefault: () => {} };
        handleSubmit(event);
      }
    }, 100);
  };

  const handleRunAnyway = () => {
    setInputValue(originalAssignmentQuery);
    setShowAssignmentBriefModal(false);
    setAssignmentBriefData(null);
    
    // Track "run anyway" action
    analyticsService.track('assignment_run_anyway', {
      original_query: originalAssignmentQuery,
      conversation_id: conversationId
    });
    
    // Submit with force flag
    setTimeout(() => {
      if (conversationId) {
        // Use followup handler for existing conversations
        handleSubmitFollowup(originalAssignmentQuery, true);
      } else {
        // Use main submit handler for new conversations
        const event = { preventDefault: () => {} };
        handleSubmit(event, true);
      }
    }, 100);
  };

  const handleAssignmentModalClose = () => {
    setShowAssignmentBriefModal(false);
    setAssignmentBriefData(null);
    setOriginalAssignmentQuery('');
  };

  const handleTooltipDismiss = () => {
    setShowOnboardingTooltip(false);
    // Track that user has seen the onboarding tooltip
    analyticsService.track('onboarding_tooltip_dismissed', {
      time_on_page_ms: Date.now() - pageStartTime,
      page_type: 'research_intro'
    });
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
    // Allow follow-ups on existing conversations even when quota is exhausted
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


  const handleFollowUpSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    // Follow-ups are always allowed on existing reports, even when quota is exhausted
    if (!customFollowUpQuery.trim() || loading) return;

    setExpandedFollowUpSlot(null);
    handleAddFollowup(customFollowUpQuery);
    setCustomFollowUpQuery('');
  };

  const handleFollowUpCancel = () => {
    setExpandedFollowUpSlot(null);
    setCustomFollowUpQuery('');
  };


  const handleSubmitFollowup = async (query, forceProcess = false) => {
    // Follow-ups are always allowed on existing reports, even when quota is exhausted
    if (!query.trim() || loading) return;

    setLoading(true);
    const userMessage = { role: 'user', content: query.trim() };
    setMessages(prev => [...prev, userMessage]);

    try {
      const isComparisonFollowup =
        !!conversationId && conversationType === 'article_comparison';

      const endpoint = isComparisonFollowup
        ? config.endpoints.comparisonFollowup
        : config.endpoints.research;

      const requestBody = isComparisonFollowup
        ? {
            conversation_id: conversationId,
            message: query,
          }
        : {
            prompt: query,
            conversation_id: conversationId || undefined,
            folder_id: folderId || undefined,
            force_process: forceProcess,
          };

      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();

        if (data.conversation_type) {
          setConversationType(data.conversation_type);
        }

        if (!conversationId) {
          setConversationId(data.conversation_id);
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.set('convo_id', data.conversation_id);
          navigate(`/research?${newSearchParams.toString()}`, { replace: true });
        }
        
        if (data.new_messages && data.new_messages.length > 0) {
          // Check if the response contains assignment brief guidance
          const lastMessage = data.new_messages[data.new_messages.length - 1];
          console.log('Followup response received:', { 
            messageCount: data.new_messages.length, 
            hasMetadata: !!lastMessage?.metadata,
            hasAssignmentGuidance: !!lastMessage?.metadata?.assignment_guidance,
            forceProcess: forceProcess,
            wordCount: query.split(' ').length
          });
          if (lastMessage?.metadata?.assignment_guidance && !forceProcess) {
            // Show assignment brief modal instead of displaying the message
            setOriginalAssignmentQuery(query);
            setAssignmentBriefData({
              message: "This looks like an assignment brief! DeepResearch works best with focused research questions rather than full assignment instructions.",
              suggested_questions: lastMessage.metadata.suggested_questions || [],
              can_proceed: true
            });
            setShowAssignmentBriefModal(true);
            
            // Remove the user message since we're showing the modal instead
            setMessages(prev => prev.slice(0, -1));
          } else {
            setMessages(prev => [...prev, ...data.new_messages]);
          }
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

  const handleOpenExportManager = () => {
    const turns = getResearchTurns(messages);
    const scope =
      turns.length > 0 && turns.some((t) => t.turnIndex === activeNodeIndex)
        ? { mode: 'turn', turnIndex: activeNodeIndex }
        : turns.length > 0
          ? { mode: 'turn', turnIndex: turns[0].turnIndex }
          : { mode: 'all' };
    setExportInitialScope(scope);
    setShowExportManager(true);
    analyticsService.trackFeatureUsage('export_manager', 'opened', {
      conversation_id: conversationId,
      turns_count: turns.length,
      turn_index: scope.mode === 'turn' ? scope.turnIndex : null,
    });
  };

  const hasExportableTurns = getResearchTurns(messages).length > 0;

  const handleFollowUp = (suggestion) => {
    // Follow-ups are always allowed on existing reports, even when quota is exhausted
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
                  <div className="mt-7">
                    <ResearchGuidance />
                    <ResearchQueryComposer
                      ref={inputContainerRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onSubmit={handleSubmit}
                      loading={loading}
                      autoFocus
                      enableRotatingPlaceholder={true}
                    />
                    
                    {/* Timing Callout */}
                    <div className="flex justify-center mt-6">
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 20px',
                        background: 'var(--bg-2)',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                        fontSize: 14,
                        color: 'var(--mut)'
                      }}>
                        <span style={{ fontSize: 16 }}></span>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--fg)' }}>Takes 60-90 seconds</span>
                          <span style={{ margin: '0 8px', opacity: 0.5 }}>—</span>
                          <span>We search live sources and verify every citation — quality takes time.</span>
                        </div>
                      </div>
                    </div>
                  </div>
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
                  </button>

                  {/* Follow-up Slots */}
                  {Array.from({ length: MAX_COMPARISON_FOLLOWUPS }, (_, i) => i + 1).map((slot) => (
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
                    </button>
                  ))}
                </div>
              </div>

              {/* Research Tools Panel */}
              <div>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--fg)' }}>Research Tools</h3>
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={!hasExportableTurns}
                    onClick={handleOpenExportManager}
                    className="w-full p-3 text-left rounded-lg transition-colors hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ border: '1px solid var(--line)', background: 'var(--paper)' }}
                  >
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-3 shrink-0"
                        style={{ color: 'var(--mut)' }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
                        Export PDF
                      </span>
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


                            <ResearchQueryComposer
                              value={customFollowUpQuery}
                              onChange={(e) => setCustomFollowUpQuery(e.target.value)}
                              onSubmit={handleFollowUpSubmit}
                              loading={loading}
                              submitDisabled={false}
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
          conversationType={conversationType}
          conversationId={conversationId}
          initialScope={exportInitialScope}
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

      {/* Assignment Brief Modal */}
      <AssignmentBriefModal
        isOpen={showAssignmentBriefModal}
        onClose={handleAssignmentModalClose}
        assignmentData={assignmentBriefData}
        onQuestionSelect={handleAssignmentQuestionSelect}
        onRunAnyway={handleRunAnyway}
        loading={loading}
      />

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

      {/* Onboarding Tooltip */}
      <OnboardingTooltip
        show={showOnboardingTooltip}
        targetRef={inputContainerRef}
        onDismiss={handleTooltipDismiss}
      />

    </div>
  );
};

export default ResearchPage; 