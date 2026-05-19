import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  renderExportSections,
  lineHeightMm,
} from './pdfMarkdownRenderer';

/**
 * Generate and download a research PDF from structured sections.
 */
export async function downloadResearchPdf({
  title,
  markdown,
  sections,
  fileName,
  includeSources = true,
  includeMetadata = true,
  captureChart = true,
}) {
  const MM_MARGIN = 20;
  const MM_MAX_WIDTH = 170;
  const MM_FOOTER = 18;

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

  const docTitle = title || 'Research';
  const generatedLabel = includeMetadata
    ? `Generated: ${new Date().toLocaleString()}`
    : `Generated: ${new Date().toLocaleDateString()}`;

  // Title — full text, multi-line wrap
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 30, 30);
  {
    const titleLines = doc.splitTextToSize(docTitle, MM_MAX_WIDTH);
    const lh = lineHeightMm(15, 1.35);
    for (const line of titleLines) {
      ensureSpace(lh);
      doc.text(line, MM_MARGIN, y, { baseline: 'top' });
      y += lh;
    }
    y += 2;
  }

  // Metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(110, 110, 110);
  {
    const lh = lineHeightMm(9.5);
    ensureSpace(lh);
    doc.text(generatedLabel, MM_MARGIN, y, { baseline: 'top' });
    y += lh + 4;
  }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  ensureSpace(1);
  doc.line(MM_MARGIN, y, MM_MARGIN + MM_MAX_WIDTH, y);
  y += 6;

  const exportSections =
    sections?.length > 0
      ? sections
      : [
          {
            heading: null,
            question: null,
            body: markdown || '',
          },
        ];

  if (
    !exportSections.some((s) => (s.body || '').trim()) &&
    !exportSections.some((s) => (s.question || '').trim())
  ) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('No report content to export.', MM_MARGIN, y, { baseline: 'top' });
  } else {
    y = renderExportSections(doc, y, exportSections, { includeSources });
  }

  if (captureChart) {
    const chartEl = document.querySelector('.chart-export-area');
    if (chartEl) {
      try {
        const canvas = await html2canvas(chartEl, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          width: chartEl.offsetWidth,
          height: chartEl.offsetHeight,
        });
        if (canvas.width > 0 && canvas.height > 0) {
          const imgData = canvas.toDataURL('image/png');
          const imgWmm = MM_MAX_WIDTH;
          const imgHmm = (canvas.height / canvas.width) * imgWmm;
          if (contentBottom() - y < 100) {
            newPage();
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(0, 0, 0);
          const lh = lineHeightMm(13);
          ensureSpace(lh + 2);
          doc.text('Data Visualization', MM_MARGIN, y, { baseline: 'top' });
          y += lh + 2;
          ensureSpace(imgHmm + 5);
          doc.addImage(imgData, 'PNG', MM_MARGIN, y, imgWmm, imgHmm);
          y += imgHmm + 5;
        }
      } catch {
        /* skip chart silently */
      }
    }
  }

  const total = doc.getNumberOfPages();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.text(
      `Page ${i} of ${total}`,
      pageW() / 2,
      pageH() - 10,
      { align: 'center', baseline: 'middle' },
    );
  }

  const baseName =
    (fileName || docTitle)
      .replace(/[\\/:*?"<>|]+/g, '')
      .trim()
      .replace(/\s+/g, ' ') || 'research';
  doc.save(`${baseName}.pdf`);
}
