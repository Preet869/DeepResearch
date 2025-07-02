import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChartDisplay from './ChartDisplay';

const LayeredResearchDisplay = ({ messages, isLoading, onFollowUp, onExportPDF, onExportMarkdown, onExportJSON }) => {
  const [copiedSection, setCopiedSection] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [showFullReport, setShowFullReport] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [threadView, setThreadView] = useState(false);
  const [currentFollowUpQuery, setCurrentFollowUpQuery] = useState('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const followUpRef = useRef(null);

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

  // Organize messages into main report and addendums
  const organizeMessages = () => {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    if (assistantMessages.length === 0) return { mainReport: null, addendums: [] };
    
    const mainReport = assistantMessages[0];
    const addendums = [];
    
    for (let i = 1; i < assistantMessages.length; i++) {
      const followUpQuestion = userMessages[i]?.content || '';
      addendums.push({
        question: followUpQuestion,
        report: assistantMessages[i],
        index: i
      });
    }
    
    return { mainReport, addendums };
  };

  const { mainReport, addendums } = organizeMessages();
  
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



  const handleFollowUpSubmit = (e) => {
    e.preventDefault();
    if (!followUpInput.trim() || isLoading) return;
    
    // Store the current query for loading display
    setCurrentFollowUpQuery(followUpInput.trim());
    
    // Directly submit the follow-up without going through main input
    onFollowUp(followUpInput.trim());
    setFollowUpInput('');
  };

  const handleSuggestionClick = (suggestion) => {
    if (isLoading) return;
    
    // Store the current query for loading display
    setCurrentFollowUpQuery(suggestion);
    
    // Directly submit the suggestion without setting it in the input
    onFollowUp(suggestion);
    
    // Scroll to the bottom to show the loading state
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const sections = parseResearchContent(mainReport.content);
  const hasChart = mainReport.metadata && mainReport.metadata.graph_data;
  
  const followUpSuggestions = mainReport.metadata?.followup_suggestions || [
    "What are the main risks and mitigation strategies?",
    "How does this compare across different regions or markets?",
    "What are the implementation challenges and solutions?",
    "What's the 5-year outlook with specific milestones?",
    "What are the policy implications and recommendations?"
  ];

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-screen bg-white">
      

            {/* Main Content - True Full Width Layout */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Report Column */}
          <div className="lg:col-span-3">
            {/* Main Report Header */}
            <header className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-start space-x-3 mb-4">
            <span className="text-2xl">📘</span>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-3">
                {sections.title || 'Research Report'}
              </h1>
              
              {/* Metadata Bar */}
              <div className="flex items-center space-x-4 text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
                <span>Generated {new Date(mainReport.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>5 Sources</span>
                <span>•</span>
                <span>{sections.fullSections.length} Sections</span>
                <span>•</span>
                <span>{Math.ceil(mainReport.content.length / 1000)} min read</span>
                <span className="ml-auto px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                  High Confidence
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Executive Summary */}
        <section className="mb-10">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">✨</span>
              Executive Summary
            </h2>
            <div className="space-y-3 mb-4">
              {sections.executive.map((item, index) => (
                <p key={index} className="text-gray-700 leading-relaxed">
                  • {item}
                </p>
              ))}
            </div>
            {!showFullReport && (
              <button
                onClick={() => setShowFullReport(true)}
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
              >
                Read Full Report ↓
              </button>
            )}
          </div>
        </section>

        {/* Full Report Sections */}
        {(showFullReport || sections.fullSections.length > 0) && (
          <div className="space-y-8">
            {sections.fullSections.map((section, index) => (
              <section key={index} className="prose prose-lg max-w-none">
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
                <div className="text-gray-700 leading-relaxed max-w-none prose-lg">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {section.content.join('\n')}
                  </ReactMarkdown>
                </div>
              </section>
            ))}
          </div>
        )}

                    {/* Chart Display */}
            {hasChart && (
              <section id="chart-section" className="my-10">
                <ChartDisplay graphData={mainReport.metadata.graph_data} />
              </section>
            )}

            {/* Loading State for Follow-ups */}
            {isLoading && messages.length > 0 && (
              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <h4 className="font-semibold text-gray-900 mb-2">Generating Follow-up Research</h4>
                  {currentFollowUpQuery && (
                    <p className="text-gray-600 italic mb-2">"{currentFollowUpQuery}"</p>
                  )}
                  <p className="text-sm text-gray-500">
                    Analyzing your question and generating comprehensive insights...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Smart Tools Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Smart Tools Header */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Smart Tools</h3>
              </div>



              {/* Follow-up Suggestions */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">🔍</span>
                  Follow-up Suggestions
                </h4>
                <div className="space-y-2">
                  {followUpSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded border transition-colors"
                      disabled={isLoading}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visualizations */}
              {hasChart && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">📊</span>
                    Visualizations
                  </h4>
                  <button
                    onClick={() => scrollToSection('chart-section')}
                    className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded border transition-colors text-sm"
                  >
                    View Data Visualization
                  </button>
                </div>
              )}

              {/* Conversation Thread */}
              {addendums.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">🧠</span>
                    Conversation Thread
                  </h4>
                  <button
                    onClick={() => setThreadView(!threadView)}
                    className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded border transition-colors text-sm"
                  >
                    {threadView ? 'Hide' : 'Show'} Thread View ({addendums.length} follow-ups)
                  </button>
                  
                  {threadView && (
                    <div className="mt-3 space-y-2">
                      {addendums.map((addendum, index) => (
                        <div key={index} className="border border-gray-200 rounded p-3">
                          <h5 className="font-medium text-gray-900 text-sm mb-1">
                            Q{index + 1}: {addendum.question.substring(0, 60)}...
                          </h5>
                          <p className="text-xs text-gray-500">
                            {new Date(addendum.report.created_at).toLocaleDateString()}
                          </p>
                          <button
                            onClick={() => {
                              const element = document.getElementById(`addendum-${index}`);
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                            className="mt-2 text-blue-600 hover:text-blue-700 text-xs font-medium"
                          >
                            View Full Research →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}


            </div>
          </div>
        </div>

        {/* Full Addendums at Bottom */}
        {addendums.length > 0 && (
          <div className="mt-12 space-y-8">
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="mr-2">🧾</span>
                Complete Research Addendums
              </h2>
            </div>
            
            {addendums.map((addendum, index) => {
              const addendumSections = parseResearchContent(addendum.report.content);
              
              return (
                <div key={index} id={`addendum-${index}`} className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      🧾 Follow-Up: {addendum.question}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Generated: {new Date(addendum.report.created_at).toLocaleDateString()} • 
                      {Math.ceil(addendum.report.content.length / 1000)} min read • 
                      3 sources
                    </p>
                  </div>
                  
                  {/* Addendum Executive Summary */}
                  {addendumSections.executive.length > 0 && (
                    <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">Summary</h4>
                      <div className="space-y-2">
                        {addendumSections.executive.map((item, idx) => (
                          <p key={idx} className="text-gray-700">• {item}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Addendum Sections */}
                  <div className="text-gray-700 leading-relaxed max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {addendum.report.content}
                    </ReactMarkdown>
                  </div>
                  
                  {/* Addendum Chart */}
                  {addendum.report.metadata?.graph_data && (
                    <div className="mt-6">
                      <ChartDisplay graphData={addendum.report.metadata.graph_data} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
         )}
             </div>
    </div>
  );
};

export default LayeredResearchDisplay; 