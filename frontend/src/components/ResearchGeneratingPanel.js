import React, { useState, useEffect } from 'react';
import { Icon } from './shared';

/**
 * Progress is illustrative only: the API does not stream completion %.
 * The bar advances slowly toward ~92% while this component is mounted, then resets on unmount.
 */
function ResearchGeneratingPanel({ query }) {
  const [progress, setProgress] = useState(0);

  const stages = [
    { p: 0, l: 'Parsing question' },
    { p: 18, l: 'Searching the web' },
    { p: 42, l: 'Reading sources' },
    { p: 64, l: 'Cross-referencing claims' },
    { p: 82, l: 'Drafting report' },
    { p: 96, l: 'Drawing charts' },
  ];

  useEffect(() => {
    setProgress(0);
    const t = setInterval(() => {
      setProgress((p) => {
        const cap = 92;
        if (p >= cap) return cap;
        return Math.min(cap, p + 1.2 + Math.random() * 0.8);
      });
    }, 120);
    return () => clearInterval(t);
  }, [query]);

  const displayProgress = Math.min(99, Math.round(progress));

  return (
    <div className="route dot-paper rounded-xl border border-[var(--line)] p-8 md:p-10" style={{ minHeight: 360 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--violet)', letterSpacing: '.18em' }}>
          NOW READING · {displayProgress}%
        </div>
        <h1
          className="serif"
          style={{
            margin: '14px 0 0',
            fontSize: 'clamp(28px, 4vw, 48px)',
            lineHeight: 1.05,
            letterSpacing: '-.02em',
          }}
        >
          <span style={{ fontStyle: 'italic' }}>&ldquo;{query?.trim() || 'Your question'}&rdquo;</span>
        </h1>

        <div
          style={{
            marginTop: 36,
            height: 8,
            borderRadius: 999,
            background: 'var(--card)',
            border: '1px solid var(--line)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--violet), var(--cyan))',
              transition: 'width .35s ease',
            }}
          />
        </div>

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stages.map((s, i) => {
            const done = progress > s.p + 14;
            const live = progress >= s.p && !done;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: live ? 'var(--card)' : 'transparent',
                  border: '1px solid',
                  borderColor: live ? 'var(--violet)' : 'var(--line)',
                  opacity: progress >= s.p ? 1 : 0.4,
                  transition: 'all .25s',
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: done ? 'var(--violet)' : 'transparent',
                    border: '1.5px solid',
                    borderColor: done ? 'var(--violet)' : 'var(--line-strong)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0,
                  }}
                >
                  {done && <Icon.Check width={12} height={12} />}
                  {live && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--violet)',
                        animation: 'research-pulse 1s ease-in-out infinite',
                      }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, fontSize: 14, color: 'var(--fg)' }}>{s.l}</div>
                {live && (
                  <span className="mono" style={{ fontSize: 10, color: 'var(--mut)' }}>
                    working…
                  </span>
                )}
                {done && (
                  <span className="mono" style={{ fontSize: 10, color: 'var(--mut2)' }}>
                    done
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <p
          className="mono"
          style={{
            marginTop: 22,
            fontSize: 11,
            color: 'var(--mut2)',
            letterSpacing: '.04em',
            textAlign: 'center',
          }}
        >
          You can leave this tab — we save the report to your library when it finishes.
        </p>
      </div>
      <style>{`@keyframes research-pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }`}</style>
    </div>
  );
}

export default ResearchGeneratingPanel;
