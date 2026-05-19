// Parses the raw markdown produced by ARTICLE_COMPARISON_PROMPT into a
// structured shape the split-screen layout can render. The parser is intentionally
// forgiving: any missing piece becomes an empty string / empty array so the
// renderer can simply skip it.

function matchH1(rawTitle) {
  const t = String(rawTitle || '').toLowerCase();
  if (t.includes('how to use this report')) return 'howToUse';
  if (t.includes('quick comparative overview')) return 'overview';
  if (t.includes('thematic analysis')) return 'themes';
  if (t.includes('methodological notes') || t.includes('methodology notes')) return 'methodology';
  if (t.includes('how to use these sources')) return 'templates';
  if (t.includes('quick reference')) return 'quickReference';
  if (t.includes('research gaps')) return 'gaps';
  if (t.includes('citation') && t.includes('quote')) return 'citationQuotes';
  return null;
}

function splitByH1(lines) {
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m && !line.startsWith('##')) {
      if (current) sections.push(current);
      current = { title: m[1].trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections;
}

function countStars(text) {
  return (String(text).match(/★/g) || []).length;
}

function extractScore(text) {
  const m = String(text).match(/\(?\s*(\d+(?:\.\d+)?)\s*\/\s*10\s*\)?/);
  return m ? parseFloat(m[1]) : null;
}

function parseRatingRow(row) {
  const cells = row.split('|').slice(1, -1).map((c) => c.trim());
  if (cells.length < 3) return null;
  const [criteria, aCell, bCell, whyCell = ''] = cells;
  if (!criteria || /^[-:|\s]+$/.test(criteria)) return null;
  if (/^criteria$/i.test(criteria)) return null;
  return {
    criteria: criteria.replace(/^\*\*|\*\*$/g, '').trim(),
    aRaw: aCell,
    bRaw: bCell,
    aStars: countStars(aCell),
    bStars: countStars(bCell),
    aScore: extractScore(aCell),
    bScore: extractScore(bCell),
    why: whyCell,
  };
}

function parseOverview(lines) {
  const out = {
    keyInsight: '',
    ratingsTable: '',
    ratings: [],
    bullets: [],
  };

  const tableLines = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('##')) continue;

    if (trimmed.startsWith('|')) {
      inTable = true;
      tableLines.push(trimmed);
      continue;
    }
    if (inTable && !trimmed.startsWith('|')) {
      inTable = false;
    }

    const insightMatch = trimmed.match(/^\*\*Key Insight\*\*\s*:?\s*(.*)$/i);
    if (insightMatch) {
      out.keyInsight = insightMatch[1].trim();
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      out.bullets.push(trimmed.replace(/^[-*]\s+/, ''));
    }
  }

  out.ratingsTable = tableLines.join('\n');
  out.ratings = tableLines
    .filter((l) => !/^\s*\|\s*[-:|\s]+\|\s*$/.test(l))
    .map(parseRatingRow)
    .filter(Boolean);

  return out;
}

