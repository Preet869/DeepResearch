import React, { useState } from 'react';
import Header from './Header';
import PromptInput from './PromptInput';
import ResultsDisplay from './ResultsDisplay';

const MainPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handlePromptSubmit = async (prompt) => {
    setIsLoading(true);
    setResults(null); // Clear previous results
    console.log('Sending prompt to backend:', prompt);

    try {
      const response = await fetch('http://127.0.0.1:8000/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      console.log('Received from backend:', data);
      setResults(data);
    } catch (error) {
      console.error('Error submitting prompt:', error);
      // Optionally, set an error state here
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="container mx-auto p-4">
        <PromptInput onSubmit={handlePromptSubmit} />
        <div className="mt-8">
          <ResultsDisplay isLoading={isLoading} results={results} />
        </div>
      </main>
    </div>
  );
};

export default MainPage;