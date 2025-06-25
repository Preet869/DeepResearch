import React from 'react';
import Header from './Header';
import PromptInput from './PromptInput';

// We will add other components like ResultsDisplay here later

const MainPage = () => {
  const handlePromptSubmit = async (prompt) => {
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
    } catch (error) {
      console.error('Error submitting prompt:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="container mx-auto p-4">
        <PromptInput onSubmit={handlePromptSubmit} />
      </main>
    </div>
  );
};
export default MainPage; 