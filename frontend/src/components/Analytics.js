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

      const calculateTimeSpent = () => {
        const totalWords = calculateTotalWords();
        const readingSpeed = 200;
        return Math.round(totalWords / readingSpeed);
      };

      const stats = {
        totalMessages: messages.length,
        userMessages: messages.filter(m => m.role === 'user').length,
        assistantMessages: messages.filter(m => m.role === 'assistant').length,
        totalWords: calculateTotalWords(),
        averageWordsPerMessage: calculateAverageWordsPerMessage(),
        sourceCount: extractSourceCount(),
        timeSpent: calculateTimeSpent(),
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Report Summary</h2>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div className="flex justify-between">
                    <span className="text-sm text-green-700">Time Spent (reading time):</span>
                    <span className="font-medium">{analytics.timeSpent} min</span>
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
