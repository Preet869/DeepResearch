import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const COLOR_A = 'var(--violet)';
const COLOR_B = 'var(--cyan)';
const NARROW_BREAKPOINT = 720;

function useNarrowLayout(breakpoint = NARROW_BREAKPOINT) {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e) => setNarrow(e.matches);
    setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);
  return narrow;
}

function shorten(text, max = 60) {
  if (!text) return '';
  const s = String(text).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function MarkdownBody({ children }) {
  if (!children || !String(children).trim()) return null;
  return (
    <div style={{ color: 'var(--fg)', lineHeight: 1.7 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

// Splits the "How to Use These Sources in Your Paper" content into discrete
// template blocks. The prompt produces headings like `**For a balanced
// literature review:**` (sometimes the model drops the **) followed by a
// sample paragraph; this carves the text into { heading, body } chunks so
// we can render the headings prominently. We deliberately use a permissive
// line-based heuristic instead of a tight regex so it handles whatever the
// model actually emitted in production.
function parseTemplateBlocks(markdown) {
  if (!markdown || typeof markdown !== 'string') return [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  const stripBold = (s) =>
    s.trim().replace(/^\*\*\s*/, '').replace(/\s*\*\*$/, '').trim();

  const isHeading = (rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return false;
    if (trimmed.length > 160) return false;
    const stripped = stripBold(trimmed);
    if (!stripped) return false;
    if (!stripped.endsWith(':')) return false;
    const firstChar = stripped[0];
    if (firstChar === '"' || firstChar === '\u201C' || firstChar === '\u2018' || firstChar === "'") {
      return false;
    }
    if (firstChar === '-' || firstChar === '*' || firstChar === '>' || firstChar === '#') {
      return false;
    }
    return true;
  };

  const blocks = [];
  let headingText = null;
  let bodyLines = [];

  const flush = () => {
    if (headingText) {
      const heading = stripBold(headingText).replace(/:$/, '').trim();
      blocks.push({ heading, body: bodyLines.join('\n').trim() });
    }
    headingText = null;
    bodyLines = [];
  };

  for (const line of lines) {
    if (isHeading(line)) {
      flush();
      headingText = line;
    } else if (headingText !== null) {
      bodyLines.push(line);
    }
  }
  flush();

  return blocks;
}

function TemplatesBody({ children }) {
  if (!children || !String(children).trim()) return null;
  const blocks = parseTemplateBlocks(children);
  if (blocks.length === 0) {
    return <MarkdownBody>{children}</MarkdownBody>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {blocks.map((b, i) => (
        <div key={i}>
          <h4
            className="serif"
            style={{
              margin: '0 0 10px',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '-.01em',
              color: 'var(--violet-2)',
              lineHeight: 1.3,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 4,
                height: 18,
                borderRadius: 2,
                background: 'var(--violet)',
                flexShrink: 0,
              }}
            />
            <span>{b.heading}</span>
          </h4>
          <MarkdownBody>{b.body}</MarkdownBody>
        </div>
      ))}
    </div>
  );
}

function IdentityChip({ letter, title, color }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
        flex: 1,
      }}
    >
      <span
        className="mono"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: 999,
          background: color,
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '.02em',
          flexShrink: 0,
        }}
      >
        {letter}
      </span>
      <span
        className="serif"
        style={{
          fontSize: 15,
          color: 'var(--fg)',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={title}
      >
        {shorten(title, 80)}
      </span>
    </div>
  );
}

function IdentityStrip({ titleA, titleB, narrow }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        marginTop: -4,
        padding: '10px 14px',
        borderRadius: 12,
        background: 'color-mix(in srgb, var(--paper) 92%, transparent)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid var(--line)',
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr' : '1fr 24px 1fr',
        gap: narrow ? 6 : 12,
        alignItems: 'center',
      }}
    >
      <IdentityChip letter="A" title={titleA} color={COLOR_A} />
      {!narrow && (
        <div
          className="serif"
          style={{ fontStyle: 'italic', color: 'var(--mut2)', fontSize: 14, textAlign: 'center' }}
        >
          vs
        </div>
      )}
      <IdentityChip letter="B" title={titleB} color={COLOR_B} />
    </div>
  );
}

function StarBar({ count = 0, max = 5, color }) {
  const dots = [];
  const clamped = Math.max(0, Math.min(max, Math.round(count)));
  for (let i = 0; i < max; i++) {
    dots.push(
      <span
        key={i}
        style={{
          display: 'inline-block',
          width: 9,
          height: 9,
          borderRadius: 999,
          background: i < clamped ? color : 'transparent',
          border: `1.5px solid ${i < clamped ? color : 'var(--line-strong)'}`,
        }}
      />
    );
  }
  return <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{dots}</span>;
}

