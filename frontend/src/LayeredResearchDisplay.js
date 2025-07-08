import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChartDisplay from './ChartDisplay';
import ComparisonReportDisplay from './ComparisonReportDisplay';

const LayeredResearchDisplay = ({ 
  messages, 
  isLoading, 
  onFollowUp, 
  activeNodeIndex = 0,
  onNodeSelect,
  onAddFollowup,
  exportSelections,
  onExportToggle 
}) => {
  const [copiedSection, setCopiedSection] = useState(null);
  const [currentFollowUpQuery, setCurrentFollowUpQuery] = useState('');
  const [activeTab, setActiveTab] = useState('summary');

  // Clear the current follow-up query when loading finishes
  useEffect(() => {
    if (!isLoading) {
      setCurrentFollowUpQuery('');
    }
  }, [isLoading]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating comprehensive research report...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center text-gray-500 py-20">
        <h2 className="text-2xl font-semibold">Welcome to DeepResearch</h2>
        <p className="mt-2">Start a new research conversation by typing your query below.</p>
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
        currentSection = { type: 'executive', content: [] };
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
      'Introduction': '📚', 'Background': '📖', 'Literature Review': '📋',
      'Current Evidence': '🔍', 'Key Findings': '🎯', 'Critical Analysis': '🧠',
      'Analysis': '📊', 'Synthesis': '🔗', 'Comparative': '⚖️',
      'Perspectives': '👥', 'Conclusions': '🎯', 'Future': '🚀',
      'References': '📚', 'Methodology': '🔬', 'Results': '📈', 
      'Discussion': '💭', 'Evidence': '🔍', 'Findings': '🎯'
    };
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (title.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return '📄';
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

  const sections = parseResearchContent(mainReport.content);
  const hasChart = mainReport.metadata && mainReport.metadata.graph_data;

  // Check if this is a comparison report
  const isComparisonReport = mainReport.metadata?.comparison_type === 'article_comparison';

  // If it's a comparison report, use the specialized comparison display
  if (isComparisonReport) {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
      {/* Tabs Header */}
      <div className="bg-white rounded-t-lg shadow-sm border-b border-gray-200">
        <div className="px-8 py-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'summary'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              📋 Summary
            </button>
            <button
              onClick={() => setActiveTab('full')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'full'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              📄 Full Report
            </button>
          </div>
        </div>
      </div>

      {/* Main Report */}
      <div className="bg-white rounded-b-lg shadow-sm">
        {/* Report Header */}
        <div className="px-8 py-6 border-b border-gray-200">
          {activeQuery && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700 font-medium">Research Query:</p>
              <p className="text-blue-900 italic">"{activeQuery}"</p>
            </div>
          )}
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {sections.title || 'Research Report'}
          </h1>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>Generated {new Date(mainReport.created_at).toLocaleDateString()}</span>
            <span>•</span>
            <span>5 Sources</span>
            <span>•</span>
            <span>{sections.fullSections.length} Sections</span>
            <span>•</span>
            <span>{Math.ceil(mainReport.content.length / 1000)} min read</span>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'summary' ? (
          /* Executive Summary */
          <div className="px-8 py-6 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">✨</span>
              Key Insights and Findings at a Glance
            </h2>
            <div className="space-y-3">
              {sections.executive.map((item, index) => (
                <p key={index} className="text-gray-700 leading-relaxed">
                  • {item}
                </p>
              ))}
            </div>
            
            {/* Chart in Summary View */}
            {hasChart && (
              <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">📊</span>
                  Key Data Insights
                </h3>
                <ChartDisplay graphData={mainReport.metadata.graph_data} />
              </div>
            )}
          </div>
        ) : (
          /* Full Report Sections */
          <div className="px-8 py-6 space-y-8">
            {sections.fullSections.map((section, index) => (
              <React.Fragment key={index}>
                <section className="prose prose-lg max-w-none">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center m-0">
                      <span className="mr-3">{section.icon}</span>
                      {section.title}
                    </h2>
                    <button
                      onClick={() => copyToClipboard(section.content.join('\n'), section.title)}
                      className="text-gray-400 hover:text-gray-600 p-2"
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
                  <div className="text-gray-700 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {section.content.join('\n')}
                    </ReactMarkdown>
                  </div>
                </section>
                

              </React.Fragment>
            ))}
            
            {/* References & Data Visualizations Section - At the End */}
            {hasChart && (
              <section className="prose prose-lg max-w-none">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center m-0">
                    <span className="mr-3">📊</span>
                    References & Data Visualizations
                  </h2>
                </div>
                <div className="text-gray-700 leading-relaxed mb-6">
                  <p className="text-sm">
                    The following data visualization provides quantitative insights and supporting evidence for the analysis presented in this report.
                  </p>
                </div>
                <div className="not-prose">
                  <ChartDisplay graphData={mainReport.metadata.graph_data} />
                </div>
              </section>
            )}
          </div>
        )}


      </div>

      {/* Loading State for Follow-ups */}
      {isLoading && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 px-6 py-4 flex items-center space-x-4">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
          <div className="text-sm">
            <p className="font-medium text-gray-900">Generating follow-up research...</p>
            {currentFollowUpQuery && (
              <p className="text-gray-500 text-xs mt-1">"{currentFollowUpQuery}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LayeredResearchDisplay; 