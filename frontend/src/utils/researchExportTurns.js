/** Truncate text for menu labels and filenames. */
export function shortenText(text, max = 55) {
  if (!text) return '';
  const s = String(text).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Pair user/assistant messages into exportable research turns.
 */
export function getResearchTurns(messages) {
  const users = (messages || []).filter((m) => m.role === 'user');
  const assistants = (messages || []).filter((m) => m.role === 'assistant');

  return users
    .map((user, i) => {
      const assistant = assistants[i];
      const answer = String(assistant?.content || '').trim();
      if (!answer) return null;

      return {
        turnIndex: i,
        question: String(user.content || '').trim(),
        answer,
        assistantMetadata: assistant?.metadata || {},
        userMessage: user,
        assistantMessage: assistant,
      };
    })
    .filter(Boolean);
}

/**
 * Human-readable label for a turn in export menus and summaries.
 */
export function getTurnExportLabel(turn, { conversationType } = {}) {
  const isComparison = conversationType === 'article_comparison';

  if (isComparison && turn.turnIndex === 0) {
    const meta = turn.assistantMetadata || {};
    const a1 = meta.article1_title;
    const a2 = meta.article2_title;
    if (a1 && a2) {
      return {
        label: 'Comparison report',
        menuLabel: 'Comparison report',
        subtitle: `${shortenText(a1, 36)} vs ${shortenText(a2, 36)}`,
      };
    }
    return {
      label: 'Comparison report',
      menuLabel: 'Comparison report',
      subtitle: shortenText(turn.question, 60) || null,
    };
  }

  if (isComparison && turn.turnIndex > 0) {
    const q = shortenText(turn.question, 52);
    return {
      label: `Follow-up: ${q}`,
      menuLabel: `Follow-up: ${q}`,
      subtitle: null,
    };
  }

  if (turn.turnIndex === 0) {
    return {
      label: 'Original report',
      menuLabel: 'Original report',
      subtitle: shortenText(turn.question, 60) || null,
    };
  }

  const q = shortenText(turn.question, 48);
  return {
    label: `Follow-up ${turn.turnIndex}: ${q}`,
    menuLabel: `Follow-up ${turn.turnIndex}: ${q}`,
    subtitle: null,
  };
}

/**
 * Full title for PDF header (never truncated).
 */
export function getTurnExportTitle(turn, { conversationType } = {}) {
  const isComparison = conversationType === 'article_comparison';

  if (isComparison && turn.turnIndex === 0) {
    const meta = turn.assistantMetadata || {};
    const a1 = meta.article1_title;
    const a2 = meta.article2_title;
    if (a1 && a2) {
      return `Comparison: ${a1} vs ${a2}`;
    }
    return turn.question?.trim() || 'Comparison report';
  }

  if (turn.turnIndex === 0) {
    return turn.question?.trim() || 'Original report';
  }

  return turn.question?.trim() || `Follow-up ${turn.turnIndex}`;
}

/**
 * Build export payload with structured sections for PDF rendering.
 */
export function buildExportPayload(turns, scope, { conversationType } = {}) {
  if (!turns?.length) {
    return {
      title: 'Research',
      markdown: '',
      sections: [],
      sectionCount: 0,
      scopeLabel: 'No content',
    };
  }

  if (scope.mode === 'all') {
    const sections = turns.map((turn) => {
      const { menuLabel } = getTurnExportLabel(turn, { conversationType });
      return {
        heading: menuLabel,
        question: turn.question || null,
        body: turn.answer,
      };
    });

    return {
      title: 'All research',
      markdown: sections.map((s) => s.body).join('\n\n---\n\n'),
      sections,
      sectionCount: turns.length,
      scopeLabel: `All research (${turns.length} sections)`,
    };
  }

  const turn =
    turns.find((t) => t.turnIndex === scope.turnIndex) ?? turns[0];
  const { label } = getTurnExportLabel(turn, { conversationType });
  const title = getTurnExportTitle(turn, { conversationType });

  const showQuestionCallout =
    turn.question && title.trim() !== turn.question.trim();

  const sections = [
    {
      heading: null,
      question: showQuestionCallout ? turn.question : null,
      body: turn.answer,
    },
  ];

  return {
    title,
    markdown: turn.answer,
    sections,
    sectionCount: 1,
    scopeLabel: label,
  };
}

/**
 * Safe filename base (without extension).
 */
export function getExportFileBaseName({
  conversationTitle,
  scope,
  turns,
  conversationType,
}) {
  const base =
    (conversationTitle || 'research')
      .replace(/[\\/:*?"<>|]+/g, '')
      .trim()
      .replace(/\s+/g, ' ') || 'research';

  if (scope.mode === 'all') {
    return `${base} - all research`;
  }

  const turn = turns.find((t) => t.turnIndex === scope.turnIndex);
  if (!turn) return base;

  if (conversationType === 'article_comparison' && turn.turnIndex === 0) {
    return `${base} - comparison`;
  }
  if (turn.turnIndex > 0) {
    return `${base} - followup ${turn.turnIndex}`;
  }
  return base;
}
