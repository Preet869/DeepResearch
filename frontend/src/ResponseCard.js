import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ResponseCard = ({ message }) => {
  const isUser = message.role === 'user';
  const cardClass = isUser ? 'bg-white' : 'bg-blue-50';
  const authorName = isUser ? 'You' : message.model_name || 'Assistant';

  return (
    <div className={`p-4 rounded-lg shadow ${cardClass}`}>
      <p className="font-semibold text-sm text-gray-800 mb-2">{authorName}</p>
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default ResponseCard;
