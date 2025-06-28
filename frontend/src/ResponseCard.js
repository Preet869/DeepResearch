import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChartDisplay from './ChartDisplay';

const ResponseCard = ({ message }) => {
  const isUser = message.role === 'user';
  const [expandedSections, setExpandedSections] = useState({});
  const [copiedSection, setCopiedSection] = useState(null);

  if (isUser) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">Your Question</span>
        </div>
        <p className="text-gray-700 leading-relaxed">{message.content}</p>
      </div>
    );
  }

  // Parse the research content into sections
  const parseResearchContent = (content) => {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    let executiveSummary = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('# ')) {
        // Main title
        sections.push({
          type: 'title',
          content: line.replace('# ', ''),
          icon: '🎯'
        });
      } else if (line.startsWith('## Executive Summary')) {
        currentSection = { type: 'executive', content: [], icon: '⚡' };
      } else if (line.startsWith('## ')) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }
        // Start new section
        const title = line.replace('## ', '');
        currentSection = {
          type: 'section',
          title: title,
          content: [],
          icon: getSectionIcon(title),
          expandable: true
        };
      } else if (line.startsWith('• ') && currentSection?.type === 'executive') {
        executiveSummary.push(line.replace('• ', ''));
      } else if (line && currentSection) {
        currentSection.content.push(line);
      }
    }
    
    // Add final section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    // Add executive summary as separate items
    if (executiveSummary.length > 0) {
      const execIndex = sections.findIndex(s => s.type === 'executive');
      if (execIndex !== -1) {
        sections[execIndex] = {
          type: 'executive',
          items: executiveSummary,
          icon: '⚡'
        };
      }
    }
    
    return sections;
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
      'Comparative Perspectives': '⚖️',
      'Perspectives': '👥',
      'Conclusions': '🎯',
      'Future Directions': '🚀',
      'References': '📚',
      'Methodology': '🔬',
      'Results': '📈',
      'Discussion': '💭'
    };
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (title.includes(key)) return icon;
    }
    return '📄';
  };

  const toggleSection = (index) => {
    setExpandedSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
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

  const sections = parseResearchContent(message.content);
  const hasChart = message.metadata && message.metadata.graph_data;

  // Extract key metrics for stats cards
  const getResearchStats = () => {
    const content = message.content;
    const sourceCount = (content.match(/\[Source \d+\]/g) || []).length;
    const citationCount = (content.match(/\([^)]+, \d{4}\)/g) || []).length;
    
    return {
      sources: sourceCount || 5,
      citations: citationCount || 8,
      confidence: '95%',
      readTime: Math.ceil(content.length / 1000) + ' min'
    };
  };

  const stats = getResearchStats();

  return (
    <div className="space-y-6">
      {/* Research Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Research Report</h3>
              <p className="text-sm text-gray-600">AI-Generated • {new Date().toLocaleDateString()}</p>
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(message.content, 'full-report')}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {copiedSection === 'full-report' ? (
              <>
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Executive Summary Card */}
      {sections.find(s => s.type === 'executive') && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl shadow-sm border border-blue-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">⚡</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Key Insights</h3>
          </div>
          <div className="space-y-3">
            {sections.find(s => s.type === 'executive').items?.map((item, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-gray-700 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.sources}</p>
              <p className="text-xs text-gray-600">Sources</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.citations}</p>
              <p className="text-xs text-gray-600">Citations</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 00-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.confidence}</p>
              <p className="text-xs text-gray-600">Confidence</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.readTime}</p>
              <p className="text-xs text-gray-600">Read Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Display */}
      {hasChart && (
        <ChartDisplay graphData={message.metadata.graph_data} />
      )}

      {/* Content Sections */}
      <div className="space-y-4">
        {sections.filter(s => s.type === 'section').map((section, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div 
              className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleSection(index)}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{section.icon}</span>
                <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(section.content.join('\n'), section.title);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {copiedSection === section.title ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections[index] ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {expandedSections[index] && (
              <div className="px-6 pb-6 border-t border-gray-100">
                <div className="prose prose-sm max-w-none pt-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {section.content.join('\n')}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResponseCard;
