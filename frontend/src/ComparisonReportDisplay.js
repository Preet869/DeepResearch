import React, { useMemo } from 'react';
import ChartDisplay from './ChartDisplay';
import SplitLedgerView from './comparison/SplitLedgerView';
import { parseComparisonReport } from './comparison/parseComparisonReport';

function shortenTitle(t, max = 52) {
  if (!t || !String(t).trim()) return 'Untitled';
  const s = String(t).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const FOCUS_LABEL = {
  overall: 'Overall',
  methodology: 'Methodology',
  findings: 'Findings',
};

const ComparisonReportDisplay = ({ messages, isLoading }) => {
  const mainReport = useMemo(
    () => (messages || []).find((m) => m.role === 'assistant') || null,
    [messages]
  );

  const reportContent = mainReport?.content || '';
  const parsed = useMemo(() => parseComparisonReport(reportContent), [reportContent]);

  if (!messages || messages.length === 0) {
    return null;
  }

  if (!mainReport) {
    return null;
  }

  const hasChart = Boolean(mainReport.metadata && mainReport.metadata.graph_data);

  const title1 = mainReport.metadata?.article1_title || 'Article 1';
  const title2 = mainReport.metadata?.article2_title || 'Article 2';
  const focusRaw = mainReport.metadata?.comparison_focus || 'overall';
  const focusShort = FOCUS_LABEL[focusRaw] || focusRaw;

  const themeCount =
    (parsed.overlappingThemes?.length || 0) +
    (parsed.uniqueA?.length || 0) +
    (parsed.uniqueB?.length || 0);
  const readingMinutes = Math.max(
    1,
    Math.ceil((reportContent.trim().split(/\s+/).filter(Boolean).length || 0) / 200)
  );

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
            ✱ comparison · {focusShort}
          </span>
          <h1
            className="serif"
            style={{
              fontSize: 'clamp(24px, 4vw, 48px)',
              lineHeight: 1,
              letterSpacing: '-.02em',
              margin: '4px 0 0',
            }}
          >
            {shortenTitle(title1, 30)}{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--mut2)' }}>vs.</span>{' '}
            {shortenTitle(title2, 30)}
          </h1>
        </div>

        <div className="px-6 py-3 border-t" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}>
          <div className="flex items-center space-x-4 text-sm mono" style={{ color: 'var(--mut2)' }}>
            <span>{new Date(mainReport.created_at).toLocaleDateString()}</span>
            <span>·</span>
            <span>2 articles</span>
            {themeCount > 0 && (
              <>
                <span>·</span>
                <span>
                  {themeCount} theme{themeCount === 1 ? '' : 's'}
                </span>
              </>
            )}
            <span>·</span>
            <span>{readingMinutes} min read</span>
          </div>
        </div>
      </div>

      <div
        className="px-6 py-6 space-y-8 rounded-b-xl"
        style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderTop: 'none' }}
      >
        {hasChart && (
          <div
            className="not-prose mt-0 p-6 rounded-xl"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line-strong)',
              boxShadow: '0 12px 40px -24px rgba(124,92,255,.35)',
            }}
          >
            <div className="flex items-baseline justify-between mb-2">
              <span className="mono" style={{ fontSize: 11, color: 'var(--violet)', letterSpacing: '.16em' }}>
                FIG. 1
              </span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--mut2)' }}>
                comparison analysis
              </span>
            </div>
            <ChartDisplay graphData={mainReport.metadata.graph_data} />
          </div>
        )}

        <SplitLedgerView parsed={parsed} titleA={title1} titleB={title2} />
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

export default ComparisonReportDisplay;