// Prefer the numeric score (e.g., 8/10 -> 4 dots out of 5) for accuracy.
// Fall back to the literal star glyph count when no score is present, since
// the model occasionally rounds stars inconsistently with the score.
function ratingDots(score, fallbackStars, max = 5) {
  if (score != null && !Number.isNaN(score)) {
    return Math.max(0, Math.min(max, Math.round((score / 10) * max)));
  }
  return Math.max(0, Math.min(max, fallbackStars || 0));
}

function formatScore(score) {
  if (score == null || Number.isNaN(score)) return null;
  return Number.isInteger(score) ? `${score}/10` : `${score.toFixed(1)}/10`;
}

function RatingsBlock({ ratings, narrow }) {
  if (!ratings || ratings.length === 0) return null;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 10,
        marginTop: 16,
      }}
    >
      {ratings.map((r, i) => {
        const aDots = ratingDots(r.aScore, r.aStars);
        const bDots = ratingDots(r.bScore, r.bStars);
        const aLabel = formatScore(r.aScore);
        const bLabel = formatScore(r.bScore);
        return (
          <div
            key={i}
            title={r.why || undefined}
            style={{
              display: 'grid',
              gridTemplateColumns: narrow ? '1fr' : 'minmax(140px, 1fr) auto auto',
              gap: narrow ? 6 : 18,
              alignItems: 'center',
              padding: '10px 14px',
              border: '1px solid var(--line)',
              borderRadius: 10,
              background: 'var(--card)',
            }}
          >
            <span className="mono" style={{ fontSize: 12, color: 'var(--mut)', letterSpacing: '.04em' }}>
              {r.criteria}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, color: COLOR_A, width: 12, textAlign: 'center' }}>
                A
              </span>
              <StarBar count={aDots} color={COLOR_A} />
              {aLabel && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--mut2)', minWidth: 36, textAlign: 'right' }}>
                  {aLabel}
                </span>
              )}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, color: COLOR_B, width: 12, textAlign: 'center' }}>
                B
              </span>
              <StarBar count={bDots} color={COLOR_B} />
              {bLabel && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--mut2)', minWidth: 36, textAlign: 'right' }}>
                  {bLabel}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VerdictHero({ overview, narrow }) {
  if (!overview) return null;
  const { keyInsight, bullets, ratings } = overview;
  if (!keyInsight && (!bullets || bullets.length === 0) && (!ratings || ratings.length === 0)) {
    return null;
  }
  return (
    <section
      style={{
        marginTop: 16,
        padding: narrow ? 18 : 24,
        borderRadius: 14,
        background: 'var(--card)',
        border: '1px solid var(--line-strong)',
        boxShadow: '0 12px 40px -28px rgba(124,92,255,.35)',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: '.2em',
          textTransform: 'uppercase',
          color: 'var(--violet)',
        }}
      >
        Verdict
      </div>
      {keyInsight && (
        <p
          className="serif"
          style={{
            fontSize: 'clamp(18px, 2.4vw, 24px)',
            lineHeight: 1.35,
            letterSpacing: '-.01em',
            color: 'var(--fg)',
            margin: '8px 0 0',
          }}
        >
          {keyInsight}
        </p>
      )}
      <RatingsBlock ratings={ratings} narrow={narrow} />
      {bullets && bullets.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '16px 0 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {bullets.map((b, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                color: 'var(--fg)',
                fontSize: 15,
                lineHeight: 1.55,
              }}
            >
              <span
                aria-hidden
                style={{
                  marginTop: 8,
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--mut2)',
                  flexShrink: 0,
                }}
              />
              <span>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{b}</ReactMarkdown>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SidePanel({ letter, color, position, quote, evidence }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '14px 16px',
        borderLeft: `2px solid ${color}`,
        background: 'transparent',
        minWidth: 0,
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color,
          fontWeight: 600,
        }}
      >
        {letter} · position
      </span>
      {position ? (
        <div style={{ color: 'var(--fg)', fontSize: 15, lineHeight: 1.6 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{position}</ReactMarkdown>
        </div>
      ) : (
        <p className="mono" style={{ margin: 0, fontSize: 12, color: 'var(--mut2)' }}>
          Not covered.
        </p>
      )}
      {quote && (
        <blockquote
          style={{
            margin: 0,
            padding: '8px 12px',
            borderLeft: `2px solid ${color}`,
            background: 'var(--bg-2)',
            color: 'var(--fg)',
            fontStyle: 'italic',
            fontSize: 14,
            lineHeight: 1.5,
            borderRadius: '0 6px 6px 0',
          }}
        >
          {quote}
        </blockquote>
      )}
      {evidence && (
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '.04em',
            color: 'var(--mut)',
          }}
        >
          evidence · <span style={{ color: 'var(--fg)' }}>{evidence}</span>
        </div>
      )}
    </div>
  );
}

