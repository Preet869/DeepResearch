import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from './config';
import { apiFetch } from './apiClient';
import Header from './Header';
import { PaperInput, Pill } from './components/compare';
import { TipCard } from './components/TipCard';
import { Icon } from './components/shared';

const SESSION_CONTEXT_HINT_KEY = 'dr-compare-context-hint-seen';
const CONTEXT_WIDE_BREAKPOINT = 900;

/** Nearly straight cyan cue, points left toward “+ optional context”. */
function CompareHintArrow({ color = 'var(--cyan)', width = 132 }) {
  const h = 24;
  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} fill="none" aria-hidden style={{ display: 'block' }}>
      <path
        d={`M ${width - 6} ${h / 2} H 30`}
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d={`M 34 ${h / 2 - 7} L 18 ${h / 2} L 34 ${h / 2 + 7}`}
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Same dot language as Welcome “four-step pipeline”; overall uses red (--hot). */
const FOCUS_PILLS = [
  { value: 'overall', label: 'Focus · overall', dotColor: 'var(--hot)' },
  { value: 'methodology', label: 'Focus · methodology', dotColor: 'var(--cyan)' },
  { value: 'findings', label: 'Focus · findings', dotColor: 'var(--sun)' },
];

const ComparisonPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [inputMethod, setInputMethod] = useState('url');
  const [comparisonFocus, setComparisonFocus] = useState('overall');

  const [article1Url, setArticle1Url] = useState('');
  const [article1Text, setArticle1Text] = useState('');
  const [article1Title, setArticle1Title] = useState('');

  const [article2Url, setArticle2Url] = useState('');
  const [article2Text, setArticle2Text] = useState('');
  const [article2Title, setArticle2Title] = useState('');

  const [context, setContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [error, setError] = useState('');
  const [contextHintDismissed, setContextHintDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_CONTEXT_HINT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [wideContextLayout, setWideContextLayout] = useState(
    typeof window !== 'undefined' ? window.matchMedia(`(min-width: ${CONTEXT_WIDE_BREAKPOINT}px)`).matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${CONTEXT_WIDE_BREAKPOINT}px)`);
    const onChange = () => setWideContextLayout(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!showContext) return;
    try {
      sessionStorage.setItem(SESSION_CONTEXT_HINT_KEY, '1');
    } catch {
      /* ignore */
    }
    setContextHintDismissed(true);
  }, [showContext]);

  const showContextHintArrow = !showContext && !contextHintDismissed;

  const compareReady =
    inputMethod === 'url'
      ? Boolean(article1Url.trim() && article2Url.trim())
      : Boolean(article1Text.trim() && article2Text.trim());
  const compareSubmitDisabled = !compareReady || loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (inputMethod === 'url') {
      if (!article1Url.trim() || !article2Url.trim()) {
        setError('Please provide URLs for both articles');
        return;
      }
    } else {
      if (!article1Text.trim() || !article2Text.trim()) {
        setError('Please provide text for both articles');
        return;
      }
    }

    setLoading(true);

    try {
      const requestBody = {
        comparison_focus: comparisonFocus,
        context: context.trim() || null,
        ...(inputMethod === 'url'
          ? {
              article1_url: article1Url.trim(),
              article2_url: article2Url.trim(),
            }
          : {
              article1_text: article1Text.trim(),
              article1_title: article1Title.trim() || 'Article 1',
              article2_text: article2Text.trim(),
              article2_title: article2Title.trim() || 'Article 2',
            }),
      };

      const response = await apiFetch(config.endpoints.compareArticles, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/research?convo_id=${data.conversation_id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to compare articles');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to compare articles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--fg)',
        background: 'var(--bg)',
      }}
    >
      <Header />

      <main
        className="dot-paper"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '20px 32px 18px',
          boxSizing: 'border-box',
        }}
      >
        <form onSubmit={handleSubmit} style={{ maxWidth: 1100, margin: '0 auto' }}>
          <span className="sticker" style={{ '--dot-color': 'var(--violet)' }}>
            <span className="dot" />
            compare two articles
          </span>

          <h1
            className="serif"
            style={{
              fontSize: 'clamp(44px, 6vw, 84px)',
              lineHeight: 0.95,
              letterSpacing: '-.025em',
              margin: '12px 0 0',
            }}
          >
            Two papers <span style={{ fontStyle: 'italic', color: 'var(--violet)' }}>walk in</span>.
            <br />
            One synthesis walks out.
          </h1>
          <p style={{ marginTop: 14, fontSize: 18, lineHeight: 1.5, color: 'var(--mut)', maxWidth: 640 }}>
            Drop in URLs or paste full text. We&apos;ll align methods, findings, and evidence quality.
          </p>

          {inputMethod === 'text' && (
            <button
              type="button"
              onClick={() => setInputMethod('url')}
              className="mono"
              style={{
                marginTop: 16,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--cyan)',
                fontSize: 12,
                letterSpacing: '.06em',
                padding: 0,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              ← use article URLs instead
            </button>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 88px 1fr',
              gap: 18,
              marginTop: 22,
              alignItems: 'stretch',
            }}
          >
            <PaperInput
              letter="A"
              tint="var(--violet)"
              variant="comfortable"
              inputMethod={inputMethod}
              onSwitchToText={() => setInputMethod('text')}
              urlValue={article1Url}
              onUrlChange={setArticle1Url}
              titleValue={article1Title}
              onTitleChange={setArticle1Title}
              textValue={article1Text}
              onTextChange={setArticle1Text}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="serif" style={{ fontSize: 64, fontStyle: 'italic', color: 'var(--mut2)' }}>
                vs
              </div>
            </div>
            <PaperInput
              letter="B"
              tint="var(--cyan)"
              variant="comfortable"
              inputMethod={inputMethod}
              onSwitchToText={() => setInputMethod('text')}
              urlValue={article2Url}
              onUrlChange={setArticle2Url}
              titleValue={article2Title}
              onTitleChange={setArticle2Title}
              textValue={article2Text}
              onTextChange={setArticle2Text}
            />
          </div>

          <div
            style={{
              marginTop: 18,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 18,
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {FOCUS_PILLS.map((p) => (
                <Pill
                  key={p.value}
                  type="button"
                  variant="comfortable"
                  dotColor={p.dotColor}
                  label={p.label}
                  selected={comparisonFocus === p.value}
                  onClick={() => setComparisonFocus(p.value)}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={compareSubmitDisabled}
              className="btn btn-new-research flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45 shrink-0"
              style={{ borderRadius: 9999 }}
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Compare
                  <Icon.Arrow />
                </>
              )}
            </button>
          </div>

          {wideContextLayout ? (
            <div
              style={{
                marginTop: 14,
                display: 'grid',
                gridTemplateColumns:
                  showContext || !showContextHintArrow
                    ? 'minmax(0, 1fr) minmax(360px, min(520px, 46vw))'
                    : 'minmax(0, 1fr) 88px minmax(360px, min(520px, 46vw))',
                columnGap: 16,
                alignItems: 'start',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowContext(!showContext)}
                  className="mono"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--mut)',
                    fontSize: 13,
                    letterSpacing: '.08em',
                    padding: 0,
                    textAlign: 'left',
                    lineHeight: 1.4,
                  }}
                >
                  {showContext ? '− hide assignment context' : '+ optional context (assignment / topic)'}
                </button>
                {showContext && (
                  <div style={{ marginTop: 14 }}>
                    <input
                      type="text"
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder='e.g. "Topic: climate justice" or assignment brief'
                      style={{
                        width: '100%',
                        maxWidth: 560,
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: '1px solid var(--line-strong)',
                        background: 'var(--bg-2)',
                        color: 'var(--fg)',
                        fontSize: 15,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <p className="mono" style={{ marginTop: 10, fontSize: 12, color: 'var(--mut2)' }}>
                      Helps tailor synthesis and citations to your course or paper.
                    </p>
                  </div>
                )}

                {error && (
                  <div
                    className="card"
                    style={{
                      marginTop: 18,
                      padding: 18,
                      borderColor: 'var(--hot)',
                      background: 'color-mix(in srgb, var(--hot) 8%, var(--card))',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 15, color: 'var(--fg)' }}>{error}</p>
                  </div>
                )}
              </div>

              {showContextHintArrow && (
                <div
                  aria-hidden
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <CompareHintArrow width={124} />
                </div>
              )}

              <TipCard
                size="comfortable"
                style={{ width: '100%', justifySelf: 'stretch' }}
                title={
                  <>
                    <span style={{ fontStyle: 'italic' }}>tip:</span> add context when the comparison is for a specific
                    assignment or literature review.
                  </>
                }
                subtitle="Use the field above when it’s relevant."
              />
            </div>
          ) : (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowContext(!showContext)}
                  className="mono"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--mut)',
                    fontSize: 13,
                    letterSpacing: '.08em',
                    padding: 0,
                    textAlign: 'left',
                    lineHeight: 1.4,
                  }}
                >
                  {showContext ? '− hide assignment context' : '+ optional context (assignment / topic)'}
                </button>
                {showContext && (
                  <div style={{ marginTop: 14 }}>
                    <input
                      type="text"
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder='e.g. "Topic: climate justice" or assignment brief'
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: '1px solid var(--line-strong)',
                        background: 'var(--bg-2)',
                        color: 'var(--fg)',
                        fontSize: 15,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <p className="mono" style={{ marginTop: 10, fontSize: 12, color: 'var(--mut2)' }}>
                      Helps tailor synthesis and citations to your course or paper.
                    </p>
                  </div>
                )}

                {error && (
                  <div
                    className="card"
                    style={{
                      marginTop: 18,
                      padding: 18,
                      borderColor: 'var(--hot)',
                      background: 'color-mix(in srgb, var(--hot) 8%, var(--card))',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 15, color: 'var(--fg)' }}>{error}</p>
                  </div>
                )}
              </div>

              {showContextHintArrow && (
                <div
                  aria-hidden
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    margin: '-4px 0',
                  }}
                >
                  <CompareHintArrow
                    width={Math.min(288, typeof window !== 'undefined' ? window.innerWidth - 48 : 260)}
                  />
                </div>
              )}

              <TipCard
                size="comfortable"
                style={{ width: '100%' }}
                title={
                  <>
                    <span style={{ fontStyle: 'italic' }}>tip:</span> add context when the comparison is for a specific
                    assignment or literature review.
                  </>
                }
                subtitle="Use the field above when it’s relevant."
              />
            </div>
          )}
        </form>
      </main>
    </div>
  );
};

export default ComparisonPage;
