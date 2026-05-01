import React, { useState } from 'react';
import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const ExportManager = ({ messages, conversationTitle, exportSelections, onClose }) => {
  const [exportFormat, setExportFormat] = useState('pdf');
  const [includeSources, setIncludeSources] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const exportFormats = [
    { id: 'pdf', name: 'PDF Document', icon: '📄' },
    { id: 'docx', name: 'Word Document', icon: '📘' },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const selectedMessages = exportSelections.length > 0 
        ? messages.filter((_, index) => exportSelections.includes(index))
        : messages;

      const exportData = {
        title: conversationTitle,
        messages: selectedMessages,
        metadata: {
          exportDate: new Date().toISOString(),
          format: exportFormat,
          includeSources,
          includeMetadata
        }
      };

      switch (exportFormat) {
        case 'pdf':
          await exportToPDF(exportData);
          break;
        case 'docx':
          await exportToDocx(exportData);
          break;
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async (data) => {
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
          { align: 'center', baseline: 'middle' },
        );
      }
    };

    const assistantMarkdown = data.messages
      .filter((m) => m.role === 'assistant' && m.content)
      .map((m) => String(m.content).trim())
      .filter(Boolean)
      .join('\n\n');

    let bodyText = assistantMarkdown;
    let referencesText = '';
    const refMatch = assistantMarkdown.match(/\n##\s*References\s*\n([\s\S]*)/i);
    if (refMatch) {
      bodyText = assistantMarkdown.slice(0, refMatch.index).trim();
      referencesText = (refMatch[1] || '').trim();
    }

    if (!data.metadata?.includeSources) {
      referencesText = '';
    }

    const title = data.title || 'Research';
    const generatedLabel = data.metadata?.includeMetadata
      ? `Generated: ${new Date().toLocaleString()}`
      : `Generated: ${new Date().toLocaleDateString()}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    {
      const titleLines = doc.splitTextToSize(title, MM_MAX_WIDTH);
      const lh = lineHeightMm(16);
      for (const line of titleLines) {
        ensureSpace(lh);
        doc.text(line, MM_MARGIN, y, { baseline: 'top' });
        y += lh;
      }
      y += 2;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    {
      const lh = lineHeightMm(11);
      ensureSpace(lh);
      doc.text(generatedLabel, MM_MARGIN, y, { baseline: 'top' });
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

    if (!bodyText.trim() && !referencesText) {
      writeWrapped('No assistant report content to export.', 11, 'normal', 0);
    } else {
      renderBodyMarkdown(bodyText || ' ');
    }

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
          writeWrapped('Data Visualization', 13, 'bold', 2);
          ensureSpace(imgHmm + 5);
          doc.addImage(imgData, 'PNG', MM_MARGIN, y, imgWmm, imgHmm);
          y += imgHmm + 5;
        }
      } catch {
        /* skip chart silently */
      }
    }

    if (referencesText) {
      y += 4;
      ensureSpace(lineHeightMm(13) + 2);
      writeWrapped('References', 13, 'bold', 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const refChunks = doc.splitTextToSize(referencesText, MM_MAX_WIDTH);
      const lhRef = lineHeightMm(10);
      for (const line of refChunks) {
        ensureSpace(lhRef);
        doc.text(line, MM_MARGIN, y, { baseline: 'top' });
        y += lhRef;
      }
    }

    addPageNumbers();

    const baseName =
      (data.title || 'research')
        .replace(/[\\/:*?"<>|]+/g, '')
        .trim()
        .replace(/\s+/g, ' ') || 'research';
    doc.save(`${baseName}.pdf`);
  };

  const exportToDocx = async (data) => {
    const reportTitle = data.title || 'Research';
    const children = [
      new Paragraph({
        text: `Research Report: ${reportTitle}`,
        heading: HeadingLevel.TITLE,
      }),
      new Paragraph({
        text: `Generated on: ${new Date().toLocaleDateString()}`,
      }),
      new Paragraph({ text: '' }),
    ];

    data.messages.forEach((message, index) => {
      const roleLabel = `${message.role.charAt(0).toUpperCase()}${message.role.slice(1)} Message ${index + 1}`;
      children.push(
        new Paragraph({
          text: roleLabel,
          heading: HeadingLevel.HEADING_2,
        }),
      );
      const body = String(message.content ?? '');
      body.split('\n').forEach((line) => {
        children.push(new Paragraph({ text: line.length ? line : ' ' }));
      });
      children.push(new Paragraph({ text: '' }));
    });

    const doc = new Document({
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base =
      (data.title || 'research')
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || 'research';
    a.download = `${base}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Export Research</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Export Format Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              {exportFormats.map((format) => (
                <button
                  key={format.id}
                  onClick={() => setExportFormat(format.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    exportFormat === format.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">{format.icon}</div>
                    <div className="text-sm font-medium">{format.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Export Options */}
          <div className="mb-6 space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeSources}
                onChange={(e) => setIncludeSources(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include sources and references</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include metadata and timestamps</span>
            </label>
          </div>

          {/* Export Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Export Summary</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div>• Format: {exportFormats.find(f => f.id === exportFormat)?.name}</div>
              <div>• Messages: {exportSelections.length > 0 ? exportSelections.length : messages.length} selected</div>
              <div>• Title: {conversationTitle}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportManager; 