function ThemeCard({ theme, narrow, index }) {
  return (
    <article
      style={{
        borderRadius: 12,
        border: '1px solid var(--line)',
        background: 'var(--card)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--paper)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '.18em',
            color: 'var(--mut2)',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3
          className="serif"
          style={{
            margin: 0,
            fontSize: 'clamp(17px, 1.8vw, 20px)',
            lineHeight: 1.25,
            color: 'var(--fg)',
            letterSpacing: '-.01em',
          }}
        >
          {theme.title}
        </h3>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : '1fr 1px 1fr',
          alignItems: 'stretch',
        }}
      >
        <SidePanel
          letter="A"
          color={COLOR_A}
          position={theme.positionA}
          quote={theme.quoteA}
          evidence={theme.evidenceA}
        />
        {!narrow && <div style={{ background: 'var(--line)' }} />}
        <SidePanel
          letter="B"
          color={COLOR_B}
          position={theme.positionB}
          quote={theme.quoteB}
          evidence={theme.evidenceB}
        />
      </div>

      {theme.synthesis && (
        <div
          style={{
            padding: '14px 18px 16px',
            borderTop: '1px solid var(--line)',
            background: 'var(--paper)',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: '.18em',
              textTransform: 'uppercase',
              color: 'var(--mut)',
              marginBottom: 6,
            }}
          >
            Synthesis
          </div>
          <div style={{ color: 'var(--fg)', fontSize: 15, lineHeight: 1.6 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{theme.synthesis}</ReactMarkdown>
          </div>
        </div>
      )}
    </article>
  );
}

function UniqueCard({ letter, color, title, themes }) {
  if (!themes || themes.length === 0) return null;
  return (
    <article
      style={{
        borderRadius: 12,
        border: '1px solid var(--line)',
        background: 'var(--card)',
        padding: '16px 18px',
        borderTop: `3px solid ${color}`,
        minWidth: 0,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color,
          fontWeight: 600,
        }}
      >
        Only in {letter} · {title}
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {themes.map((t, i) => (
          <div key={i}>
            {t.title && (
              <div
                className="serif"
                style={{ fontSize: 16, color: 'var(--fg)', marginBottom: 4, letterSpacing: '-.01em' }}
              >
                {t.title}
              </div>
            )}
            <MarkdownBody>{t.body}</MarkdownBody>
          </div>
        ))}
      </div>
    </article>
  );
}

function Drawer({ label, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      style={{
        borderRadius: 12,
        border: '1px solid var(--line)',
        background: 'var(--card)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mono"
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '14px 18px',
          background: open ? 'var(--paper)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          color: 'var(--fg)',
          fontSize: 13,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
        aria-expanded={open}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: 2,
              transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform .2s',
              background: 'var(--violet)',
            }}
          />
          {label}
          {typeof count === 'number' && count > 0 && (
            <span style={{ color: 'var(--mut2)', fontWeight: 400 }}>({count})</span>
          )}
        </span>
        <span style={{ color: 'var(--mut2)' }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ padding: '6px 18px 20px' }}>{children}</div>
      )}
    </section>
  );
}

function GapCard({ gap }) {
  return (
    <article
      style={{
        borderRadius: 10,
        border: '1px solid var(--line)',
        background: 'var(--paper)',
        padding: '14px 16px',
      }}
    >
      {gap.title && (
        <div className="serif" style={{ fontSize: 16, color: 'var(--fg)', marginBottom: 8 }}>
          {gap.title}
        </div>
      )}
      {gap.missing && (
        <div style={{ marginBottom: 8 }}>
          <span
            className="mono"
            style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--mut)' }}
          >
            Missing
          </span>
          <MarkdownBody>{gap.missing}</MarkdownBody>
        </div>
      )}
      {gap.toFind && (
        <div style={{ marginBottom: 8 }}>
          <span
            className="mono"
            style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--cyan)' }}
          >
            To find it
          </span>
          <MarkdownBody>{gap.toFind}</MarkdownBody>
        </div>
      )}
      {gap.sources && (
        <div style={{ marginBottom: 8 }}>
          <span
            className="mono"
            style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--mut)' }}
          >
            Recommended sources
          </span>
          <MarkdownBody>{gap.sources}</MarkdownBody>
        </div>
      )}
      {gap.why && (
        <div>
          <span
            className="mono"
            style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--mut)' }}
          >
            Why it matters
          </span>
          <MarkdownBody>{gap.why}</MarkdownBody>
        </div>
      )}
    </article>
  );
}

