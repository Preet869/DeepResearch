import React, { useState, useEffect, useCallback } from 'react';

const CitationHelper = ({ messages, onClose }) => {
  const [citationStyle, setCitationStyle] = useState('apa');
  const [citations, setCitations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const citationStyles = [
    { id: 'apa', name: 'APA', description: 'American Psychological Association' },
    { id: 'mla', name: 'MLA', description: 'Modern Language Association' },
    { id: 'chicago', name: 'Chicago', description: 'Chicago Manual of Style' },
    { id: 'harvard', name: 'Harvard', description: 'Harvard Referencing' }
  ];

  const generateCitations = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const extractSourcesFromMessages = (messages) => {
        const sources = [];
        const seenUrls = new Set();

        messages.forEach(message => {
          if (message.role === 'assistant' && message.content) {
            const urlRegex = /https?:\/\/[^\s]+/g;
            const urls = message.content.match(urlRegex) || [];
            
            urls.forEach(url => {
              if (!seenUrls.has(url)) {
                seenUrls.add(url);
                sources.push({
                  url,
                  title: extractTitleFromUrl(url),
                  author: extractAuthorFromUrl(url),
                  date: extractDateFromUrl(url),
                  type: determineSourceType(url)
                });
              }
            });
          }
        });

        return sources;
      };

      const extractTitleFromUrl = (url) => {
        try {
          const domain = new URL(url).hostname;
          return domain.replace('www.', '').split('.')[0];
        } catch {
          return 'Unknown Source';
        }
      };

      const extractAuthorFromUrl = (url) => {
        return 'Unknown Author';
      };

      const extractDateFromUrl = (url) => {
        return new Date().getFullYear();
      };

      const determineSourceType = (url) => {
        const domain = url.toLowerCase();
        if (domain.includes('arxiv') || domain.includes('researchgate')) return 'academic';
        if (domain.includes('news') || domain.includes('bbc') || domain.includes('cnn')) return 'news';
        if (domain.includes('gov') || domain.includes('government')) return 'government';
        if (domain.includes('edu') || domain.includes('university')) return 'academic';
        return 'web';
      };

      const generateCitationForSource = (source, style) => {
        const { title, author, date, url } = source;
        
        switch (style) {
          case 'apa':
            return `${author}. (${date}). ${title}. Retrieved from ${url}`;
          case 'mla':
            return `${author}. "${title}." ${new Date().getFullYear()}, ${url}`;
          case 'chicago':
            return `${author}. "${title}." ${date}. ${url}`;
          case 'harvard':
            return `${author} (${date}) '${title}', ${url}`;
          default:
            return `${author}. (${date}). ${title}. Retrieved from ${url}`;
        }
      };

      // Extract sources from messages
      const sources = extractSourcesFromMessages(messages);
      
      // Generate citations for each source
      const generatedCitations = sources.map(source => ({
        ...source,
        citations: generateCitationForSource(source, citationStyle)
      }));
      
      setCitations(generatedCitations);
    } catch (error) {
      console.error('Error generating citations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [messages, citationStyle]);

  useEffect(() => {
    if (messages.length > 0) {
      generateCitations();
    }
  }, [generateCitations, messages.length]);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const copyAllCitations = async () => {
    const allCitations = citations
      .map(citation => citation.citations)
      .join('\n\n');
    
    await copyToClipboard(allCitations);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Citation Helper</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Citation Style Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Citation Style
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {citationStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setCitationStyle(style.id)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    citationStyle === style.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{style.name}</div>
                  <div className="text-xs text-gray-500">{style.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Citations List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Generated Citations ({citations.length})
              </h3>
              {citations.length > 0 && (
                <button
                  onClick={copyAllCitations}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Copy All
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-gray-600">Generating citations...</p>
              </div>
            ) : citations.length > 0 ? (
              <div className="space-y-4">
                {citations.map((citation, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{citation.title}</h4>
                        <p className="text-sm text-gray-500">{citation.url}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(citation.citations)}
                        className="ml-4 px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm text-gray-700 font-mono">{citation.citations}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No sources found in the current research.</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitationHelper; 