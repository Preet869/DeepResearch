import React from 'react';

const ResponseCard = ({ modelName, responseText }) => {
  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <h3 className="text-xl font-bold mb-2 text-gray-800">{modelName}</h3>
      <p className="text-gray-700 whitespace-pre-wrap">{responseText}</p>
    </div>
  );
};

export default ResponseCard;
