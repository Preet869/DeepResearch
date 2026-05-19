/**
 * Parse markdown into blocks and render them to jsPDF with readable typography.
 */

const PT_TO_MM = 25.4 / 72;

function lineHeightMm(fontSizePt, factor = 1.5) {
  return fontSizePt * PT_TO_MM * factor;
}

/** Split inline **bold** and [text](url) into segments. */
export function parseInlineSegments(text) {
  let input = String(text || '');
  if (/[★☆]/.test(input) && /\d+\s*\/\s*10/.test(input)) {
    input = sanitizeRatingCell(input);
  } else {
    input = sanitizeForPdf(input);
  }
  const segments = [];
  const re = /(\*\*|__)(.+?)\1|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m = re.exec(input);
  while (m) {
    if (m.index > last) {
      segments.push({ text: input.slice(last, m.index), bold: false });
    }
    if (m[2]) {
      segments.push({ text: m[2], bold: true });
    } else if (m[3]) {
      segments.push({ text: `${m[3]} (${m[4]})`, bold: false });
    }
    last = m.index + m[0].length;
    m = re.exec(input);
  }
  if (last < input.length) {
    segments.push({ text: input.slice(last), bold: false });
  }
  if (!segments.length && input) {
    segments.push({ text: input, bold: false });
  }
  return segments;
}

function extractScore(text) {
  const m = String(text).match(/\(?\s*(\d+(?:\.\d+)?)\s*\/\s*10\s*\)?/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Helvetica cannot render ★/☆ — normalize rating cells to "4/5 (8/10)" or "(8/10)".
 */
export function sanitizeRatingCell(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';

  const score = extractScore(raw);
  const filled = (raw.match(/★/g) || []).length;
  const empty = (raw.match(/☆/g) || []).length;
  const totalStars = filled + empty;

  if (score != null) {
    if (totalStars > 0) {
      return `${filled}/${totalStars} (${formatScore(score)})`;
    }
    return `(${formatScore(score)})`;
  }

  return sanitizeForPdf(raw);
}

function formatScore(score) {
  return Number.isInteger(score) ? `${score}/10` : `${score.toFixed(1)}/10`;
}

function stripUnsafeChars(text) {
  return String(text || '')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      if (code < 32 || code === 127) return false;
      if (code >= 0x200b && code <= 0x200d) return false;
      if (code === 0xfeff) return false;
      return true;
    })
    .join('');
}