function extractPositionParts(bucket) {
  const positionLines = [];
  let quote = '';
  let evidence = '';
  for (const line of bucket) {
    const trimmed = line.trim();
    const qm = trimmed.match(/^[-*]?\s*Quote\s*:?\s*(.+)$/i);
    if (qm) {
      quote = qm[1].trim().replace(/^["“”']\s*|\s*["“”']$/g, '').trim();
      continue;
    }
    const em = trimmed.match(/^[-*]?\s*Evidence(?:\s+type)?\s*:?\s*(.+)$/i);
    if (em) {
      evidence = em[1].trim();
      continue;
    }
    if (trimmed) positionLines.push(trimmed);
  }
  return { position: positionLines.join(' ').trim(), quote, evidence };
}

// Matches **Article A's Position**, **Article 1 Position**, **Article A (NAPS) Position**,
// possibly preceded by a list bullet and possibly with trailing content before the closing **.
const ARTICLE_A_POSITION_RE =
  /^[-*]?\s*\*\*Article\s+(?:A|1)\b[^*]*?Position[^*]*?\*\*\s*:?\s*(.*)$/i;
const ARTICLE_B_POSITION_RE =
  /^[-*]?\s*\*\*Article\s+(?:B|2)\b[^*]*?Position[^*]*?\*\*\s*:?\s*(.*)$/i;
const SYNTHESIS_RE = /^[-*]?\s*\*\*Synthesis\*\*\s*:?\s*(.*)$/i;
// Generic fallback for any bold inline header at the start of a line. Used when the
// model writes things like **Virginia Tech's Position** or **NAPS Position** instead
// of the explicit "Article A/B" wording.
const ANY_BOLD_HEADER_RE = /^[-*]?\s*\*\*([^*]+?)\*\*\s*:?\s*(.*)$/;

function parseOverlappingTheme(theme) {
  const lines = theme.rawLines || [];
  const buckets = { A: [], B: [], synth: [] };
  let target = null;
  const assigned = { A: false, B: false };

  for (const line of lines) {
    const trimmed = line.trim();

    let m = trimmed.match(ARTICLE_A_POSITION_RE);
    if (m) {
      target = 'A';
      assigned.A = true;
      if (m[1]) buckets.A.push(m[1]);
      continue;
    }
    m = trimmed.match(ARTICLE_B_POSITION_RE);
    if (m) {
      target = 'B';
      assigned.B = true;
      if (m[1]) buckets.B.push(m[1]);
      continue;
    }
    m = trimmed.match(SYNTHESIS_RE);
    if (m) {
      target = 'synth';
      if (m[1]) buckets.synth.push(m[1]);
      continue;
    }
    m = trimmed.match(ANY_BOLD_HEADER_RE);
    if (m) {
      const label = m[1].trim().toLowerCase();
      // Skip sub-markers that belong inside a position block, not new ones.
      if (/^(quote|evidence(\s+type)?|implication)$/i.test(label)) {
        if (target) buckets[target].push(line);
        continue;
      }
      if (!assigned.A) {
        target = 'A';
        assigned.A = true;
      } else if (!assigned.B) {
        target = 'B';
        assigned.B = true;
      } else {
        target = null;
      }
      if (target && m[2]) buckets[target].push(m[2]);
      continue;
    }
    if (target) buckets[target].push(line);
  }

  const A = extractPositionParts(buckets.A);
  const B = extractPositionParts(buckets.B);

  return {
    title: theme.title,
    positionA: A.position,
    quoteA: A.quote,
    evidenceA: A.evidence,
    positionB: B.position,
    quoteB: B.quote,
    evidenceB: B.evidence,
    synthesis: buckets.synth.join('\n').trim(),
  };
}

function parseUniqueThemes(lines) {
  const themes = [];
  let currentTitle = null;
  let buf = [];

  const flush = () => {
    if (currentTitle !== null) {
      themes.push({ title: currentTitle, body: buf.join('\n').trim() });
    }
    currentTitle = null;
    buf = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(/^\*\*([^*]+?)\*\*\s*\(Article\s+[12]\s+only\)\s*$/i);
    if (headerMatch) {
      flush();
      currentTitle = headerMatch[1].trim();
      continue;
    }
    if (currentTitle === null && trimmed) {
      currentTitle = '';
      buf.push(line);
      continue;
    }
    if (currentTitle !== null) buf.push(line);
  }
  flush();

  return themes.filter((t) => t.body.trim() || t.title);
}

function parseThemes(lines) {
  const result = { overlapping: [], uniqueA: [], uniqueB: [] };
  let currentH2 = null;
  let currentTheme = null;
  let buf = [];
  const stash = { uniqueA: [], uniqueB: [] };

  const flushOverlap = () => {
    if (currentTheme && currentH2 === 'overlapping') {
      currentTheme.rawLines = buf;
      result.overlapping.push(parseOverlappingTheme(currentTheme));
    }
    currentTheme = null;
    buf = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    const h2 = trimmed.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      flushOverlap();
      const t = h2[1].toLowerCase();
      if (t.includes('overlap')) currentH2 = 'overlapping';
      else if (t.includes('unique to article 1') || t.includes('unique to article a')) currentH2 = 'uniqueA';
      else if (t.includes('unique to article 2') || t.includes('unique to article b')) currentH2 = 'uniqueB';
      else currentH2 = null;
      continue;
    }

    if (currentH2 === 'overlapping') {
      const h3 = trimmed.match(/^###\s+(.+?)\s*$/);
      if (h3) {
        flushOverlap();
        currentTheme = { title: h3[1].replace(/^["“]|["”]$/g, '').replace(/^\[|\]$/g, '').trim() };
        continue;
      }
      if (currentTheme) buf.push(line);
    } else if (currentH2 === 'uniqueA') {
      stash.uniqueA.push(line);
    } else if (currentH2 === 'uniqueB') {
      stash.uniqueB.push(line);
    }
  }
  flushOverlap();

  result.uniqueA = parseUniqueThemes(stash.uniqueA);
  result.uniqueB = parseUniqueThemes(stash.uniqueB);
  return result;
}

function parseGaps(lines) {
  const gaps = [];
  let current = null;
  let target = null;
  let buf = { missing: [], toFind: [], sources: [], why: [] };

  const finalize = () => {
    if (current) {
      gaps.push({
        title: current,
        missing: buf.missing.join('\n').trim(),
        toFind: buf.toFind.join('\n').trim(),
        sources: buf.sources.join('\n').trim(),
        why: buf.why.join('\n').trim(),
      });
    }
    current = null;
    target = null;
    buf = { missing: [], toFind: [], sources: [], why: [] };
  };

  for (const line of lines) {
    const trimmed = line.trim();

    const h3 = trimmed.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      finalize();
      current = h3[1].replace(/^Gap\s+\d+\s*:\s*/i, '').trim();
      target = null;
      continue;
    }

    let m = trimmed.match(/^\*\*What'?s?\s+missing\*\*\s*:?\s*(.*)$/i);
    if (m) { target = 'missing'; if (m[1]) buf.missing.push(m[1]); continue; }

    m = trimmed.match(/^\*\*To find it\*\*\s*:?\s*(.*)$/i);
    if (m) { target = 'toFind'; if (m[1]) buf.toFind.push(m[1]); continue; }

    m = trimmed.match(/^\*\*Recommended sources\*\*\s*:?\s*(.*)$/i);
    if (m) { target = 'sources'; if (m[1]) buf.sources.push(m[1]); continue; }

    m = trimmed.match(/^\*\*Why it matters\*\*\s*:?\s*(.*)$/i);
    if (m) { target = 'why'; if (m[1]) buf.why.push(m[1]); continue; }

    if (target && current) buf[target].push(line);
  }
  finalize();
  return gaps;
}

export function parseComparisonReport(markdown) {
  const result = {
    overview: { keyInsight: '', ratingsTable: '', ratings: [], bullets: [] },
    overlappingThemes: [],
    uniqueA: [],
    uniqueB: [],
    methodology: '',
    templates: '',
    quickReference: '',
    gaps: [],
    citationQuotes: '',
    howToUse: '',
  };

  if (!markdown || typeof markdown !== 'string') return result;

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const sections = splitByH1(lines);

  for (const sec of sections) {
    const key = matchH1(sec.title);
    const body = sec.lines.join('\n').trim();

    if (key === 'overview') {
      result.overview = parseOverview(sec.lines);
    } else if (key === 'themes') {
      const themes = parseThemes(sec.lines);
      result.overlappingThemes = themes.overlapping;
      result.uniqueA = themes.uniqueA;
      result.uniqueB = themes.uniqueB;
    } else if (key === 'methodology') {
      result.methodology = body;
    } else if (key === 'templates') {
      result.templates = body;
    } else if (key === 'quickReference') {
      result.quickReference = body;
    } else if (key === 'gaps') {
      result.gaps = parseGaps(sec.lines);
    } else if (key === 'citationQuotes') {
      result.citationQuotes = body;
    } else if (key === 'howToUse') {
      result.howToUse = body;
    }
  }

  return result;
}

export default parseComparisonReport;
