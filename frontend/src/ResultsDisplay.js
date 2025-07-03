import React from 'react';
import ResponseCard from './ResponseCard';

const ResultsDisplay = ({ messages, isLoading }) => {
  if (isLoading && messages.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center text-gray-500">
        <h2 className="text-2xl font-semibold">Welcome to DeepResearch</h2>
        <p className="mt-2">Start a new research conversation by typing your query below.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <ResponseCard key={msg.id} message={msg} />
      ))}
      {isLoading && (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
};

export default ResultsDisplay;
