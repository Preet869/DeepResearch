import React, { useState, useEffect } from 'react';
import { Icon } from './shared';

const funFacts = [
  "Did you know? The average person spends 2.5 hours a day researching things online.",
  "Fun fact: Google processes over 8.5 billion searches per day!",
  "Research tip: 90% of the world's data was created in the last 2 years.",
  "Did you know? The first search engine was called Archie, created in 1990.",
  "Fun fact: Wikipedia has over 6 million articles in English alone!",
  "Research insight: Peer review was first used in 1665 by the Royal Society.",
  "Did you know? The term 'surfing the web' was coined in 1992.",
  "Fun fact: Academic papers cite an average of 45 other sources.",
];


/**
 * Progress is illustrative only: the API does not stream completion %.
 * The bar advances slowly toward ~69% while this component is mounted, then resets on unmount.
 */
function ResearchGeneratingPanel({ query }) {
  const [progress, setProgress] = useState(0);
  const [funFactIndex, setFunFactIndex] = useState(0);

  const stages = [
    { p: 0, l: 'Parsing question' },
    { p: 15, l: 'Searching the web' },
    { p: 35, l: 'Reading sources' },
    { p: 55, l: 'Cross-referencing claims' },
    { p: 75, l: 'Drafting report' },
    { p: 88, l: 'Finalizing content' },
  ];

  useEffect(() => {
    setProgress(0);
    setFunFactIndex(Math.floor(Math.random() * funFacts.length));
    
    const t = setInterval(() => {
      setProgress((p) => {
        // Progressive realistic loading calibrated for 90+ seconds
        if (p < 15) {
          return p + 0.8 + Math.random() * 0.4; // Slower start (searching) - ~18 seconds to reach 15%
        } else if (p < 35) {
          return p + 0.6 + Math.random() * 0.3; // Reading sources - ~33 seconds to reach 35%
        } else if (p < 55) {
          return p + 0.5 + Math.random() * 0.25; // Processing facts - ~40 seconds to reach 55%
        } else if (p < 75) {
          return p + 0.4 + Math.random() * 0.2; // Generating report - ~50 seconds to reach 75%
        } else if (p < 88) {
          return p + 0.25 + Math.random() * 0.15; // Almost done, slow down - ~70 seconds to reach 88%
        } else if (p < 95) {
          return p + 0.15 + Math.random() * 0.1; // Final stages - ~85 seconds to reach 95%
        } else {
          // After 95%, very slow progress that never reaches 100% - continues past 90 seconds
          return Math.min(99, p + Math.random() * 0.08);
        }
      });
    }, 800); // Slower 800ms interval to extend duration further
    
    return () => clearInterval(t);
  }, [query]);

  // Rotate fun facts every 4 seconds
  useEffect(() => {
    const factTimer = setInterval(() => {
      setFunFactIndex((prev) => (prev + 1) % funFacts.length);
    }, 4000);
    return () => clearInterval(factTimer);
  }, []); // funFacts is now a constant outside component, so no dependency needed

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

        <div
          style={{
            marginTop: 22,
            textAlign: 'center',
            minHeight: 32,
          }}
        >
          <p
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--mut2)',
              letterSpacing: '.04em',
              opacity: 0.8,
              transition: 'opacity 0.5s ease',
            }}
          >
            {funFacts[funFactIndex]}
          </p>
          <p
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--mut)',
              letterSpacing: '.04em',
              marginTop: 8,
              fontWeight: 600,
            }}
          >
            <span className="marker-half">Beta</span>: We're optimizing <span className="marker-half">speed</span> while maintaining <span className="marker-half">quality</span>.
            <br />
            Your report will be <span className="marker-half">comprehensive</span> and <span className="marker-half">citation-ready</span>.
          </p>
        </div>
      </div>
      <style>{`@keyframes research-pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }`}</style>
    </div>
  );
}

export default ResearchGeneratingPanel;
