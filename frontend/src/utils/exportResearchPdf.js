import analyticsService from '../services/analyticsService';

/**
 * Opens a print-ready window from the first assistant message (same as Research page export).
 */
export function exportResearchToPDF({ messages, conversationTitle, conversationId }) {
  if (!messages?.length) return false;

  const mainReport = messages.filter((m) => m.role === 'assistant')[0];
  if (!mainReport) return false;

  if (conversationId != null) {
    analyticsService.trackDocumentExport(conversationId, 'pdf', 'research_report', {
      conversation_id: conversationId,
      content_length: mainReport.content.length,
      total_messages: messages.length,
    });
  }

  const printWindow = window.open('', '_blank');
  const title = conversationTitle || 'Research Report';

  printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 8.5in;
              margin: 0 auto;
              padding: 1in;
            }
            h1 { color: #1f2937; font-size: 24px; margin-bottom: 20px; }
            h2 { color: #374151; font-size: 20px; margin-top: 30px; margin-bottom: 15px; }
            p { margin: 12px 0; }
            @media print {
              body { margin: 0; padding: 0.5in; }
            }
          </style>
        </head>
        <body>
          <h1>📘 ${title}</h1>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; font-size: 14px; color: #6b7280;">
            Generated: ${new Date().toLocaleDateString()}
          </div>
          <div style="white-space: pre-wrap;">${mainReport.content}</div>
        </body>
      </html>
    `);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);

  return true;
}
