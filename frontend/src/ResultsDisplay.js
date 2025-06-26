import React from 'react';
import ResponseCard from './ResponseCard';

const ResultsDisplay = ({ isLoading, results }) => {
  if (isLoading) {
    return <div className="text-center">Loading...</div>;
  }

  if (!results) {
    return null; // Don't show anything if there are no results yet
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Research Results</h2>
      <div className="space-y-4">
        {results.openai_response && <ResponseCard modelName="OpenAI GPT-3.5" responseText={results.openai_response} />}
        {results.claude_response && <ResponseCard modelName="Anthropic Claude Haiku" responseText={results.claude_response} />}
        {results.gemini_response && <ResponseCard modelName="Google Gemini Flash" responseText={results.gemini_response} />}
      </div>
    </div>
  );
};

export default ResultsDisplay;
