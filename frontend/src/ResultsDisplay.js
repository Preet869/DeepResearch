import React from 'react';
import ResponseCard from './ResponseCard';

const ResultsDisplay = ({ isLoading, messages }) => {
  if (isLoading) {
    return (
      <div className="text-center">
        <p>Generating deep research...</p>
        {/* You could add a more sophisticated spinner here */}
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return null; // Don't show anything if there are no messages
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Conversation</h2>
      <div className="space-y-4">
        {[...messages].reverse().map((msg) => (
          <div key={msg.id || msg.created_at}>
            {msg.role === 'user' ? (
              <div className="bg-blue-100 p-4 shadow-md rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800">You</h3>
                <p className="mt-2 text-gray-600 whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <ResponseCard
                modelName={msg.model_name}
                responseText={msg.content}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultsDisplay;
