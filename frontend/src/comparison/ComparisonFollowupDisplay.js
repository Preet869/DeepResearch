import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function shorten(text, max = 48) {
  if (!text) return '';
  const s = String(text).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const ComparisonFollowupDisplay = ({ message, isLoading }) => {
  if (!message) return null;

  const metadata = message.metadata || {};
  const title1 = metadata.article1_title || 'Article 1';
  const title2 = metadata.article2_title || 'Article 2';

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2">
      <div
        className="rounded-t-xl shadow-sm border-b"
        style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
      >
        <div className="px-6 py-4">
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--cyan)',
              letterSpacing: '.2em',
              textTransform: 'uppercase',
            }}
          >
            ✱ follow-up answer
          </span>
          <div
            className="mono"
            style={{ marginTop: 4, fontSize: 12, color: 'var(--mut)' }}
          >
            based on your article comparison · {shorten(title1, 36)}{' '}
            <span style={{ color: 'var(--mut2)' }}>vs.</span> {shorten(title2, 36)}
          </div>
        </div>
      </div>

      <div
        className="px-6 py-6 rounded-b-xl"
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderTop: 'none',
        }}
      >
        {message.content ? (
          <div
            className="prose prose-sm sm:prose-base max-w-none"
            style={{ color: 'var(--fg)', lineHeight: 1.7 }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="mono" style={{ fontSize: 13, color: 'var(--mut)' }}>
            Generating follow-up…
          </div>
        )}
      </div>

      {isLoading && (
        <div
          style={{
            position: 'fixed',
            bottom: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--card)',
            borderRadius: 10,
            border: '1px solid var(--line)',
            padding: '12px 20px',
            zIndex: 40,
            boxShadow: '0 12px 40px -12px rgba(0,0,0,.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 18,
                height: 18,
                border: '2px solid var(--line-strong)',
                borderTopColor: 'var(--violet)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span className="mono" style={{ fontSize: 13, color: 'var(--fg)' }}>
              Generating follow-up…
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonFollowupDisplay;
