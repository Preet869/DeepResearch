import React, { useState, useMemo, useEffect } from 'react';
import analyticsService from '../services/analyticsService';
import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import {
  getResearchTurns,
  getTurnExportLabel,
  buildExportPayload,
  getExportFileBaseName,
} from '../utils/researchExportTurns';
import { downloadResearchPdf } from '../utils/downloadResearchPdf';

const ExportManager = ({
  messages,
  conversationTitle,
  conversationType,
  conversationId,
  initialScope,
  onClose,
}) => {
  const turns = useMemo(() => getResearchTurns(messages), [messages]);

  const defaultScope = useMemo(() => {
    if (initialScope?.mode === 'all' && turns.length > 1) {
      return { mode: 'all' };
    }
    if (
      initialScope?.mode === 'turn' &&
      turns.some((t) => t.turnIndex === initialScope.turnIndex)
    ) {
      return { mode: 'turn', turnIndex: initialScope.turnIndex };
    }
    if (turns.length > 0) {
      return { mode: 'turn', turnIndex: turns[0].turnIndex };
    }
    return { mode: 'all' };
  }, [initialScope, turns]);

  const [exportScope, setExportScope] = useState(defaultScope);
  const [exportFormat, setExportFormat] = useState('pdf');

  useEffect(() => {
    setExportScope(defaultScope);
  }, [defaultScope]);
  const [includeSources, setIncludeSources] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const exportFormats = [
    { id: 'pdf', name: 'PDF Document', icon: '📄' },
    { id: 'docx', name: 'Word Document', icon: '📘' },
  ];

  const payload = buildExportPayload(turns, exportScope, { conversationType });
  const fileName = getExportFileBaseName({
    conversationTitle,
    scope: exportScope,
    turns,
    conversationType,
  });

  const handleExport = async () => {
    if (!turns.length) {
      alert('Nothing to export yet.');
      return;
    }

    setIsExporting(true);

    try {
      if (exportFormat === 'pdf') {
        await downloadResearchPdf({
          title: payload.title,
          markdown: payload.markdown,
          sections: payload.sections,
          fileName,
          includeSources,
          includeMetadata,
          captureChart:
            exportScope.mode === 'turn' && exportScope.turnIndex === 0,
        });
      } else if (exportFormat === 'docx') {
        await exportToDocx({
          title: payload.title,
          markdown: payload.markdown,
          fileName,
        });
      } else {
        throw new Error('Unsupported export format');
      }

      if (conversationId != null) {
        analyticsService.trackDocumentExport(conversationId, exportFormat, 'research_report', {
          conversation_id: conversationId,
          export_scope: exportScope.mode,
          turn_index: exportScope.mode === 'turn' ? exportScope.turnIndex : null,
          section_count: payload.sectionCount,
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToDocx = async ({ title, markdown, fileName }) => {
    const reportTitle = title || 'Research';
    const children = [
      new Paragraph({
        text: reportTitle,
        heading: HeadingLevel.TITLE,
      }),
      new Paragraph({
        text: `Generated on: ${new Date().toLocaleDateString()}`,
      }),
      new Paragraph({ text: '' }),
    ];

    String(markdown || '')
      .split('\n')
      .forEach((line) => {
        if (/^##\s/.test(line)) {
          children.push(
            new Paragraph({
              text: line.replace(/^##\s+/, '').trim(),
              heading: HeadingLevel.HEADING_1,
            }),
          );
        } else if (/^###\s/.test(line)) {
          children.push(
            new Paragraph({
              text: line.replace(/^###\s+/, '').trim(),
              heading: HeadingLevel.HEADING_2,
            }),
          );
        } else {
          children.push(new Paragraph({ text: line.length ? line : ' ' }));
        }
      });

    const doc = new Document({
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base =
      (fileName || reportTitle)
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

  const scopeOptions = [
    ...turns.map((turn) => {
      const { menuLabel, subtitle } = getTurnExportLabel(turn, { conversationType });
      return {
        mode: 'turn',
        turnIndex: turn.turnIndex,
        key: `turn-${turn.turnIndex}`,
        label: menuLabel,
        subtitle,
      };
    }),
    ...(turns.length > 1
      ? [
          {
            mode: 'all',
            key: 'all',
            label: 'All research (1 PDF)',
            subtitle: `${turns.length} sections combined`,
          },
        ]
      : []),
  ];

  const isScopeSelected = (opt) => {
    if (opt.mode === 'all') return exportScope.mode === 'all';
    return exportScope.mode === 'turn' && exportScope.turnIndex === opt.turnIndex;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Export Research</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* What to export */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              What to export
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {scopeOptions.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-start p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    isScopeSelected(opt)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportScope"
                    checked={isScopeSelected(opt)}
                    onChange={() =>
                      setExportScope(
                        opt.mode === 'all'
                          ? { mode: 'all' }
                          : { mode: 'turn', turnIndex: opt.turnIndex },
                      )
                    }
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-3 min-w-0">
                    <span className="block text-sm font-medium text-gray-900 truncate">
                      {opt.label}
                    </span>
                    {opt.subtitle && (
                      <span className="block text-xs text-gray-500 truncate mt-0.5">
                        {opt.subtitle}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
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
                  type="button"
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
              <div>• Format: {exportFormats.find((f) => f.id === exportFormat)?.name}</div>
              <div>• Content: {payload.scopeLabel}</div>
              <div>• Sections: {payload.sectionCount}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || !turns.length}
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