/** Remove characters that break jsPDF standard fonts. */
export function sanitizeForPdf(text) {
  return stripUnsafeChars(text)
    .replace(/[★⭐]/g, '')
    .replace(/[☆○]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Strip remaining markdown artifacts from plain text. */
function cleanPlainText(text) {
  return sanitizeForPdf(
    String(text || '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*/g, '')
      .replace(/__/g, ''),
  );
}

function isTableSeparatorRow(line) {
  return /^\|?[\s\-:|]+\|?$/.test(String(line || '').trim());
}

function parseTableRow(line) {
  return String(line || '')
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
}

function normalizeTableCell(cell, colIndex, isHeader) {
  const stripped = String(cell || '')
    .replace(/^\*\*|\*\*$/g, '')
    .trim();
  if (isHeader) return cleanPlainText(stripped);
  if (colIndex === 1 || colIndex === 2) {
    return sanitizeRatingCell(stripped);
  }
  return cleanPlainText(stripped);
}

/**
 * @param {string} markdown
 * @returns {Array<{ type: string, text?: string }>}
 */
export function parseMarkdownBlocks(markdown) {
  const lines = String(markdown || '').split('\n');
  const blocks = [];
  let paragraphLines = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const text = paragraphLines.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    paragraphLines = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (/^---+$|^\*\*\*+$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: 'divider' });
      continue;
    }

    if (/^\|/.test(trimmed)) {
      flushParagraph();
      const tableLines = [trimmed];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
        i += 1;
        tableLines.push(lines[i].trim());
      }
      const rows = tableLines
        .filter((l) => !isTableSeparatorRow(l))
        .map(parseTableRow)
        .filter((row) => row.some((cell) => cell.length > 0));
      if (rows.length > 0) {
        blocks.push({ type: 'table', rows });
      }
      continue;
    }

    if (/^#\s/.test(line) && !/^##/.test(line)) {
      flushParagraph();
      blocks.push({
        type: 'heading1',
        text: cleanPlainText(line.replace(/^#\s+/, '')),
      });
      continue;
    }

    if (/^##\s/.test(line) && !/^###\s/.test(line)) {
      flushParagraph();
      const heading = cleanPlainText(line.replace(/^##\s+/, ''));
      if (/^references$/i.test(heading)) {
        blocks.push({ type: 'referencesHeading', text: 'References' });
      } else {
        blocks.push({ type: 'heading2', text: heading });
      }
      continue;
    }

    if (/^###\s/.test(line)) {
      flushParagraph();
      const heading = cleanPlainText(line.replace(/^###\s+/, ''));
      if (!/^question$/i.test(heading)) {
        blocks.push({ type: 'heading3', text: heading });
      }
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      blocks.push({
        type: 'bullet',
        text: trimmed.replace(/^[-*]\s+/, ''),
      });
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

/**
 * Extract ## References section from markdown.
 */
export function splitReferences(markdown) {
  const text = String(markdown || '');
  const refMatch = text.match(/\n##\s*References\s*\n([\s\S]*)/i);
  if (!refMatch) {
    return { body: text.trim(), references: '' };
  }
  return {
    body: text.slice(0, refMatch.index).trim(),
    references: (refMatch[1] || '').trim(),
  };
}

function createLayout(doc, yStart) {
  const MM_MARGIN = 20;
  const MM_MAX_WIDTH = 170;
  const MM_FOOTER = 18;

  const pageH = () => doc.internal.pageSize.getHeight();
  const contentBottom = () => pageH() - MM_FOOTER;

  const state = { y: yStart };

  const newPage = () => {
    doc.addPage();
    state.y = MM_MARGIN;
  };

  const ensureSpace = (neededMm) => {
    if (state.y + neededMm > contentBottom()) {
      newPage();
    }
  };

  return {
    doc,
    marginLeft: MM_MARGIN,
    maxWidth: MM_MAX_WIDTH,
    state,
    ensureSpace,
    newPage,
    contentBottom,
  };
}

/** Write inline segments with word wrap. */
function writeInlineText(layout, segments, fontSizePt, startX = null) {
  const { doc, marginLeft, maxWidth, state, ensureSpace } = layout;
  const x0 = startX ?? marginLeft;
  const lh = lineHeightMm(fontSizePt);
  let x = x0;
  let lineSegments = [];

  const flushLine = () => {
    if (!lineSegments.length) return;
    ensureSpace(lh);
    let cx = x0;
    for (const seg of lineSegments) {
      doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      doc.setFontSize(fontSizePt);
      doc.setTextColor(0, 0, 0);
      doc.text(seg.text, cx, state.y, { baseline: 'top' });
      cx += doc.getTextWidth(seg.text);
    }
    state.y += lh;
    lineSegments = [];
    x = x0;
  };

  for (const seg of segments) {
    const words = seg.text.split(/(\s+)/);
    for (const word of words) {
      if (!word) continue;
      doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      doc.setFontSize(fontSizePt);
      const wordWidth = doc.getTextWidth(word);
      if (x + wordWidth > x0 + maxWidth && x > x0) {
        flushLine();
      }
      lineSegments.push({ text: word, bold: seg.bold });
      x += wordWidth;
    }
  }
  flushLine();
}

/** Column width weights for 4-column comparison tables. */
function tableColumnWidths(colCount, maxWidth) {
  if (colCount === 4) {
    const weights = [0.22, 0.16, 0.16, 0.46];
    return weights.map((w) => w * maxWidth);
  }
  const w = maxWidth / colCount;
  return Array(colCount).fill(w);
}

function wrapCellText(doc, text, width, fontSizePt) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);
  const safe = cleanPlainText(text) || ' ';
  return doc.splitTextToSize(safe, Math.max(width - 3, 8));
}

function renderTableBlock(layout, rows) {
  if (!rows?.length) return;
  const { doc, marginLeft, maxWidth, state } = layout;
  const fontSizePt = 9;
  const headerPt = 9;
  const cellPad = 2;
  const lh = lineHeightMm(fontSizePt, 1.35);
  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidths = tableColumnWidths(colCount, maxWidth);

  const normalizedRows = rows.map((row, rowIndex) =>
    Array.from({ length: colCount }, (_, ci) =>
      normalizeTableCell(row[ci] || '', ci, rowIndex === 0),
    ),
  );

  normalizedRows.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const cellLines = row.map((cell, ci) =>
      wrapCellText(doc, cell, colWidths[ci], isHeader ? headerPt : fontSizePt),
    );
    const maxLines = Math.max(...cellLines.map((l) => l.length), 1);
    const rowH = maxLines * lh + cellPad * 2;

    if (state.y + rowH > layout.contentBottom()) {
      layout.newPage();
    }

    const rowY = state.y;
    if (isHeader) {
      doc.setFillColor(240, 240, 240);
      doc.setDrawColor(200, 200, 200);
      doc.rect(marginLeft, rowY, maxWidth, rowH, 'FD');
    } else if (rowIndex % 2 === 0) {
      doc.setFillColor(252, 252, 252);
      doc.setDrawColor(230, 230, 230);
      doc.rect(marginLeft, rowY, maxWidth, rowH, 'FD');
    } else {
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.15);
      doc.line(marginLeft, rowY + rowH, marginLeft + maxWidth, rowY + rowH);
    }

    let x = marginLeft;
    row.forEach((cell, ci) => {
      const lines = cellLines[ci];
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setFontSize(isHeader ? headerPt : fontSizePt);
      doc.setTextColor(30, 30, 30);
      let cy = rowY + cellPad;
      for (const ln of lines) {
        doc.text(ln, x + cellPad, cy, { baseline: 'top' });
        cy += lh;
      }
      x += colWidths[ci];
    });

    state.y = rowY + rowH;
  });

  state.y += 4;
}

function writePlainWrapped(layout, text, fontSizePt, fontStyle = 'normal', extraAfter = 0) {
  const { doc, marginLeft, maxWidth, state, ensureSpace } = layout;
  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSizePt);
  doc.setTextColor(0, 0, 0);
  const lh = lineHeightMm(fontSizePt);
  const chunks = doc.splitTextToSize(cleanPlainText(text) || ' ', maxWidth);
  for (const line of chunks) {
    ensureSpace(lh);
    doc.text(line, marginLeft, state.y, { baseline: 'top' });
    state.y += lh;
  }
  state.y += extraAfter;
}

/**
 * Render a question callout box.
 */
export function renderQuestionCallout(layout, questionText) {
  if (!questionText?.trim()) return;
  const { doc, marginLeft, maxWidth, state, ensureSpace } = layout;
  const pad = 4;
  const labelPt = 9;
  const bodyPt = 10.5;
  const labelLh = lineHeightMm(labelPt);
  const plainQ = cleanPlainText(questionText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(bodyPt);
  const bodyChunks = doc.splitTextToSize(plainQ, maxWidth - pad * 2);
  const boxH = pad + labelLh + 1 + bodyChunks.length * lineHeightMm(bodyPt) + pad;

  ensureSpace(boxH + 3);
  const boxY = state.y;
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginLeft, boxY, maxWidth, boxH, 2, 2, 'FD');

  state.y = boxY + pad;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(labelPt);
  doc.setTextColor(100, 100, 100);
  ensureSpace(labelLh);
  doc.text('YOUR QUESTION', marginLeft + pad, state.y, { baseline: 'top' });
  state.y += labelLh + 1;

  doc.setTextColor(40, 40, 40);
  const savedMargin = layout.marginLeft;
  const savedWidth = layout.maxWidth;
  layout.marginLeft = marginLeft + pad;
  layout.maxWidth = maxWidth - pad * 2;
  writeInlineText(layout, parseInlineSegments(questionText), bodyPt);
  layout.marginLeft = savedMargin;
  layout.maxWidth = savedWidth;

  state.y = boxY + boxH + 4;
}

/**
 * @param {object} layout
 * @param {Array} blocks
 */
export function renderBlocksToPdf(layout, blocks) {
  for (const block of blocks) {
    switch (block.type) {
      case 'heading1':
        layout.state.y += 4;
        writePlainWrapped(layout, block.text, 15, 'bold', 3);
        break;
      case 'table':
        layout.state.y += 3;
        renderTableBlock(layout, block.rows);
        break;
      case 'heading2':
        layout.state.y += 6;
        writePlainWrapped(layout, block.text, 14, 'bold', 2);
        break;
      case 'heading3':
        layout.state.y += 4;
        writePlainWrapped(layout, block.text, 12, 'bold', 1.5);
        break;
      case 'referencesHeading':
        layout.state.y += 6;
        writePlainWrapped(layout, block.text, 13, 'bold', 2);
        break;
      case 'bullet': {
        const { doc, marginLeft, maxWidth, state, ensureSpace } = layout;
        const fontSizePt = 11;
        const lh = lineHeightMm(fontSizePt);
        const bulletIndent = 6;
        const textX = marginLeft + bulletIndent;
        const textWidth = maxWidth - bulletIndent;
        ensureSpace(lh);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSizePt);
        doc.setTextColor(0, 0, 0);
        doc.text('•', marginLeft + 1, state.y, { baseline: 'top' });
        const savedM = layout.marginLeft;
        const savedW = layout.maxWidth;
        layout.marginLeft = textX;
        layout.maxWidth = textWidth;
        writeInlineText(layout, parseInlineSegments(block.text), fontSizePt, textX);
        layout.marginLeft = savedM;
        layout.maxWidth = savedW;
        state.y += 1.5;
        break;
      }
      case 'divider': {
        const { doc, marginLeft, maxWidth, state, ensureSpace } = layout;
        state.y += 4;
        ensureSpace(2);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.25);
        doc.line(marginLeft, state.y, marginLeft + maxWidth, state.y);
        state.y += 5;
        break;
      }
      case 'paragraph':
      default:
        writeInlineText(layout, parseInlineSegments(block.text), 11);
        layout.state.y += 2.5;
        break;
    }
  }
}

/**
 * Render export sections (heading + optional question + body).
 * @returns {number} final y position
 */
export function renderExportSections(doc, yStart, sections, { includeSources = true } = {}) {
  const layout = createLayout(doc, yStart);

  sections.forEach((section, index) => {
    if (index > 0) {
      layout.state.y += 4;
      const { doc: pdf, marginLeft, maxWidth, state, ensureSpace } = layout;
      if (state.y > layout.contentBottom() - 50) {
        layout.newPage();
      } else {
        ensureSpace(2);
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.25);
        pdf.line(marginLeft, state.y, marginLeft + maxWidth, state.y);
        state.y += 6;
      }
    }

    if (section.heading) {
      layout.state.y += index === 0 ? 0 : 2;
      writePlainWrapped(layout, section.heading, 14, 'bold', 2);
    }

    if (section.question) {
      renderQuestionCallout(layout, section.question);
    }

    const { body, references } = splitReferences(section.body || '');
    const blocks = parseMarkdownBlocks(body);
    renderBlocksToPdf(layout, blocks);

    if (includeSources && references) {
      layout.state.y += 4;
      writePlainWrapped(layout, 'References', 13, 'bold', 2);
      writePlainWrapped(layout, references, 10, 'normal', 0);
    }
  });

  return layout.state.y;
}

export { createLayout, lineHeightMm, writePlainWrapped };
