import React, { useState } from 'react';

const ExportManager = ({ messages, conversationTitle, exportSelections, onClose }) => {
  const [exportFormat, setExportFormat] = useState('pdf');
  const [includeSources, setIncludeSources] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const exportFormats = [
    { id: 'pdf', name: 'PDF Document', icon: '📄' },
    { id: 'markdown', name: 'Markdown', icon: '📝' },
    { id: 'json', name: 'JSON Data', icon: '🔧' },
    { id: 'docx', name: 'Word Document', icon: '📘' }
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
        case 'markdown':
          await exportToMarkdown(exportData);
          break;
        case 'json':
          await exportToJSON(exportData);
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
    // For now, we'll create a simple text-based PDF using jsPDF
    // In production, you'd want to use a more sophisticated PDF library
    const content = formatContentForPDF(data);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToMarkdown = async (data) => {
    const content = formatContentForMarkdown(data);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToJSON = async (data) => {
    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToDocx = async (data) => {
    // For now, we'll export as a simple text file
    // In production, you'd want to use a library like docx
    const content = formatContentForDocx(data);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatContentForPDF = (data) => {
    let content = `Research Report: ${data.title}\n`;
    content += `Generated on: ${new Date().toLocaleDateString()}\n\n`;
    
    data.messages.forEach((message, index) => {
      content += `=== ${message.role.toUpperCase()} MESSAGE ${index + 1} ===\n`;
      content += `${message.content}\n\n`;
    });
    
    return content;
  };

  const formatContentForMarkdown = (data) => {
    let content = `# Research Report: ${data.title}\n\n`;
    content += `**Generated on:** ${new Date().toLocaleDateString()}\n\n`;
    
    data.messages.forEach((message, index) => {
      content += `## ${message.role.charAt(0).toUpperCase() + message.role.slice(1)} Message ${index + 1}\n\n`;
      content += `${message.content}\n\n`;
    });
    
    return content;
  };

  const formatContentForDocx = (data) => {
    let content = `Research Report: ${data.title}\n`;
    content += `Generated on: ${new Date().toLocaleDateString()}\n\n`;
    
    data.messages.forEach((message, index) => {
      content += `${message.role.toUpperCase()} MESSAGE ${index + 1}:\n`;
      content += `${message.content}\n\n`;
    });
    
    return content;
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