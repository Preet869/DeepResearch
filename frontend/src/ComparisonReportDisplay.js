import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';
import ChartDisplay from './ChartDisplay';
import { FrameDivider, Icon } from './components/shared';
import { PaperHeader, ContrastBar } from './components/compare';
import { extractComparativeOverviewTableRows } from './components/compare/parseComparisonTable';

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

const ComparisonReportDisplay = ({ messages, isLoading, onFollowUp }) => {
  const navigate = useNavigate();
  const [copiedSection, setCopiedSection] = useState(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showClassicChart, setShowClassicChart] = useState(false);

  if (!messages || messages.length === 0) {
    return null;
  }

  const mainReport = messages.find((m) => m.role === 'assistant');
  if (!mainReport) {
    return null;
  }

  const comparisonSummary = mainReport.metadata?.graph_data?.comparison_summary;
  const graphData = mainReport.metadata?.graph_data;

  const copyToClipboard = async (text, sectionName) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionName);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const parseComparisonSections = (content) => {
    const sec = [];
    const lines = content.split('\n');
    let currentSection = null;
    let sectionIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('## ')) {
        if (currentSection) {
          sec.push(currentSection);
        }
        currentSection = {
          id: `section-${sectionIndex}`,
          title: line.replace('## ', ''),
          content: [],
          icon: getSectionIcon(line.replace('## ', '')),
        };
        sectionIndex += 1;
      } else if (line.startsWith('### ')) {
        if (currentSection) {
          currentSection.content.push(`**${line.replace('### ', '')}**`);
        }
      } else if (line && currentSection) {
        currentSection.content.push(line);
      }
    }

    if (currentSection) {
      sec.push(currentSection);
    }

    return sec;
  };

  const getSectionIcon = (title) => {
    const iconMap = {
      'Executive Summary': '📋',
      'Comparative Overview': '👥',
      'Detailed Comparative Analysis': '🔍',
      'Methodological Comparison': '🔬',
      'Findings and Evidence Comparison': '📊',
      'Theoretical Framework Comparison': '🧠',
      'Practical Implications Comparison': '🎯',
      'Synthesis and Integration': '🔗',
      'Critical Assessment': '⚖️',
      'Recommendations for Further Research': '🚀',
      Conclusion: '✅',
    };

    for (const [key, icon] of Object.entries(iconMap)) {
      if (title.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return '📄';
  };

  const sections = parseComparisonSections(mainReport.content);
  const hasChart = Boolean(mainReport.metadata && mainReport.metadata.graph_data);
  const tableRowsRaw = extractComparativeOverviewTableRows(sections);
  const tableRows = tableRowsRaw.filter((r) => {
    if (!r.key || r.key === '—') return r.va || r.vb;
    return true;
  });

  const fallbackTableRows = () => {
    if (tableRows.length) return [];
    const out = [];
    if (comparisonSummary?.similarity_score != null) {
      out.push({
        key: 'Similarity (AI)',
        va: `${comparisonSummary.similarity_score}%`,
        vb: '—',
      });
    }
    (comparisonSummary?.key_differences || []).slice(0, 5).forEach((d, i) => {
      out.push({ key: `Contrast ${i + 1}`, va: '—', vb: String(d) });
    });
    return out;
  };
  const attrRows = tableRows.length ? tableRows : fallbackTableRows();

  const executiveSection = sections.find((s) => s.title.toLowerCase().includes('executive summary'));
  const verdictBody = (() => {
    if (graphData?.key_insight) return graphData.key_insight;
    if (executiveSection?.content?.length) {
      const first = executiveSection.content.find(
        (line) =>
          String(line).trim().startsWith('•') ||
          String(line).trim().startsWith('-') ||
          String(line).trim().startsWith('*')
      );
      if (first) {
        return String(first)
          .replace(/^[\s•\-*]+/, '')
          .trim();
      }
      return executiveSection.content.slice(0, 2).join(' ').trim();
    }
    if (comparisonSummary?.key_differences?.[0]) {
      return comparisonSummary.key_differences[0];
    }
    return 'Comparison complete — see the breakdown below.';
  })();

  const title1 = mainReport.metadata?.article1_title || 'Article 1';
  const title2 = mainReport.metadata?.article2_title || 'Article 2';
  const focusRaw = mainReport.metadata?.comparison_focus || 'overall';
  const focusShort = FOCUS_LABEL[focusRaw] || focusRaw;

  const exportToPDF = () => {
    const MM_MARGIN = 20;
    const MM_MAX_WIDTH = 170;
    const MM_FOOTER = 18;

    const ptToMm = (pt) => (pt / 72) * 25.4;
    const lineHeightMm = (fontSizePt, factor = 1.2) => ptToMm(fontSizePt) * factor;

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageW = () => doc.internal.pageSize.getWidth();
    const pageH = () => doc.internal.pageSize.getHeight();
    const contentBottom = () => pageH() - MM_FOOTER;
    let y = MM_MARGIN;

    const newPage = () => {
      doc.addPage();
      y = MM_MARGIN;
    };

    const ensureSpace = (neededMm) => {
      if (y + neededMm > contentBottom()) {
        newPage();
      }
    };

    const writeWrapped = (text, fontSizePt, fontStyle, extraAfterBlock = 0) => {
      doc.setFont('helvetica', fontStyle);
      doc.setFontSize(fontSizePt);
      const lh = lineHeightMm(fontSizePt);
      const chunks = doc.splitTextToSize(text || ' ', MM_MAX_WIDTH);
      for (const line of chunks) {
        ensureSpace(lh);
        doc.text(line, MM_MARGIN, y, { baseline: 'top' });
        y += lh;
      }
      y += extraAfterBlock;
    };

    const addPageNumbers = () => {
      const total = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      for (let i = 1; i <= total; i += 1) {
        doc.setPage(i);
        doc.text(
          `Page ${i} of ${total}`,
          pageW() / 2,
          pageH() - 10,
          { align: 'center', baseline: 'middle' }
        );
      }
    };

    const bodyText = String(mainReport.content || '').trim();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    {
      const titleLines = doc.splitTextToSize('Article Comparison Report', MM_MAX_WIDTH);
      const lh = lineHeightMm(16);
      for (const line of titleLines) {
        ensureSpace(lh);
        doc.text(line, MM_MARGIN, y, { baseline: 'top' });
        y += lh;
      }
      y += 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    writeWrapped(`Article 1: ${title1}`, 12, 'bold', 1);
    doc.setFont('helvetica', 'bold');
    writeWrapped(`Article 2: ${title2}`, 12, 'bold', 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    {
      const lh = lineHeightMm(11);
      ensureSpace(lh);
      doc.text(`Generated: ${new Date().toLocaleString()}`, MM_MARGIN, y, { baseline: 'top' });
      y += lh + 3;
    }

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    ensureSpace(2);
    doc.line(MM_MARGIN, y, MM_MARGIN + MM_MAX_WIDTH, y);
    y += 5;

    const renderBodyMarkdown = (body) => {
      const lines = (body || '').split('\n');
      for (const rawLine of lines) {
        const line = rawLine ?? '';
        const isH2 = /^##\s/.test(line) && !/^###\s/.test(line);
        if (isH2) {
          const headerPlain = line.replace(/^##\s+/, '').trim() || line;
          writeWrapped(headerPlain, 13, 'bold', 2);
        } else if (line.trim() === '') {
          y += lineHeightMm(11) * 0.35;
          ensureSpace(lineHeightMm(11) * 0.35);
        } else {
          writeWrapped(line, 11, 'normal', 1);
        }
      }
    };

    if (!bodyText) {
      writeWrapped('No comparison content to export.', 11, 'normal', 0);
    } else {
      renderBodyMarkdown(bodyText);
    }

    addPageNumbers();
    doc.save('article-comparison-report.pdf');
  };

  const copyExecutiveSummary = () => {
    const execSection = sections.find((s) => s.title.toLowerCase().includes('executive summary'));
    if (execSection) {
      copyToClipboard(execSection.content.join('\n'), 'Executive Summary');
    }
  };

  const copyComparisonTable = () => {
    const overviewSection = sections.find((s) => s.title.toLowerCase().includes('comparative overview'));
    if (overviewSection) {
      const hasPipe = overviewSection.content.some((line) => line.includes('|'));
      if (hasPipe) {
        const tableLines = overviewSection.content.filter((line) => line.includes('|') || line.includes('---'));
        copyToClipboard(tableLines.join('\n'), 'Comparison Table');
      } else {
        copyToClipboard(overviewSection.content.join('\n'), 'Comparative Overview');
      }
    }
  };

  const copySummaryCard = () => {
    if (comparisonSummary) {
      const summaryText = `
# Comparison Summary

**Similarity Score:** ${comparisonSummary.similarity_score}%

**Key Differences:**
${comparisonSummary.key_differences?.map((d) => `• ${d}`).join('\n') || 'None listed'}

**Complementary Areas:**
${comparisonSummary.complementary_areas?.map((a) => `• ${a}`).join('\n') || 'None listed'}

**Conflicting Areas:**
${comparisonSummary.conflicting_areas?.map((a) => `• ${a}`).join('\n') || 'None listed'}

${comparisonSummary.student_recommendation ? `**Student Recommendation:** ${comparisonSummary.student_recommendation}` : ''}

${comparisonSummary.citation_strategy ? `**Citation Strategy:** ${comparisonSummary.citation_strategy}` : ''}
      `.trim();
      copyToClipboard(summaryText, 'Summary Card');
    }
  };

  const formatFollowUpQuery = (userQuery) => {
    const article1Title = mainReport.metadata?.article1_title || 'Article 1';
    const article2Title = mainReport.metadata?.article2_title || 'Article 2';

    const contextPrefix = `I just compared two articles:
- Article 1: ${article1Title}
- Article 2: ${article2Title}

My question about this comparison: `;

    return contextPrefix + userQuery;
  };

  const barData = graphData?.data;
  const barGrid =
    Array.isArray(barData) && barData.length
      ? barData.map((row) => {
          const a = Number(row.value);
          const b = Number(row.value2);
          const maxV = Math.max(10, a, b, 1);
          return {
            label: row.name || 'Metric',
            a: Number.isFinite(a) ? a : 0,
            b: Number.isFinite(b) ? b : 0,
            amax: maxV,
          };
        })
      : [];

  return (
    <div style={{ padding: '40px 36px 80px', color: 'var(--fg)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="mono"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--mut)',
            fontSize: 11,
            letterSpacing: '.06em',
            marginBottom: 18,
            padding: 0,
          }}
        >
          ← library
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
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
                fontSize: 'clamp(40px, 5.4vw, 72px)',
                lineHeight: 0.98,
                letterSpacing: '-.02em',
                margin: '8px 0 0',
              }}
            >
              {shortenTitle(title1, 44)}{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--mut2)' }}>vs.</span>{' '}
              {shortenTitle(title2, 44)}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => navigate('/compare')}
              className="btn btn-ghost"
              style={{ padding: '8px 12px', fontSize: 13 }}
            >
              Re-run
            </button>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="btn btn-ghost"
                style={{ padding: '8px 12px', fontSize: 13 }}
              >
                <Icon.Download /> Export
              </button>
              {showExportDropdown && (
                <div
                  className="card"
                  style={{
                    position: 'absolute',
                    right: 0,
                    marginTop: 6,
                    minWidth: 200,
                    zIndex: 30,
                    padding: 4,
                    boxShadow: '0 12px 40px -12px rgba(0,0,0,.2)',
                  }}
                >
                  <div
                    className="mono"
                    style={{
                      padding: '8px 10px',
                      fontSize: 10,
                      color: 'var(--mut2)',
                      letterSpacing: '.12em',
                    }}
                  >
                    FULL DOCUMENT
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      exportToPDF();
                      setShowExportDropdown(false);
                    }}
                    className="mono"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--fg)',
                      borderRadius: 6,
                    }}
                  >
                    Export PDF
                  </button>
                  <div
                    className="mono"
                    style={{
                      padding: '8px 10px',
                      fontSize: 10,
                      color: 'var(--mut2)',
                      letterSpacing: '.12em',
                      borderTop: '1px solid var(--line)',
                    }}
                  >
                    COPY SECTIONS
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      copyExecutiveSummary();
                      setShowExportDropdown(false);
                    }}
                    className="mono"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--fg)',
                      borderRadius: 6,
                    }}
                  >
                    Executive Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      copyComparisonTable();
                      setShowExportDropdown(false);
                    }}
                    className="mono"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--fg)',
                      borderRadius: 6,
                    }}
                  >
                    Comparison Table
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      copySummaryCard();
                      setShowExportDropdown(false);
                    }}
                    className="mono"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--fg)',
                      borderRadius: 6,
                    }}
                  >
                    Summary Card
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {mainReport.metadata?.context && (
          <div className="card" style={{ marginTop: 20, padding: 16, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'var(--mut)' }}>
                YOUR CONTEXT
              </span>
              <button
                type="button"
                onClick={() => setShowContext(!showContext)}
                className="mono"
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: 'var(--cyan)',
                }}
              >
                {showContext ? 'hide' : 'show'}
              </button>
            </div>
            {showContext && (
              <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.5, color: 'var(--fg)' }}>
                {mainReport.metadata.context}
              </p>
            )}
          </div>
        )}

        {/* Verdict */}
        <div
          className="card"
          style={{
            marginTop: 28,
            padding: 28,
            background: 'var(--card)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--violet) 0%, transparent 70%)',
              opacity: 0.15,
              pointerEvents: 'none',
            }}
          />
          <div className="mono" style={{ fontSize: 11, color: 'var(--violet)', letterSpacing: '.18em' }}>
            VERDICT
          </div>
          <div
            className="serif comparison-md"
            style={{
              marginTop: 8,
              fontSize: 30,
              lineHeight: 1.2,
              letterSpacing: '-.015em',
              maxWidth: 880,
              position: 'relative',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{verdictBody}</ReactMarkdown>
          </div>
          {comparisonSummary?.similarity_score != null && (
            <div style={{ marginTop: 16, maxWidth: 400 }}>
              <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', letterSpacing: '.12em' }}>
                SIMILARITY (AI)
              </div>
              <div style={{ marginTop: 6, height: 8, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, comparisonSummary.similarity_score))}%`,
                    height: '100%',
                    background: 'var(--violet)',
                    opacity: 0.85,
                    transition: 'width .4s',
                  }}
                />
              </div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--mut)' }}>
                {comparisonSummary.similarity_score}%
              </span>
            </div>
          )}
          {comparisonSummary && (
            <div
              style={{
                marginTop: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                position: 'relative',
              }}
            >
              {comparisonSummary.key_differences?.length ? (
                <div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', letterSpacing: '.12em' }}>
                    KEY DIFFERENCES
                  </div>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--fg)' }}>
                    {comparisonSummary.key_differences.slice(0, 4).map((d, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {comparisonSummary.complementary_areas?.length ? (
                <div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', letterSpacing: '.12em' }}>
                    COMPLEMENTARY
                  </div>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--fg)' }}>
                    {comparisonSummary.complementary_areas.slice(0, 4).map((d, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {comparisonSummary.conflicting_areas?.length ? (
                <div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', letterSpacing: '.12em' }}>
                    CONFLICTS
                  </div>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--fg)' }}>
                    {comparisonSummary.conflicting_areas.slice(0, 4).map((d, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Side-by-side table */}
        <div style={{ marginTop: 32, overflowX: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, 200px) minmax(140px, 1fr) minmax(140px, 1fr)',
              gap: 0,
              minWidth: 560,
            }}
          >
            <div />
            <PaperHeader letter="A" tint="var(--violet)" title={shortenTitle(title1, 36)} sub="Paper A" />
            <PaperHeader letter="B" tint="var(--cyan)" title={shortenTitle(title2, 36)} sub="Paper B" />
            {attrRows.map((row, i) => (
              <React.Fragment key={`${row.key}-${i}`}>
                <div
                  style={{
                    padding: '20px 16px',
                    borderTop: '1px solid var(--line)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: 'var(--mut2)',
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  {row.key}
                </div>
                <div
                  style={{
                    padding: '20px 20px',
                    borderTop: '1px solid var(--line)',
                    borderLeft: '1px solid var(--line)',
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: 'var(--fg)',
                  }}
                >
                  {row.va}
                </div>
                <div
                  style={{
                    padding: '20px 20px',
                    borderTop: '1px solid var(--line)',
                    borderLeft: '1px solid var(--line)',
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: 'var(--fg)',
                  }}
                >
                  {row.vb}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <FrameDivider label="Outcomes at a glance" />
        <div className="card" style={{ padding: 24, background: 'var(--card)' }}>
          {barGrid.length ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 18,
              }}
            >
              {barGrid.map((row) => (
                <ContrastBar
                  key={row.label}
                  label={row.label}
                  a={row.a}
                  b={row.b}
                  amax={row.amax}
                />
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--mut)', fontSize: 15 }}>
              No scored criteria in this report. The model may omit chart data for very short inputs.
            </p>
          )}
          <p
            style={{
              fontSize: 12,
              color: 'var(--mut)',
              fontStyle: 'italic',
              marginTop: 16,
              marginBottom: 0,
            }}
          >
            Scores are AI-assessed from the article excerpts you provided — useful for relative comparison, not absolute
            quality.
          </p>
          {hasChart && (
            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setShowClassicChart(!showClassicChart)}
                className="mono"
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--cyan)',
                  fontSize: 12,
                  letterSpacing: '.06em',
                  padding: 0,
                }}
              >
                {showClassicChart ? '− hide bar chart' : '+ classic bar chart view'}
              </button>
              {showClassicChart && (
                <div style={{ marginTop: 16 }}>
                  <ChartDisplay graphData={graphData} />
                </div>
              )}
            </div>
          )}
        </div>

        <FrameDivider label="What you should cite" />
        <div className="card" style={{ padding: 26, background: 'var(--card)' }}>
          <div
            className="serif comparison-md"
            style={{
              fontSize: 22,
              lineHeight: 1.3,
              maxWidth: 880,
            }}
          >
            {comparisonSummary?.student_recommendation || comparisonSummary?.citation_strategy ? (
              <>
                {comparisonSummary?.student_recommendation ? (
                  <div style={{ marginBottom: comparisonSummary?.citation_strategy ? 16 : 0 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {comparisonSummary.student_recommendation}
                    </ReactMarkdown>
                  </div>
                ) : null}
                {comparisonSummary?.citation_strategy ? (
                  <div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {comparisonSummary.citation_strategy}
                    </ReactMarkdown>
                  </div>
                ) : null}
              </>
            ) : (
              <p style={{ margin: 0 }}>
                Use the executive summary and comparative overview to decide which source supports each claim in
                your paper.
              </p>
            )}
          </div>
        </div>

        <FrameDivider label="Full analysis" />
        <div className="card" style={{ padding: '24px 28px 32px', background: 'var(--card)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {sections.map((section) => (
              <section key={section.id}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <h2
                    className="serif"
                    style={{
                      margin: 0,
                      fontSize: 26,
                      letterSpacing: '-.02em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{section.icon}</span>
                    {section.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(section.content.join('\n'), section.title)}
                    title="Copy section"
                    className="mono"
                    style={{
                      flexShrink: 0,
                      border: '1px solid var(--line)',
                      background: 'var(--bg-2)',
                      cursor: 'pointer',
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontSize: 11,
                      color: 'var(--mut)',
                    }}
                  >
                    {copiedSection === section.title ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div
                  style={{
                    fontSize: 16,
                    lineHeight: 1.65,
                    color: 'var(--fg)',
                  }}
                  className="comparison-md"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {section.content.join('\n')}
                  </ReactMarkdown>
                </div>
              </section>
            ))}
          </div>
        </div>

        <FrameDivider label="Smart follow-ups" />
        <div className="card" style={{ padding: 24, background: 'var(--card)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              onClick={() => {
                const contextPrompt = mainReport.metadata?.context
                  ? `Based on the context "${mainReport.metadata.context}", generate a sample essay introduction paragraph that incorporates both articles from this comparison.`
                  : 'Generate a sample essay introduction paragraph that incorporates both articles from this comparison.';
                onFollowUp && onFollowUp(formatFollowUpQuery(contextPrompt));
              }}
              className="btn btn-ghost"
              style={{
                position: 'relative',
                overflow: 'hidden',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: 14,
                height: 'auto',
                minHeight: 72,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 4,
                  height: '100%',
                  background: 'var(--hot)',
                }}
              />
              <span
                className="serif"
                style={{ fontSize: 17, display: 'block', marginBottom: 4, color: 'var(--fg)', position: 'relative' }}
              >
                Essay help
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--mut)', position: 'relative' }}>
                Sample intro weaving both sources
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                const contextPrompt = mainReport.metadata?.context
                  ? `Based on the context "${mainReport.metadata.context}" and this article comparison, generate 3 smart research questions that could guide further investigation.`
                  : 'Based on this article comparison, generate 3 smart research questions that could guide further investigation.';
                onFollowUp && onFollowUp(formatFollowUpQuery(contextPrompt));
              }}
              className="btn btn-ghost"
              style={{
                position: 'relative',
                overflow: 'hidden',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: 14,
                height: 'auto',
                minHeight: 72,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 4,
                  height: '100%',
                  background: 'var(--cyan)',
                }}
              />
              <span
                className="serif"
                style={{ fontSize: 17, display: 'block', marginBottom: 4, color: 'var(--fg)', position: 'relative' }}
              >
                Research questions
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--mut)', position: 'relative' }}>
                Three citation-grounded next steps
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                const contextPrompt = mainReport.metadata?.context
                  ? `Highlight and explain the matching concepts between both articles that are relevant to "${mainReport.metadata.context}".`
                  : 'Highlight and explain the matching concepts and themes that appear in both articles.';
                onFollowUp && onFollowUp(formatFollowUpQuery(contextPrompt));
              }}
              className="btn btn-ghost"
              style={{
                position: 'relative',
                overflow: 'hidden',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: 14,
                height: 'auto',
                minHeight: 72,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 4,
                  height: '100%',
                  background: 'var(--sun)',
                }}
              />
              <span
                className="serif"
                style={{ fontSize: 17, display: 'block', marginBottom: 4, color: 'var(--fg)', position: 'relative' }}
              >
                Matching concepts
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--mut)', position: 'relative' }}>
                Shared themes across papers
              </span>
            </button>
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--mut2)', marginBottom: 10 }}
          >
            ADDITIONAL ANALYSIS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                const contextPrompt = mainReport.metadata?.context
                  ? `What are the practical implications of these article differences for "${mainReport.metadata.context}"?`
                  : 'What are the practical implications of these differences?';
                onFollowUp && onFollowUp(formatFollowUpQuery(contextPrompt));
              }}
              className="btn btn-ghost"
              style={{ justifyContent: 'flex-start', textAlign: 'left', padding: 12 }}
            >
              Practical implications
            </button>
            <button
              type="button"
              onClick={() => {
                const contextPrompt = mainReport.metadata?.context
                  ? `How should I cite both articles effectively for "${mainReport.metadata.context}"?`
                  : 'How should I cite both articles effectively in my work?';
                onFollowUp && onFollowUp(formatFollowUpQuery(contextPrompt));
              }}
              className="btn btn-ghost"
              style={{ justifyContent: 'flex-start', textAlign: 'left', padding: 12 }}
            >
              Citation strategy (deeper)
            </button>
          </div>
        </div>
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