function HowToInfoButton({ howToUse }) {
  const [open, setOpen] = useState(false);
  if (!howToUse || !howToUse.trim()) return null;
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mono"
        style={{
          background: 'transparent',
          border: '1px solid var(--line)',
          borderRadius: 999,
          padding: '4px 10px',
          fontSize: 11,
          color: 'var(--mut)',
          cursor: 'pointer',
          letterSpacing: '.06em',
        }}
        aria-expanded={open}
      >
        ? how to read this
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 40,
            width: 'min(360px, 80vw)',
            padding: '14px 16px',
            borderRadius: 10,
            background: 'var(--card)',
            border: '1px solid var(--line-strong)',
            boxShadow: '0 12px 40px -16px rgba(0,0,0,.2)',
            fontSize: 13,
            color: 'var(--fg)',
            lineHeight: 1.55,
          }}
        >
          <MarkdownBody>{howToUse}</MarkdownBody>
        </div>
      )}
    </div>
  );
}

const SplitLedgerView = ({ parsed, titleA, titleB }) => {
  const narrow = useNarrowLayout();
  const safe = useMemo(
    () => parsed || {
      overview: null,
      overlappingThemes: [],
      uniqueA: [],
      uniqueB: [],
      methodology: '',
      templates: '',
      quickReference: '',
      gaps: [],
      citationQuotes: '',
      howToUse: '',
    },
    [parsed]
  );

  const hasOverview =
    safe.overview &&
    (safe.overview.keyInsight ||
      (safe.overview.bullets && safe.overview.bullets.length > 0) ||
      (safe.overview.ratings && safe.overview.ratings.length > 0));

  const hasOverlap = safe.overlappingThemes && safe.overlappingThemes.length > 0;
  const hasUniqueA = safe.uniqueA && safe.uniqueA.length > 0;
  const hasUniqueB = safe.uniqueB && safe.uniqueB.length > 0;
  const hasAnyUnique = hasUniqueA || hasUniqueB;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <IdentityStrip titleA={titleA} titleB={titleB} narrow={narrow} />
        </div>
        <div style={{ flexShrink: 0 }}>
          <HowToInfoButton howToUse={safe.howToUse} />
        </div>
      </div>

      {hasOverview && <VerdictHero overview={safe.overview} narrow={narrow} />}

      {hasOverlap && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <header style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                color: 'var(--mut)',
              }}
            >
              Overlapping themes
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--mut2)' }}>
              · {safe.overlappingThemes.length}
            </span>
          </header>
          {safe.overlappingThemes.map((theme, i) => (
            <ThemeCard key={i} theme={theme} narrow={narrow} index={i} />
          ))}
        </section>
      )}

      {hasAnyUnique && (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: narrow || !(hasUniqueA && hasUniqueB) ? '1fr' : '1fr 1fr',
            gap: 14,
          }}
        >
          {hasUniqueA && (
            <UniqueCard letter="A" color={COLOR_A} title={shorten(titleA, 40)} themes={safe.uniqueA} />
          )}
          {hasUniqueB && (
            <UniqueCard letter="B" color={COLOR_B} title={shorten(titleB, 40)} themes={safe.uniqueB} />
          )}
        </section>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {safe.templates && (
          <Drawer label="Synthesis templates">
            <TemplatesBody>{safe.templates}</TemplatesBody>
          </Drawer>
        )}
        {safe.methodology && (
          <Drawer label="Methodological notes">
            <MarkdownBody>{safe.methodology}</MarkdownBody>
          </Drawer>
        )}
        {safe.citationQuotes && (
          <Drawer label="Citation-ready quotes">
            <MarkdownBody>{safe.citationQuotes}</MarkdownBody>
          </Drawer>
        )}
        {safe.gaps && safe.gaps.length > 0 && (
          <Drawer label="Research gaps" count={safe.gaps.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {safe.gaps.map((g, i) => (
                <GapCard key={i} gap={g} />
              ))}
            </div>
          </Drawer>
        )}
        {safe.quickReference && (
          <Drawer label="Quick reference table">
            <MarkdownBody>{safe.quickReference}</MarkdownBody>
          </Drawer>
        )}
      </section>
    </div>
  );
};

export default SplitLedgerView;
