import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';
import ChartDisplay from './ChartDisplay';

const ComparisonReportDisplay = ({ messages, isLoading, onFollowUp }) => {
  const [activeTab, setActiveTab] = useState('comparison'); // comparison, article1, article2
  const [copiedSection, setCopiedSection] = useState(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showContext, setShowContext] = useState(false);

  if (!messages || messages.length === 0) {
    return null;
  }

  const mainReport = messages.find(m => m.role === 'assistant');
  if (!mainReport) {
    return null;
  }

  const isComparisonReport = mainReport.metadata?.comparison_type === 'article_comparison';
  const comparisonSummary = mainReport.metadata?.graph_data?.comparison_summary;

  const copyToClipboard = async (text, sectionName) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionName);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const parseComparisonSections = (content) => {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    let sectionIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('## ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          id: `section-${sectionIndex}`,
          title: line.replace('## ', ''),
          content: [],
          icon: getSectionIcon(line.replace('## ', ''))
        };
        sectionIndex++;
      } else if (line.startsWith('### ')) {
        if (currentSection) {
          currentSection.content.push(`**${line.replace('### ', '')}**`);
        }
      } else if (line && currentSection) {
        currentSection.content.push(line);
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  };

  const getSectionIcon = (title) => {
    const iconMap = {
      'Executive Summary': '📋',
      'Comparative Overview': '👥',
      'Detailed Comparative Analysis': '🔍',
      'Methodological Comparison': '🔬',
      'Findings and Evidence Comparison': '📊',
      'Theoretical Framework Comparison': '🧠',
      'Practical Implications Comparison': '🎯',
      'Synthesis and Integration': '🔗',
      'Critical Assessment': '⚖️',
      'Recommendations for Further Research': '🚀',
      'Conclusion': '✅'
    };
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (title.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return '📄';
  };

  const sections = parseComparisonSections(mainReport.content);
  const hasChart = mainReport.metadata && mainReport.metadata.graph_data;

  const exportToPDF = () => {
    const MM_MARGIN = 20;
    const MM_MAX_WIDTH = 170;
    const MM_FOOTER = 18;

    const ptToMm = (pt) => (pt / 72) * 25.4;
    const lineHeightMm = (fontSizePt, factor = 1.2) => ptToMm(fontSizePt) * factor;

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageW = () => doc.internal.pageSize.getWidth();
    const pageH = () => doc.internal.pageSize.getHeight();
    const contentBottom = () => pageH() - MM_FOOTER;
    let y = MM_MARGIN;

    const newPage = () => {
      doc.addPage();
      y = MM_MARGIN;
    };

    const ensureSpace = (neededMm) => {
      if (y + neededMm > contentBottom()) {
        newPage();
      }
    };

    const writeWrapped = (text, fontSizePt, fontStyle, extraAfterBlock = 0) => {
      doc.setFont('helvetica', fontStyle);
      doc.setFontSize(fontSizePt);
      const lh = lineHeightMm(fontSizePt);
      const chunks = doc.splitTextToSize(text || ' ', MM_MAX_WIDTH);
      for (const line of chunks) {
        ensureSpace(lh);
        doc.text(line, MM_MARGIN, y, { baseline: 'top' });
        y += lh;
      }
      y += extraAfterBlock;
    };

    const addPageNumbers = () => {
      const total = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      for (let i = 1; i <= total; i += 1) {
        doc.setPage(i);
        doc.text(
          `Page ${i} of ${total}`,
          pageW() / 2,
          pageH() - 10,
          { align: 'center', baseline: 'middle' },
        );
      }
    };

    const title1 = mainReport.metadata?.article1_title || 'Article 1';
    const title2 = mainReport.metadata?.article2_title || 'Article 2';
    const bodyText = String(mainReport.content || '').trim();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    {
      const titleLines = doc.splitTextToSize('Article Comparison Report', MM_MAX_WIDTH);
      const lh = lineHeightMm(16);
      for (const line of titleLines) {
        ensureSpace(lh);
        doc.text(line, MM_MARGIN, y, { baseline: 'top' });
        y += lh;
      }
      y += 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    writeWrapped(`Article 1: ${title1}`, 12, 'bold', 1);
    doc.setFont('helvetica', 'bold');
    writeWrapped(`Article 2: ${title2}`, 12, 'bold', 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    {
      const lh = lineHeightMm(11);
      ensureSpace(lh);
      doc.text(`Generated: ${new Date().toLocaleString()}`, MM_MARGIN, y, { baseline: 'top' });
      y += lh + 3;
    }

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    ensureSpace(2);
    doc.line(MM_MARGIN, y, MM_MARGIN + MM_MAX_WIDTH, y);
    y += 5;

    const renderBodyMarkdown = (body) => {
      const lines = (body || '').split('\n');
      for (const rawLine of lines) {
        const line = rawLine ?? '';
        const isH2 = /^##\s/.test(line) && !/^###\s/.test(line);
        if (isH2) {
          const headerPlain = line.replace(/^##\s+/, '').trim() || line;
          writeWrapped(headerPlain, 13, 'bold', 2);
        } else if (line.trim() === '') {
          y += lineHeightMm(11) * 0.35;
          ensureSpace(lineHeightMm(11) * 0.35);
        } else {
          writeWrapped(line, 11, 'normal', 1);
        }
      }
    };

    if (!bodyText) {
      writeWrapped('No comparison content to export.', 11, 'normal', 0);
    } else {
      renderBodyMarkdown(bodyText);
    }

    addPageNumbers();
    doc.save('article-comparison-report.pdf');
  };

  // Enhanced granular export functions
  const copyExecutiveSummary = () => {
    const execSection = sections.find(s => s.title.toLowerCase().includes('executive summary'));
    if (execSection) {
      copyToClipboard(execSection.content.join('\n'), 'Executive Summary');
    }
  };

  const copyComparisonTable = () => {
    const overviewSection = sections.find(s => s.title.toLowerCase().includes('comparative overview'));
    if (overviewSection) {
      // Extract table content if it exists
      const tableContent = overviewSection.content.find(line => line.includes('|'));
      if (tableContent) {
        const tableLines = overviewSection.content.filter(line => line.includes('|') || line.includes('---'));
        copyToClipboard(tableLines.join('\n'), 'Comparison Table');
      } else {
        copyToClipboard(overviewSection.content.join('\n'), 'Comparative Overview');
      }
    }
  };

  const copySummaryCard = () => {
    if (comparisonSummary) {
      const summaryText = `
# Comparison Summary

**Similarity Score:** ${comparisonSummary.similarity_score}%

**Key Differences:**
${comparisonSummary.key_differences?.map(d => `• ${d}`).join('\n') || 'None listed'}

**Complementary Areas:**
${comparisonSummary.complementary_areas?.map(a => `• ${a}`).join('\n') || 'None listed'}

**Conflicting Areas:**
${comparisonSummary.conflicting_areas?.map(a => `• ${a}`).join('\n') || 'None listed'}

${comparisonSummary.student_recommendation ? `**Student Recommendation:** ${comparisonSummary.student_recommendation}` : ''}

${comparisonSummary.citation_strategy ? `**Citation Strategy:** ${comparisonSummary.citation_strategy}` : ''}
      `.trim();
      copyToClipboard(summaryText, 'Summary Card');
    }
  };

  const ComparisonSummaryCard = () => {
    if (!comparisonSummary) return null;

    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">📊</span>
          Smart Comparison Summary
        </h3>
        
        {/* Context Display */}
        {mainReport.metadata?.context && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <span className="mr-2">🎯</span>
                <span className="font-medium text-gray-900">Context</span>
              </div>
              <button
                onClick={() => setShowContext(!showContext)}
                className="flex items-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
                title={showContext ? "Hide context" : "Show context"}
              >
                <svg className={`w-3 h-3 mr-1 transition-transform ${showContext ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {showContext ? 'Hide' : 'Show'}
              </button>
            </div>
            {showContext && (
              <p className="text-sm text-gray-700">{mainReport.metadata.context}</p>
            )}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Similarity Score</span>
                <span className="text-lg font-bold text-blue-600">{comparisonSummary.similarity_score}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${comparisonSummary.similarity_score}%` }}
                ></div>
              </div>
            </div>
            
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Key Differences</h4>
              <ul className="space-y-1">
                {comparisonSummary.key_differences?.map((diff, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    {diff}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div>
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Complementary Areas</h4>
              <ul className="space-y-1">
                {comparisonSummary.complementary_areas?.map((area, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    {area}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Conflicting Areas</h4>
              <ul className="space-y-1">
                {comparisonSummary.conflicting_areas?.map((area, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* New Smart Features */}
        {(comparisonSummary.student_recommendation || comparisonSummary.citation_strategy) && (
          <div className="mt-6 pt-4 border-t border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {comparisonSummary.student_recommendation && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-1 flex items-center">
                    <span className="mr-1">🎓</span>
                    Student Recommendation
                  </h4>
                  <p className="text-sm text-green-800">{comparisonSummary.student_recommendation}</p>
                </div>
              )}
              {comparisonSummary.citation_strategy && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-1 flex items-center">
                    <span className="mr-1">📚</span>
                    Citation Strategy
                  </h4>
                  <p className="text-sm text-purple-800">{comparisonSummary.citation_strategy}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const ArticleMetadataCard = ({ title, subtitle, color = 'blue' }) => (
    <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4`}>
      <h4 className={`font-semibold text-${color}-900 mb-1`}>{title}</h4>
      <p className={`text-sm text-${color}-700`}>{subtitle}</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <span className="mr-3">⚖️</span>
              Article Comparison Analysis
            </h1>
                         <p className="text-gray-600 mt-1">
               Comprehensive comparative analysis with data insights
             </p>
           </div>
           <div className="flex items-center space-x-4">
             <div className="text-sm text-gray-500">
               Generated {new Date(mainReport.created_at || Date.now()).toLocaleDateString()}
             </div>
             
             {/* Export Button */}
             <div className="relative">
               <button
                 onClick={() => setShowExportDropdown(!showExportDropdown)}
                 className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                 title="Export Options"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
               </button>
               
               {showExportDropdown && (
                 <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-52 z-20">
                   {/* Full Document Exports */}
                   <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
                     Full Document
                   </div>
                   <button
                     onClick={() => {
                       exportToPDF();
                       setShowExportDropdown(false);
                     }}
                     className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center text-sm"
                   >
                     <span className="mr-2">📄</span>
                     Export PDF
                   </button>
                   
                   {/* Granular Exports */}
                   <div className="px-3 py-2 text-xs font-medium text-gray-500 border-t border-gray-100 mt-1">
                     Copy Sections
                   </div>
                   <button
                     onClick={() => {
                       copyExecutiveSummary();
                       setShowExportDropdown(false);
                     }}
                     className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center text-sm"
                   >
                     <span className="mr-2">📋</span>
                     Executive Summary
                   </button>
                   <button
                     onClick={() => {
                       copyComparisonTable();
                       setShowExportDropdown(false);
                     }}
                     className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center text-sm"
                   >
                     <span className="mr-2">📊</span>
                     Comparison Table
                   </button>
                   <button
                     onClick={() => {
                       copySummaryCard();
                       setShowExportDropdown(false);
                     }}
                     className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center text-sm"
                   >
                     <span className="mr-2">💡</span>
                     Summary Card
                   </button>
                 </div>
               )}
             </div>
           </div>
        </div>

        {/* Article Metadata */}
        {isComparisonReport && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <ArticleMetadataCard 
              title={mainReport.metadata.article1_title || 'Article 1'}
              subtitle="First Article"
              color="blue"
            />
            <ArticleMetadataCard 
              title={mainReport.metadata.article2_title || 'Article 2'}
              subtitle="Second Article"
              color="green"
            />
          </div>
        )}

        {/* Comparison Summary */}
        <ComparisonSummaryCard />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('comparison')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'comparison'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Comparison Analysis
          </button>
          <button
            onClick={() => setActiveTab('visualization')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'visualization'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Data Visualization
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {activeTab === 'comparison' && (
          <div className="p-8">
            <div className="space-y-8">
              {sections.map((section, index) => (
                <section key={section.id} className="border-b border-gray-100 pb-8 last:border-b-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                      <span className="mr-3 text-2xl">{section.icon}</span>
                      {section.title}
                    </h2>
                    <button
                      onClick={() => copyToClipboard(section.content.join('\n'), section.title)}
                      className="text-gray-400 hover:text-gray-600 p-2 rounded-md hover:bg-gray-100 transition-colors"
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
                  <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {section.content.join('\n')}
                    </ReactMarkdown>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'visualization' && (
          <div className="p-8">
            {hasChart ? (
              <>
                <ChartDisplay graphData={mainReport.metadata.graph_data} />
                <p
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    fontStyle: 'italic',
                    marginTop: '12px',
                  }}
                >
                  Scores are AI-assessed based on article content and represent relative
                  comparisons, not absolute quality metrics.
                </p>
              </>
            ) : (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Visualization Available</h3>
                <p className="text-gray-600">This comparison report doesn't include data visualizations.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Smart Student Tools */}
      <div className="mt-8 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">🎓</span>
          Smart Student Tools
        </h3>
        
        {/* Interactive Enhancement Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => {
              const contextPrompt = mainReport.metadata?.context 
                ? `Based on the context "${mainReport.metadata.context}", generate a sample essay introduction paragraph that incorporates both articles from this comparison.`
                : "Generate a sample essay introduction paragraph that incorporates both articles from this comparison.";
              onFollowUp && onFollowUp(contextPrompt);
            }}
            className="p-4 bg-white rounded-lg border-2 border-green-300 hover:border-green-400 hover:bg-green-50 transition-colors text-left"
          >
            <div className="font-medium text-gray-900 flex items-center">
              <span className="mr-2">💡</span>
              Essay Help
            </div>
            <div className="text-sm text-gray-600 mt-1">Generate sample intro + comparison paragraph</div>
          </button>

          <button
            onClick={() => {
              const contextPrompt = mainReport.metadata?.context 
                ? `Based on the context "${mainReport.metadata.context}" and this article comparison, generate 3 smart research questions that could guide further investigation.`
                : "Based on this article comparison, generate 3 smart research questions that could guide further investigation.";
              onFollowUp && onFollowUp(contextPrompt);
            }}
            className="p-4 bg-white rounded-lg border-2 border-blue-300 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
          >
            <div className="font-medium text-gray-900 flex items-center">
              <span className="mr-2">🎯</span>
              Research Questions
            </div>
            <div className="text-sm text-gray-600 mt-1">3 smart, citation-backed questions to explore</div>
          </button>

          <button
            onClick={() => {
              const contextPrompt = mainReport.metadata?.context 
                ? `Highlight and explain the matching concepts between both articles that are relevant to "${mainReport.metadata.context}".`
                : "Highlight and explain the matching concepts and themes that appear in both articles.";
              onFollowUp && onFollowUp(contextPrompt);
            }}
            className="p-4 bg-white rounded-lg border-2 border-purple-300 hover:border-purple-400 hover:bg-purple-50 transition-colors text-left"
          >
            <div className="font-medium text-gray-900 flex items-center">
              <span className="mr-2">📌</span>
              Matching Concepts
            </div>
            <div className="text-sm text-gray-600 mt-1">Auto-highlight shared topics and themes</div>
          </button>
        </div>

        {/* Standard Follow-up Actions */}
        <h4 className="font-medium text-gray-900 mb-3">Additional Analysis</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => {
              const contextPrompt = mainReport.metadata?.context 
                ? `What are the practical implications of these article differences for "${mainReport.metadata.context}"?`
                : "What are the practical implications of these differences?";
              onFollowUp && onFollowUp(contextPrompt);
            }}
            className="p-3 text-left bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <div className="font-medium text-gray-900">Practical Implications</div>
            <div className="text-xs text-gray-600 mt-1">Explore real-world applications</div>
          </button>
          <button
            onClick={() => {
              const contextPrompt = mainReport.metadata?.context 
                ? `How should I cite both articles effectively for "${mainReport.metadata.context}"?`
                : "How should I cite both articles effectively in my work?";
              onFollowUp && onFollowUp(contextPrompt);
            }}
            className="p-3 text-left bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <div className="font-medium text-gray-900">Citation Strategy</div>
            <div className="text-xs text-gray-600 mt-1">Best practices for referencing both</div>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 px-6 py-4 flex items-center space-x-4">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
          <div className="text-sm">
            <p className="font-medium text-gray-900">Generating follow-up analysis...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonReportDisplay; 