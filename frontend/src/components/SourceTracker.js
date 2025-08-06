import React, { useState, useEffect, useCallback } from 'react';

const SourceTracker = ({ messages, onClose }) => {
  const [sources, setSources] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sourceTypes = [
    { id: 'all', name: 'All Sources', icon: '📚' },
    { id: 'academic', name: 'Academic', icon: '🎓' },
    { id: 'news', name: 'News', icon: '📰' },
    { id: 'government', name: 'Government', icon: '🏛️' },
    { id: 'web', name: 'Web', icon: '🌐' }
  ];

  const extractSources = useCallback(() => {
    setIsLoading(true);
    
    try {
      const extractedSources = [];
      const seenUrls = new Set();

      messages.forEach(message => {
        if (message.role === 'assistant' && message.content) {
          // Extract URLs from the content
          const urlRegex = /https?:\/\/[^\s]+/g;
          const urls = message.content.match(urlRegex) || [];
          
          urls.forEach(url => {
            if (!seenUrls.has(url)) {
              seenUrls.add(url);
              const source = {
                url,
                title: extractTitleFromUrl(url),
                domain: extractDomainFromUrl(url),
                type: determineSourceType(url),
                date: extractDateFromUrl(url),
                relevance: calculateRelevance(url, message.content),
                status: 'active'
              };
              extractedSources.push(source);
            }
          });
        }
      });

      setSources(extractedSources);
    } catch (error) {
      console.error('Error extracting sources:', error);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      extractSources();
    }
  }, [extractSources, messages.length]);

  const extractTitleFromUrl = (url) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '').split('.')[0];
    } catch {
      return 'Unknown Source';
    }
  };

  const extractDomainFromUrl = (url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const extractDateFromUrl = (url) => {
    // This would typically be extracted from the actual content
    // For now, we'll return current year
    return new Date().getFullYear();
  };

  const determineSourceType = (url) => {
    const domain = url.toLowerCase();
    if (domain.includes('arxiv') || domain.includes('researchgate') || domain.includes('scholar')) return 'academic';
    if (domain.includes('news') || domain.includes('bbc') || domain.includes('cnn') || domain.includes('reuters')) return 'news';
    if (domain.includes('gov') || domain.includes('government') || domain.includes('whitehouse')) return 'government';
    if (domain.includes('edu') || domain.includes('university') || domain.includes('college')) return 'academic';
    return 'web';
  };

  const calculateRelevance = (url, content) => {
    // Simple relevance calculation based on URL presence in content
    const urlCount = (content.match(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (urlCount > 2) return 'high';
    if (urlCount > 0) return 'medium';
    return 'low';
  };

  const filteredSources = sources.filter(source => {
    const matchesType = filterType === 'all' || source.type === filterType;
    const matchesSearch = source.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         source.domain.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getSourceTypeIcon = (type) => {
    const typeMap = {
      academic: '🎓',
      news: '📰',
      government: '🏛️',
      web: '🌐'
    };
    return typeMap[type] || '📄';
  };

  const getRelevanceColor = (relevance) => {
    const colorMap = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-gray-100 text-gray-800'
    };
    return colorMap[relevance] || 'bg-gray-100 text-gray-800';
  };

  const openSource = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Source Tracker</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Filters and Search */}
          <div className="mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Source Type Filter */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {sourceTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setFilterType(type.id)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        filterType === type.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className="mr-1">{type.icon}</span>
                      {type.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Sources
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title or domain..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Sources List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Sources ({filteredSources.length})
              </h3>
              <div className="text-sm text-gray-500">
                {sources.length} total sources
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-gray-600">Extracting sources...</p>
              </div>
            ) : filteredSources.length > 0 ? (
              <div className="grid gap-4">
                {filteredSources.map((source, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getSourceTypeIcon(source.type)}</span>
                          <h4 className="font-medium text-gray-900">{source.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRelevanceColor(source.relevance)}`}>
                            {source.relevance} relevance
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{source.domain}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>Type: {source.type}</span>
                          <span>Date: {source.date}</span>
                          <span>Status: {source.status}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => openSource(source.url)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => copyUrl(source.url)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                        >
                          Copy URL
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <p>No sources found matching your criteria.</p>
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

export default SourceTracker; 