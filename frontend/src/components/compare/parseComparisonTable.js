/** Strip simple **bold** from markdown table cells for display. */
export function stripCellMarkdown(s) {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/**
 * Parse GFM pipe rows from section content lines.
 * @returns {Array<{ key: string, va: string, vb: string }>}
 */
export function parsePipeTableRows(lines) {
  const rows = [];
  if (!lines || !lines.length) return rows;

  for (const raw of lines) {
    const line = String(raw).trim();
    if (!line.includes('|')) continue;
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 3) continue;
    const inner = parts.slice(1, -1);
    const isSeparator =
      inner.length &&
      inner.every((c) => /^[\s:-]+$/.test(c) || /^-+$/.test(c.replace(/\s/g, '')));
    if (isSeparator) continue;
    if (inner.length < 2) continue;
    const keyRaw = inner[0];
    const vaRaw = inner[1];
    const vbRaw = inner.length > 2 ? inner.slice(2).join(' | ') : '—';
    const keyStripped = stripCellMarkdown(keyRaw);
    if (!keyStripped && inner.length >= 2) {
      const vaS = String(vaRaw);
      const vbS = String(vbRaw);
      if (/article|paper|source/i.test(vaS) && /article|paper|source/i.test(vbS)) {
        continue;
      }
    }
    if (!keyStripped && !stripCellMarkdown(vaRaw)) continue;
    rows.push({
      key: keyStripped || '—',
      va: stripCellMarkdown(vaRaw),
      vb: stripCellMarkdown(vbRaw),
    });
  }
  return rows;
}

/**
 * @param {Array<{ title: string, content: string[] }>} sections from parseComparisonSections
 */
export function extractComparativeOverviewTableRows(sections) {
  const overview = sections.find((s) => s.title.toLowerCase().includes('comparative overview'));
  if (!overview) return [];
  return parsePipeTableRows(overview.content);
}
