import React from 'react';

/**
 * Serif “tip:” line + mono subtitle — matches {@link Dashboard} tip card chrome.
 */
export function TipCard({ title, subtitle, style = {}, size = 'default' }) {
  const comfortable = size === 'comfortable';
  return (
    <div
      className="card"
      style={{
        padding: comfortable ? 18 : 14,
        borderRadius: 12,
        border: '1px solid var(--line)',
        background: 'var(--card)',
        ...style,
      }}
    >
      <div
        className="serif"
        style={{
          fontSize: comfortable ? 20 : 18,
          lineHeight: comfortable ? 1.22 : 1.15,
          letterSpacing: '-.01em',
          color: 'var(--fg)',
        }}
      >
        {title}
      </div>
      {Boolean(subtitle) && (
        <div
          className="mono"
          style={{
            marginTop: comfortable ? 8 : 6,
            fontSize: comfortable ? 11 : 10,
            color: 'var(--mut2)',
            letterSpacing: '.04em',
            lineHeight: 1.45,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
