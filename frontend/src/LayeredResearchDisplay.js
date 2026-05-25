import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChartDisplay from './ChartDisplay';
import ComparisonReportDisplay from './ComparisonReportDisplay';
import ComparisonFollowupDisplay from './comparison/ComparisonFollowupDisplay';
import CitationHelper from './components/CitationHelper';
import ResearchGeneratingPanel from './components/ResearchGeneratingPanel';
import { FrameDivider } from './components/shared';

const LayeredResearchDisplay = ({ 
  messages, 
  isLoading, 
  onFollowUp, 
  activeNodeIndex = 0,
  onNodeSelect,
  onAddFollowup,
}) => {
  const [copiedSection, setCopiedSection] = useState(null);
  const [currentFollowUpQuery, setCurrentFollowUpQuery] = useState('');
  const [activeTab, setActiveTab] = useState('full');
  const [showCitationHelper, setShowCitationHelper] = useState(false);

  // Clear the current follow-up query when loading finishes
  useEffect(() => {
    if (!isLoading) {
      setCurrentFollowUpQuery('');
    }
  }, [isLoading]);

  const userMsgCount = messages.filter((m) => m.role === 'user').length;
  const assistantMsgCount = messages.filter((m) => m.role === 'assistant').length;

  if (isLoading && messages.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2">
        <ResearchGeneratingPanel query="" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-20 px-4" style={{ color: 'var(--mut)' }}>
        <h2 className="serif text-2xl" style={{ color: 'var(--fg)' }}>Welcome to DeepResearch</h2>
        <p className="mt-2 mono text-sm">Start a new research conversation by typing your query below.</p>
      </div>
    );
  }

  // Organize messages into main report and addendums based on active node
  const organizeMessages = () => {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    if (assistantMessages.length === 0) return { mainReport: null, addendums: [] };
    
    // Get the report for the active node (0-indexed)
    const activeReport = assistantMessages[activeNodeIndex];
    const activeUserMessage = userMessages[activeNodeIndex];
    
    if (!activeReport) return { mainReport: null, addendums: [] };
    
    return { 
      mainReport: activeReport, 
      addendums: [],
      activeQuery: activeUserMessage?.content || ''
    };
  };

  const { mainReport, activeQuery } = organizeMessages();

  /* Waiting for the assistant message for the latest user turn (first report or follow-up). */
  if (isLoading && !mainReport && userMsgCount > assistantMsgCount) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    return (
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2">
        <ResearchGeneratingPanel query={lastUser?.content || ''} />
      </div>
    );
  }

  if (!mainReport) return null;

  // Parse research content into structured sections
  const parseResearchContent = (content) => {
    const sections = {
      title: '',
      executive: [],
      fullSections: []
    };
    
    const lines = content.split('\n');
    let currentSection = null;
    let inExecutive = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('# ')) {
        sections.title = line.replace('# ', '');
      } else if (line.toLowerCase().includes('executive summary') && line.startsWith('##')) {
        inExecutive = true;
        const title = line.replace('## ', '');
        currentSection = {
          type: 'section',
          title: title,
          content: [],
          icon: getSectionIcon(title)
        };
        sections.fullSections.push(currentSection);
      } else if (line.startsWith('## ')) {
        if (inExecutive && currentSection) {
          sections.executive = currentSection.content;
          inExecutive = false;
        }
        const title = line.replace('## ', '');
        currentSection = {
          type: 'section',
          title: title,
          content: [],
          icon: getSectionIcon(title)
        };
        sections.fullSections.push(currentSection);
      } else if (line.startsWith('• ') && inExecutive) {
        currentSection?.content.push(line.replace('• ', ''));
      } else if (line && currentSection) {
        currentSection.content.push(line);
      }
    }
    
    // Handle case where executive summary is at the end
    if (inExecutive && currentSection) {
      sections.executive = currentSection.content;
    }
    
    return sections;
  };

  const getSectionIcon = (title) => {
    const iconMap = {
      'Executive Summary': '✨', 'Introduction': '📚', 'Background': '📖',
      'Literature Review': '📋', 'Current Evidence': '🔍', 'Key Findings': '🎯',
      'Critical Analysis': '🧠', 'Analysis': '📊', 'Synthesis': '🔗',
      'Comparative': '⚖️', 'Perspectives': '👥', 'Conclusions': '🎯',
      'Future': '🚀', 'References': '📚', 'Methodology': '🔬',
      'Results': '📈', 'Discussion': '💭', 'Evidence': '🔍', 'Findings': '🎯'
    };
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (title.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return '📄';
  };

  // Extract URLs from messages to count sources
  const extractUrlsFromMessages = (messages) => {
    const urls = [];
    const seen = new Set();
    messages.forEach((message) => {
      if (message.role === 'assistant' && message.content) {
        const urlRegex = /https?:\/\/[^\s]+/g;
        const found = message.content.match(urlRegex) || [];
        found.forEach((raw) => {
          const url = String(raw).trim().replace(/[)\].,;:'"»]+$/g, '');
          if (url && !seen.has(url)) {
            seen.add(url);
            urls.push(url);
          }
        });
      }
    });
    return urls;
  };

  const copyToClipboard = async (text, sectionName) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionName);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const allUrls = extractUrlsFromMessages(messages);
  const sourceCount = allUrls.length;

  const isComparisonConvo = (messages || []).some(
    (m) => m?.role === 'assistant' && m?.metadata?.comparison_type === 'article_comparison'
  );

  if (isComparisonConvo) {
    if (mainReport.metadata?.message_type === 'comparison_followup') {
      return (
        <ComparisonFollowupDisplay
          message={mainReport}
          isLoading={isLoading}
        />
      );
    }

    return (
      <ComparisonReportDisplay
        messages={messages}
        isLoading={isLoading}
        onFollowUp={(query) => {
          setCurrentFollowUpQuery(query);
          onFollowUp && onFollowUp(query);
        }}
      />
    );
  }

  const sections = parseResearchContent(mainReport.content);
  const hasChart = mainReport.metadata && mainReport.metadata.graph_data;

  const chartFigWrapper = (children) => (
    <div
      className="not-prose mt-8 p-6 rounded-xl"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line-strong)',
        boxShadow: '0 12px 40px -24px rgba(124,92,255,.35)',
      }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="mono" style={{ fontSize: 11, color: 'var(--violet)', letterSpacing: '.16em' }}>
          FIG. 1
        </span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--mut2)' }}>
          from this report
        </span>
      </div>
      {children}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2">

      {/* Tabs Header */}
      <div
        className="rounded-t-xl shadow-sm border-b"
        style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
      >
        <div className="px-6 py-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('summary')}
              className="mono px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={
                activeTab === 'summary'
                  ? { background: 'var(--bg-2)', color: 'var(--violet-2)', border: '1px solid var(--violet)' }
                  : { color: 'var(--mut)', border: '1px solid transparent' }
              }
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab('full')}
              className="mono px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={
                activeTab === 'full'
                  ? { background: 'var(--bg-2)', color: 'var(--violet-2)', border: '1px solid var(--violet)' }
                  : { color: 'var(--mut)', border: '1px solid transparent' }
              }
            >
              Full Report
            </button>
          </div>
        </div>
      </div>

      {/* Main Report */}
      <div className="rounded-b-xl shadow-sm border border-t-0" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
        {/* Report Header */}
        <div className="px-6 py-6 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="mb-4 flex items-baseline justify-between flex-wrap gap-2">
            <span className="mono" style={{ fontSize: 11, color: 'var(--violet)', letterSpacing: '.2em', textTransform: 'uppercase' }}>
              feature · research report
            </span>
          </div>
          {activeQuery && (
            <blockquote
              className="serif mb-6 pl-4 py-3 my-0"
              style={{
                borderLeft: '3px solid var(--violet)',
                fontSize: 'clamp(18px, 2.5vw, 22px)',
                lineHeight: 1.35,
                fontStyle: 'italic',
                color: 'var(--mut)',
              }}
            >
              &ldquo;{activeQuery}&rdquo;
            </blockquote>
          )}

          <h1
            className="serif mb-4"
            style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              lineHeight: 0.95,
              letterSpacing: '-.025em',
              color: 'var(--fg)',
            }}
          >
            {sections.title || 'Research Report'}
          </h1>

          <div className="mono flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--mut2)', letterSpacing: '.04em' }}>
            <span>{new Date(mainReport.created_at).toLocaleDateString()}</span>
            <span>·</span>
            <span>{sourceCount} sources</span>
            <span>·</span>
            <span>{sections.fullSections.length} sections</span>
            <span>·</span>
            <span>{Math.ceil(mainReport.content.trim().split(/\s+/).length / 200)} min read</span>
          </div>
        </div>

        {/* View All Sources Button */}
        {sourceCount > 0 && (
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}>
            <button
              onClick={() => setShowCitationHelper(true)}
              type="button"
              className="btn btn-new-research inline-flex items-center px-6 py-3 rounded-lg font-medium"
            >
              <span className="mr-2">📚</span>
              View all {sourceCount} sources (citation format)
            </button>
            <p className="text-sm mt-2 mono" style={{ color: 'var(--mut)' }}>
              Formatted citations for every source in this report.
            </p>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'summary' ? (
          /* Executive Summary */
          <div className="px-6 py-6" style={{ background: 'var(--paper)' }}>
            <FrameDivider label="01 · Key insights" />
            <div className="space-y-3">
              {sections.executive.map((item, index) => (
                <p key={index} style={{ color: 'var(--fg)', lineHeight: 1.65, fontSize: 17 }}>
                  • {item}
                </p>
              ))}
            </div>

            {/* Chart in Summary View */}
            {hasChart && chartFigWrapper(<ChartDisplay graphData={mainReport.metadata.graph_data} />)}
          </div>
        ) : (
          /* Full Report Sections */
          <div className="px-6 py-6 space-y-8" style={{ background: 'var(--paper)' }}>
            {sections.fullSections.map((section, index) => (
              <React.Fragment key={index}>
                <section className="prose prose-lg max-w-none">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="serif text-2xl m-0 flex items-center" style={{ color: 'var(--fg)', letterSpacing: '-.02em' }}>
                      <span className="mr-3">{section.icon}</span>
                      {section.title}
                    </h2>
                    <button
                      onClick={() => copyToClipboard(section.content.join('\n'), section.title)}
                      className="p-2 rounded-md transition-colors"
                      style={{ color: 'var(--mut)' }}
                      title="Copy section"
                    >
                      {copiedSection === section.title ? (
                        <span className="text-green-500">✓</span>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="leading-relaxed" style={{ color: 'var(--fg)' }}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({href, children, ...props}) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                            {children}
                          </a>
                        )
                      }}
                    >
                      {section.content.join('\n')}
                    </ReactMarkdown>
                  </div>
                </section>
                

              </React.Fragment>
            ))}
            
            {/* References & Data Visualizations Section - At the End */}
            {hasChart && (
              <section className="prose prose-lg max-w-none">
                <FrameDivider label="Data visualization" />
                <p className="text-sm mono mb-4" style={{ color: 'var(--mut)' }}>
                  Quantitative view supporting the analysis in this report.
                </p>
                {chartFigWrapper(<ChartDisplay graphData={mainReport.metadata.graph_data} />)}
              </section>
            )}

          </div>
        )}


      </div>

      {/* Loading State for Follow-ups */}
      {isLoading && (
        <div
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 rounded-xl shadow-lg px-6 py-4 flex items-center space-x-4 z-20 border"
          style={{ background: 'var(--card)', borderColor: 'var(--line-strong)' }}
        >
          <div
            className="animate-spin rounded-full h-5 w-5 border-2 border-transparent"
            style={{ borderTopColor: 'var(--violet)', borderRightColor: 'var(--violet)' }}
          />
          <div className="text-sm">
            <p className="font-medium" style={{ color: 'var(--fg)' }}>Generating follow-up research…</p>
            {currentFollowUpQuery && (
              <p className="mono text-xs mt-1" style={{ color: 'var(--mut)' }}>&ldquo;{currentFollowUpQuery}&rdquo;</p>
            )}
          </div>
        </div>
      )}

      {/* Citation Helper Modal */}
      {showCitationHelper && (
        <CitationHelper
          messages={messages}
          onClose={() => setShowCitationHelper(false)}
        />
      )}
    </div>
  );
};

export default LayeredResearchDisplay; 