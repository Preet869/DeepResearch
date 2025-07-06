import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChartDisplay from './ChartDisplay';

const EnhancedResearchDisplay = ({ messages, isLoading, onFollowUp, onExportPDF, onExportMarkdown, onExportJSON }) => {
  // State management
  const [readingMode, setReadingMode] = useState('scan'); // scan, study, action, research
  const [activeSection, setActiveSection] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // summary, full-report
  const [copiedSection, setCopiedSection] = useState(null);
  const [hoveredCitation, setHoveredCitation] = useState(null);
  const [confidenceExpanded, setConfidenceExpanded] = useState(false);

  // Helper functions - MUST be defined before use
  const calculateReadingTime = (text) => {
    const wordsPerMinute = 200;
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    const minutes = wordCount / wordsPerMinute;
    // Ensure minimum 1 minute, but show actual time for longer content
    return Math.max(1, Math.ceil(minutes));
  };

  const calculateConfidenceScore = (metadata) => {
    // Mock calculation - in real implementation would analyze sources
    const factors = {
      sourceCount: metadata?.sources?.length || 5,
      sourceQuality: 0.8, // Would be calculated from source analysis
      dataRecency: 0.9, // Based on publication dates
      consensusLevel: 0.85 // Agreement between sources
    };
    
    const score = (
      factors.sourceCount / 10 * 0.3 +
      factors.sourceQuality * 0.3 +
      factors.dataRecency * 0.2 +
      factors.consensusLevel * 0.2
    ) * 100;
    
    return Math.round(score);
  };

  const getSectionIcon = (title) => {
    const iconMap = {
      'Introduction': '📚',
      'Background': '📖',
      'Literature Review': '📋',
      'Current Evidence': '🔍',
      'Key Findings': '🎯',
      'Critical Analysis': '🧠',
      'Analysis': '📊',
      'Synthesis': '🔗',
      'Comparative': '⚖️',
      'Perspectives': '👥',
      'Conclusions': '🎯',
      'Future': '🚀',
      'References': '📚',
      'Methodology': '🔬',
      'Results': '📈',
      'Discussion': '💭'
    };
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (title.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return '📄';
  };

  const parseEnhancedSections = (content) => {
    const sections = {
      title: '',
      executiveSummary: [],
      keyFindings: [],
      sections: [],
      citations: [],
      methodology: null,
      references: []
    };
    
    const lines = content.split('\n');
    let currentSection = null;
    let sectionIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('# ')) {
        sections.title = line.replace('# ', '');
      } else if (line.toLowerCase().includes('executive summary') && line.startsWith('##')) {
        currentSection = { type: 'executive', content: [] };
      } else if (line.toLowerCase().includes('key findings') && line.startsWith('##')) {
        currentSection = { type: 'findings', content: [] };
      } else if (line.startsWith('## ') || line.startsWith('### ')) {
        // Handle both ## and ### headers
        if (currentSection?.type === 'executive') {
          sections.executiveSummary = currentSection.content;
        } else if (currentSection?.type === 'findings') {
          sections.keyFindings = currentSection.content;
        }
        
        const title = line.replace(/^##+ /, '');
        const sectionId = `section-${sectionIndex++}`;
        currentSection = {
          id: sectionId,
          type: 'section',
          title: title,
          content: [],
          icon: getSectionIcon(title),
          readingTime: 0,
          citations: []
        };
        
        // Check for special sections
        if (title.toLowerCase().includes('methodology')) {
          sections.methodology = currentSection;
        } else if (title.toLowerCase().includes('references')) {
          currentSection.type = 'references';
        }
        
        sections.sections.push(currentSection);
      } else if (line.startsWith('• ') && currentSection?.type === 'executive') {
        currentSection.content.push(line.replace('• ', ''));
      } else if (line.startsWith('• ') && currentSection?.type === 'findings') {
        currentSection.content.push(line.replace('• ', ''));
      } else if (line && currentSection) {
        // Don't add empty lines
        if (line.length > 0) {
          currentSection.content.push(line);
        }
        
        // Extract citations
        const citationMatches = line.match(/\[(\d+)\]|\(([^,]+), \d{4}\)/g);
        if (citationMatches) {
          sections.citations.push(...citationMatches);
        }
      }
    }
    
    // Handle final section
    if (currentSection?.type === 'executive') {
      sections.executiveSummary = currentSection.content;
    } else if (currentSection?.type === 'findings') {
      sections.keyFindings = currentSection.content;
    }
    

    
    // Calculate reading times with more realistic estimates
    sections.sections.forEach(section => {
      const text = section.content.join(' ');
      const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
      

      
      // More realistic reading time calculation
      if (wordCount < 50) {
        section.readingTime = 1;
      } else if (wordCount < 150) {
        section.readingTime = 2;
      } else if (wordCount < 300) {
        section.readingTime = 3;
      } else {
        section.readingTime = Math.max(1, Math.ceil(wordCount / 200));
      }
    });
    
    return sections;
  };

  // Organize messages first to get data for hooks
  const organizeMessages = () => {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    if (assistantMessages.length === 0) return { mainReport: null, addendums: [] };
    
    const mainReport = assistantMessages[0];
    const addendums = [];
    
    for (let i = 1; i < assistantMessages.length; i++) {
      addendums.push({
        question: userMessages[i]?.content || '',
        report: assistantMessages[i],
        index: i
      });
    }
    
    return { mainReport, addendums };
  };

  const { mainReport, addendums } = organizeMessages();
  
  // Parse sections early so we can use them in hooks
  const sections = mainReport ? parseEnhancedSections(mainReport.content) : { sections: [], executiveSummary: [], keyFindings: [], title: '' };
  const confidenceScore = mainReport ? calculateConfidenceScore(mainReport.metadata) : 0;
  const totalReadingTime = sections.sections.reduce((total, section) => total + section.readingTime, 0);
  const hasChart = mainReport?.metadata?.graph_data;



  // ALL HOOKS MUST BE HERE - before any early returns
  // Track active section on scroll
  useEffect(() => {
    if (!sections.sections.length) return;
    
    const handleScroll = () => {
      const sectionElements = sections.sections.map(section => 
        document.getElementById(section.id)
      ).filter(Boolean);

      const scrollPosition = window.scrollY + 100;

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        if (sectionElements[i].offsetTop <= scrollPosition) {
          setActiveSection(sections.sections[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections.sections]);
  
  // Early returns AFTER all hooks
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

  if (!mainReport) return null;

  // Helper functions
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(sectionId);
    }
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

  const handleSuggestionClick = (suggestion) => {
    if (isLoading) return;
    onFollowUp(suggestion);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  // Filter sections based on reading mode
  const filterSectionsByMode = (sections, mode) => {
    const readingModes = {
      scan: ['executive', 'keyFindings', 'conclusions'],
      study: 'all',
      action: ['conclusions', 'recommendations', 'future'],
      research: ['methodology', 'results', 'data', 'references']
    };

    if (mode === 'study' || readingModes[mode] === 'all') {
      return sections.sections;
    }

    const allowedTypes = readingModes[mode] || [];
    return sections.sections.filter(section => 
      allowedTypes.some(type => 
        section.title.toLowerCase().includes(type.toLowerCase())
      )
    );
  };

  const followUpSuggestions = mainReport.metadata?.followup_suggestions || [
    "What are the main risks and mitigation strategies?",
    "How does this compare across different regions?",
    "What are the implementation challenges?",
    "What's the future outlook?",
    "What are the policy implications?"
  ];

  // Reading mode configuration
  const readingModeConfig = {
    scan: { icon: '📱', name: 'Scan', description: 'Executive summary & key findings only' },
    study: { icon: '📖', name: 'Study', description: 'Complete report with all sections' },
    action: { icon: '🎯', name: 'Action', description: 'Conclusions, recommendations & next steps' },
    research: { icon: '🔬', name: 'Research', description: 'Methods, data, analysis & references' }
  };

  const confidenceFactors = {
    sourceDiversity: 8,
    dataRecency: 85,
    peerReviewPercentage: 75,
    consensusLevel: 90
  };

  // Components
  const TabSelector = () => (
    <div className="flex space-x-1 p-1 bg-gray-100 rounded-lg">
      <button
        onClick={() => setActiveTab('summary')}
        className={`flex items-center px-4 py-2 rounded-md transition-all text-sm font-medium ${
          activeTab === 'summary'
            ? 'bg-white shadow-sm text-blue-600'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <span className="mr-2">📄</span>
        Summary
      </button>
      <button
        onClick={() => setActiveTab('full-report')}
        className={`flex items-center px-4 py-2 rounded-md transition-all text-sm font-medium ${
          activeTab === 'full-report'
            ? 'bg-white shadow-sm text-blue-600'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <span className="mr-2">📚</span>
        Full Report
      </button>
    </div>
  );

  const ReadingModeSelector = () => (
    <div className="space-y-3">
      <div className="flex space-x-1 p-1 bg-gray-100 rounded-lg">
        {Object.entries(readingModeConfig).map(([mode, config]) => (
          <button
            key={mode}
            onClick={() => setReadingMode(mode)}
            className={`flex items-center px-3 py-2 rounded-md transition-all text-sm ${
              readingMode === mode
                ? 'bg-white shadow-sm text-blue-600 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title={config.description}
          >
            <span className="mr-1.5">{config.icon}</span>
            <span>{config.name}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
        <strong>{readingModeConfig[readingMode].name}:</strong> {readingModeConfig[readingMode].description}
      </p>
    </div>
  );

  const SectionNavigator = () => {
    // Create sections array with References section if chart exists
    const allSections = [...sections.sections];
    if (hasChart) {
      allSections.push({
        id: 'references-data-viz',
        title: 'References & Data Visualizations',
        icon: '📊',
        readingTime: 2
      });
    }
    
    return (
      <div className="sticky top-24 space-y-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Contents</h3>
          <span className="text-xs text-gray-500">{totalReadingTime + (hasChart ? 2 : 0)} min</span>
        </div>
        {allSections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border-l-3 ${
              activeSection === section.id
                ? 'bg-blue-50 text-blue-700 border-blue-500 font-medium'
                : 'hover:bg-gray-50 text-gray-600 border-transparent'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center">
                <span className="mr-2.5 text-base">{section.icon}</span>
                <span className="text-sm">{section.title}</span>
              </span>
              <span className="text-xs text-gray-400">{section.readingTime}m</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const ConfidenceIndicator = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <button
        onClick={() => setConfidenceExpanded(!confidenceExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
            confidenceScore >= 80 ? 'bg-green-100 text-green-700' :
            confidenceScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            <span className="text-xl font-bold">{confidenceScore}</span>
          </div>
          <div className="ml-3">
            <h3 className="font-semibold text-gray-900 text-sm">Confidence Score</h3>
            <p className="text-xs text-gray-600">Source quality & consensus</p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transform transition-transform ${
            confidenceExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {confidenceExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <FactorBar label="Source Diversity" value={confidenceFactors.sourceDiversity} max={10} />
          <FactorBar label="Data Recency" value={confidenceFactors.dataRecency} max={100} />
          <FactorBar label="Peer Review %" value={confidenceFactors.peerReviewPercentage} max={100} />
          <FactorBar label="Consensus Level" value={confidenceFactors.consensusLevel} max={100} />
        </div>
      )}
    </div>
  );

  const FactorBar = ({ label, value, max }) => (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{value}{max === 100 ? '%' : `/${max}`}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
    </div>
  );

  const SmartCitation = ({ number, sourceData }) => {
    const [showPreview, setShowPreview] = useState(false);
    
    return (
      <span className="relative inline-block">
        <button
          onMouseEnter={() => setShowPreview(true)}
          onMouseLeave={() => setShowPreview(false)}
          onClick={() => setHoveredCitation(number)}
          className="text-blue-600 hover:text-blue-700 underline decoration-dotted cursor-help text-sm"
        >
          [{number}]
        </button>
        
        {showPreview && sourceData && (
          <div className="absolute bottom-full left-0 mb-2 w-72 p-3 bg-white border border-gray-200 rounded-lg shadow-xl z-50 citation-preview">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <h4 className="font-semibold text-gray-900 text-sm">{sourceData.title}</h4>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  sourceData.type === 'peer-reviewed' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {sourceData.type}
                </span>
              </div>
              <p className="text-xs text-gray-600">{sourceData.authors} ({sourceData.year})</p>
              <p className="text-xs text-gray-700">{sourceData.preview}</p>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-gray-500">
                  Quality: {sourceData.qualityScore}/10
                </span>
                <a
                  href={sourceData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  View Source →
                </a>
              </div>
            </div>
          </div>
        )}
      </span>
    );
  };

  // Mock citation data (in real app, this would come from backend)
  const mockCitationData = {
    1: { title: "AI in Healthcare Systems", authors: "Smith et al.", year: 2023, type: "peer-reviewed", qualityScore: 9, preview: "Comprehensive analysis of AI applications...", url: "#" },
    2: { title: "Remote Work Productivity Study", authors: "Johnson & Lee", year: 2024, type: "peer-reviewed", qualityScore: 8, preview: "Longitudinal study on remote work...", url: "#" },
    3: { title: "Renewable Energy Trends", authors: "Green Energy Institute", year: 2024, type: "report", qualityScore: 7, preview: "Latest developments in renewable...", url: "#" }
  };

  // Enhanced content renderer with smart citations
  const renderContentWithCitations = (content) => {
    return content.replace(/\[(\d+)\]/g, (match, number) => {
      return `<SmartCitation number="${number}" sourceData={mockCitationData[${number}]} />`;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header with Tabs */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          {/* Report Title */}
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-xl">📘</span>
            <h1 className="text-lg font-bold text-gray-900">
              {sections.title || 'Research Report'}
            </h1>
          </div>
          
          {/* Tab Selector */}
          <div className="flex items-center justify-between mb-3">
            <TabSelector />
            {activeTab === 'summary' && (
              <div className="text-sm text-gray-600">
                Key insights and findings at a glance
              </div>
            )}
            {activeTab === 'full-report' && (
              <div className="text-sm text-gray-600">
                {readingModeConfig[readingMode].description}
              </div>
            )}
          </div>
          
          {/* Reading Mode Controls - Only show in Full Report */}
          {activeTab === 'full-report' && (
            <ReadingModeSelector />
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Section Navigator - Only show in Full Report */}
          <div className="col-span-3">
            {activeTab === 'full-report' ? (
              <SectionNavigator />
            ) : (
              <div className="space-y-6">
                {/* Summary Info */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Summary View</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>• Executive Summary</p>
                    <p>• Key Findings</p>
                    <p>• Quick Insights</p>
                    <p>• Charts & Visualizations</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('full-report')}
                    className="mt-3 w-full bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
                  >
                    View Full Report
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="col-span-6">
            {/* Enhanced Metadata Bar */}
            <div className="mb-6">
              <div className="flex items-center space-x-4 text-sm text-gray-500 bg-gray-50 px-4 py-3 rounded-lg">
                <span>Generated {new Date(mainReport.created_at || Date.now()).toLocaleDateString()}</span>
                <span>•</span>
                <span>5 Sources</span>
                <span>•</span>
                <span>{sections.sections.length} Sections</span>
                <span>•</span>
                <span>{totalReadingTime} min read</span>
                <span className="ml-auto flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    confidenceScore >= 80 ? 'bg-green-500' : 
                    confidenceScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-xs font-medium">
                    {confidenceScore >= 80 ? 'High' : confidenceScore >= 60 ? 'Medium' : 'Low'} Confidence
                  </span>
                </span>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'summary' && (
              <div className="space-y-8">
                {/* Executive Summary */}
                <section>
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                      <span className="mr-2">✨</span>
                      Executive Summary
                    </h2>
                    <div className="space-y-3">
                      {sections.executiveSummary.map((point, index) => (
                        <div key={index} className="flex items-start">
                          <span className="text-blue-600 mr-2 mt-1">•</span>
                          <p className="text-gray-700 leading-relaxed">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Key Findings */}
                {sections.keyFindings.length > 0 && (
                  <section>
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-6 rounded-r-lg">
                      <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <span className="mr-2">🎯</span>
                        Key Findings
                      </h2>
                      <div className="space-y-2">
                        {sections.keyFindings.map((finding, index) => (
                          <p key={index} className="text-gray-700">• {finding}</p>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* Quick Insights - Summary of key sections */}
                <section>
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="mr-2">💡</span>
                      Quick Insights
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sections.sections.slice(0, 4).map((section, index) => (
                        <div key={index} className="p-4 bg-gray-50 rounded-lg">
                          <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                            <span className="mr-2">{section.icon}</span>
                            {section.title}
                          </h3>
                          <p className="text-sm text-gray-600 line-clamp-3">
                            {section.content.slice(0, 2).join(' ').substring(0, 150)}...
                          </p>
                          <div className="mt-2 text-xs text-gray-500">
                            {section.readingTime} min read
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Chart in Summary View */}
                {hasChart && (
                  <section>
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <span className="mr-2">📊</span>
                        Key Data Insights
                      </h2>
                      <ChartDisplay graphData={mainReport.metadata.graph_data} />
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* Full Report Content */}
            {activeTab === 'full-report' && (
              <div className="space-y-6">
                {filterSectionsByMode(sections, readingMode).map((section, index) => (
                  <React.Fragment key={section.id}>
                    <section id={section.id} className="scroll-mt-32">
                      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                              <span className="text-xl mr-3">{section.icon}</span>
                              {section.title}
                            </h3>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">{section.readingTime} min</span>
                              <button
                                onClick={() => copyToClipboard(section.content.join('\n'), section.title)}
                                className="text-gray-400 hover:text-gray-600 p-1.5 rounded"
                                title="Copy section"
                              >
                                {copiedSection === section.title ? (
                                  <span className="text-green-500 text-sm">✓</span>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="px-6 py-6">
                          <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {section.content.join('\n')}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </section>
                    

                  </React.Fragment>
                ))}
                
                {/* References & Data Visualizations Section - At the End */}
                {hasChart && (
                  <section id="references-data-viz" className="scroll-mt-32">
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <span className="text-xl mr-3">📊</span>
                          References & Data Visualizations
                        </h3>
                      </div>
                      <div className="px-6 py-6">
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 leading-relaxed">
                            The following data visualization provides quantitative insights and supporting evidence for the analysis presented in this report.
                          </p>
                        </div>
                        <ChartDisplay graphData={mainReport.metadata.graph_data} />
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}



            {/* Loading State for Follow-ups */}
            {isLoading && messages.length > 0 && (
              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-3"></div>
                  <h4 className="font-semibold text-gray-900 mb-2">Generating Follow-up Research</h4>
                  <p className="text-sm text-gray-600">
                    Analyzing your question and generating comprehensive insights...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Quality Indicators & Tools */}
          <div className="col-span-3 space-y-6">
            {/* Confidence Indicator */}
            <ConfidenceIndicator />

            {/* Reading Stats */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Reading Progress</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Current View</span>
                  <span className="font-medium text-gray-900">
                    {activeTab === 'summary' ? 'Summary' : readingModeConfig[readingMode].name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sections</span>
                  <span className="font-medium text-gray-900">
                    {activeTab === 'summary' ? '3' : filterSectionsByMode(sections, readingMode).length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Est. Time</span>
                  <span className="font-medium text-gray-900">
                    {activeTab === 'summary' ? '3-5m' : `${totalReadingTime}m`}
                  </span>
                </div>
              </div>
            </div>

            {/* Follow-up Suggestions */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm flex items-center">
                <span className="mr-2">🔍</span>
                Follow-up Questions
              </h4>
              <div className="space-y-2">
                {followUpSuggestions.slice(0, 4).map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left p-3 text-xs bg-gray-50 hover:bg-gray-100 rounded border transition-colors"
                    disabled={isLoading}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Options */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Export Options</h4>
              <div className="space-y-2">
                <button
                  onClick={onExportPDF}
                  className="w-full text-left p-2 text-xs hover:bg-gray-50 rounded flex items-center"
                >
                  <span className="mr-2">📄</span>
                  Export as PDF
                </button>
                <button
                  onClick={onExportMarkdown}
                  className="w-full text-left p-2 text-xs hover:bg-gray-50 rounded flex items-center"
                >
                  <span className="mr-2">📝</span>
                  Download Markdown
                </button>
                <button
                  onClick={onExportJSON}
                  className="w-full text-left p-2 text-xs hover:bg-gray-50 rounded flex items-center"
                >
                  <span className="mr-2">💾</span>
                  Export JSON Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add CSS for smooth scrolling and animations */}
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        
        .citation-preview {
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default EnhancedResearchDisplay; 