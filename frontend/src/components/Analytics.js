import React, { useState, useEffect, useCallback } from 'react';

const Analytics = ({ messages, onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const calculateAnalytics = useCallback(() => {
    setIsLoading(true);
    
    try {
      const calculateTotalWords = () => {
        return messages.reduce((total, message) => {
          return total + message.content.split(/\s+/).filter(word => word.length > 0).length;
        }, 0);
      };

      const calculateAverageWordsPerMessage = () => {
        const totalWords = calculateTotalWords();
        return messages.length > 0 ? Math.round(totalWords / messages.length) : 0;
      };

      const extractSourceCount = () => {
        const sources = new Set();
        messages.forEach(message => {
          if (message.role === 'assistant' && message.content) {
            const urlRegex = /https?:\/\/[^\s]+/g;
            const urls = message.content.match(urlRegex) || [];
            urls.forEach(url => sources.add(url));
          }
        });
        return sources.size;
      };

      const extractResearchTopics = () => {
        const topics = new Set();
        messages.forEach(message => {
          if (message.role === 'user') {
            const words = message.content.toLowerCase().split(/\s+/);
            const keyWords = words.filter(word => 
              word.length > 4 && 
              !['what', 'when', 'where', 'which', 'about', 'research', 'study', 'analysis'].includes(word)
            );
            keyWords.slice(0, 3).forEach(word => topics.add(word));
          }
        });
        return Array.from(topics).slice(0, 5);
      };

      const calculateTimeSpent = () => {
        const totalWords = calculateTotalWords();
        const readingSpeed = 200;
        const minutes = Math.round(totalWords / readingSpeed);
        return minutes;
      };

      const calculateComplexityScore = () => {
        let totalSentences = 0;
        let totalWords = 0;
        let longWords = 0;
        
        messages.forEach(message => {
          const sentences = message.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
          totalSentences += sentences.length;
          
          const words = message.content.split(/\s+/).filter(word => word.length > 0);
          totalWords += words.length;
          
          words.forEach(word => {
            if (word.length > 6) longWords++;
          });
        });
        
        const avgSentenceLength = totalSentences > 0 ? totalWords / totalSentences : 0;
        const longWordRatio = totalWords > 0 ? longWords / totalWords : 0;
        
        const complexity = (avgSentenceLength * 0.6 + longWordRatio * 100 * 0.4);
        return Math.min(100, Math.round(complexity));
      };

      const analyzeSentiment = () => {
        const positiveWords = ['good', 'great', 'excellent', 'positive', 'beneficial', 'successful', 'improved'];
        const negativeWords = ['bad', 'poor', 'negative', 'problem', 'issue', 'failed', 'worse'];
        
        let positiveCount = 0;
        let negativeCount = 0;
        
        messages.forEach(message => {
          const content = message.content.toLowerCase();
          positiveWords.forEach(word => {
            if (content.includes(word)) positiveCount++;
          });
          negativeWords.forEach(word => {
            if (content.includes(word)) negativeCount++;
          });
        });
        
        const total = positiveCount + negativeCount;
        if (total === 0) return 'neutral';
        
        const ratio = positiveCount / total;
        if (ratio > 0.6) return 'positive';
        if (ratio < 0.4) return 'negative';
        return 'neutral';
      };

      const extractKeyInsights = () => {
        const insights = [];
        const sourceCount = extractSourceCount();
        const totalWords = calculateTotalWords();
        const complexityScore = calculateComplexityScore();
        const userMessages = messages.filter(m => m.role === 'user').length;
        
        if (sourceCount > 5) {
          insights.push('Comprehensive research with multiple sources');
        }
        
        if (totalWords > 1000) {
          insights.push('Detailed analysis with substantial content');
        }
        
        if (complexityScore > 70) {
          insights.push('High complexity research topic');
        }
        
        if (userMessages > 3) {
          insights.push('Iterative research process with follow-ups');
        }
        
        return insights.length > 0 ? insights : ['Standard research analysis'];
      };

      const stats = {
        totalMessages: messages.length,
        userMessages: messages.filter(m => m.role === 'user').length,
        assistantMessages: messages.filter(m => m.role === 'assistant').length,
        totalWords: calculateTotalWords(),
        averageWordsPerMessage: calculateAverageWordsPerMessage(),
        sourceCount: extractSourceCount(),
        researchTopics: extractResearchTopics(),
        timeSpent: calculateTimeSpent(),
        complexityScore: calculateComplexityScore(),
        sentimentAnalysis: analyzeSentiment(),
        keyInsights: extractKeyInsights()
      };
      
      setAnalytics(stats);
    } catch (error) {
      console.error('Error calculating analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      calculateAnalytics();
    }
  }, [calculateAnalytics, messages.length]);

  const getSentimentColor = (sentiment) => {
    const colorMap = {
      positive: 'text-green-600',
      negative: 'text-red-600',
      neutral: 'text-gray-600'
    };
    return colorMap[sentiment] || 'text-gray-600';
  };

  const getComplexityColor = (score) => {
    if (score > 80) return 'text-red-600';
    if (score > 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Research Analytics</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-gray-600">Calculating analytics...</p>
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Basic Stats */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Basic Statistics</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-700">Total Messages:</span>
                    <span className="font-medium">{analytics.totalMessages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-700">User Messages:</span>
                    <span className="font-medium">{analytics.userMessages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-700">Assistant Messages:</span>
                    <span className="font-medium">{analytics.assistantMessages}</span>
                  </div>
                </div>
              </div>

              {/* Content Analysis */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-900 mb-2">Content Analysis</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-green-700">Total Words:</span>
                    <span className="font-medium">{analytics.totalWords.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-green-700">Avg Words/Message:</span>
                    <span className="font-medium">{analytics.averageWordsPerMessage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-green-700">Sources Found:</span>
                    <span className="font-medium">{analytics.sourceCount}</span>
                  </div>
                </div>
              </div>

              {/* Research Insights */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-purple-900 mb-2">Research Insights</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-purple-700">Time Spent:</span>
                    <span className="font-medium">{analytics.timeSpent} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-purple-700">Complexity Score:</span>
                    <span className={`font-medium ${getComplexityColor(analytics.complexityScore)}`}>
                      {analytics.complexityScore}/100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-purple-700">Sentiment:</span>
                    <span className={`font-medium ${getSentimentColor(analytics.sentimentAnalysis)}`}>
                      {analytics.sentimentAnalysis}
                    </span>
                  </div>
                </div>
              </div>

              {/* Research Topics */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-yellow-900 mb-2">Research Topics</h3>
                <div className="flex flex-wrap gap-1">
                  {analytics.researchTopics.map((topic, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              {/* Key Insights */}
              <div className="bg-indigo-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-indigo-900 mb-2">Key Insights</h3>
                <div className="space-y-1">
                  {analytics.keyInsights.map((insight, index) => (
                    <div key={index} className="text-sm text-indigo-700">
                      • {insight}
                    </div>
                  ))}
                </div>
              </div>

              {/* Research Quality */}
              <div className="bg-pink-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-pink-900 mb-2">Research Quality</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-pink-700">Source Diversity:</span>
                    <span className="font-medium">
                      {analytics.sourceCount > 5 ? 'High' : analytics.sourceCount > 2 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-pink-700">Depth:</span>
                    <span className="font-medium">
                      {analytics.totalWords > 2000 ? 'Deep' : analytics.totalWords > 1000 ? 'Moderate' : 'Basic'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-pink-700">Engagement:</span>
                    <span className="font-medium">
                      {analytics.userMessages > 3 ? 'High' : analytics.userMessages > 1 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p>No research data available for analysis.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end mt-6">
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

export default Analytics; 