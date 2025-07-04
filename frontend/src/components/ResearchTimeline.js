import React, { useState, useRef, useEffect } from 'react';

const ResearchTimeline = ({ 
  messages, 
  activeNodeIndex, 
  onNodeSelect, 
  onAddFollowup,
  exportSelections,
  onExportToggle 
}) => {

  const [showAddModal, setShowAddModal] = useState(false);
  const [followUpQuery, setFollowUpQuery] = useState('');
  const timelineRef = useRef(null);

  // Parse messages into timeline nodes
  const parseTimelineNodes = () => {
    const nodes = [];
    const userMessages = messages.filter(m => m.role === 'user');
    
    // Only take first 5 messages (original + 4 follow-ups)
    userMessages.slice(0, 5).forEach((msg, index) => {
      const title = generateNodeTitle(msg.content, index);
      const hasReport = messages.find(m => 
        m.role === 'assistant' && 
        messages.indexOf(m) > messages.indexOf(msg)
      );
      
      nodes.push({
        id: index,
        title,
        query: msg.content,
        type: index === 0 ? 'original' : 'followup',
        hasReport: !!hasReport,
        isActive: index === activeNodeIndex,
        isSelected: exportSelections?.includes(index) || false
      });
    });
    
    return nodes;
  };

  const generateNodeTitle = (query, index) => {
    if (index === 0) return 'Original Research';
    return `Follow-up ${index}`;
  };

  const getNodeColor = (node, index) => {
    if (node.isActive) return 'bg-blue-600 text-white shadow-lg';
    if (node.type === 'original') return 'bg-gray-50 text-gray-900 hover:bg-gray-100';
    return 'bg-gray-50 text-gray-700 hover:bg-gray-100';
  };

  const getNodeIcon = (node, index) => {
    // Clean, professional numbering system
    if (index === 0) return '1';
    return (index + 1).toString();
  };

  useEffect(() => {
    if (timelineRef.current && activeNodeIndex !== null) {
      const activeNode = timelineRef.current.querySelector(`[data-node-id="${activeNodeIndex}"]`);
      if (activeNode) {
        activeNode.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'center' 
        });
      }
    }
  }, [activeNodeIndex]);

  const nodes = parseTimelineNodes();
  const canAddFollowUp = nodes.length < 5; // Limit to 4 follow-ups

  return (
    <div className="flex items-center justify-end">
      <div 
        ref={timelineRef}
        className="flex items-center space-x-1 overflow-x-auto scrollbar-hide"
      >
          {nodes.map((node, index) => (
            <div key={node.id} className="flex items-center flex-shrink-0">
              {/* Timeline Node */}
              <button
                data-node-id={node.id}
                className={`
                  px-3 py-1.5 rounded-full font-medium text-xs transition-all duration-200
                  ${getNodeColor(node, index)}
                  ${node.isActive ? 'ring-2 ring-blue-200' : 'border border-gray-200 hover:border-gray-300'}
                  flex items-center space-x-2
                `}
                onClick={() => onNodeSelect(index)}
              >
                <span className={`
                  w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                  ${node.isActive 
                    ? 'bg-white text-blue-600' 
                    : 'bg-gray-100 text-gray-600'
                  }
                `}>
                  {getNodeIcon(node, index)}
                </span>
                <span className="whitespace-nowrap">{node.title}</span>
                
                {/* Export Checkbox */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onExportToggle(index);
                  }}
                  className={`
                    ml-1 w-3 h-3 rounded border flex items-center justify-center text-xs
                    ${node.isSelected 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : 'bg-white border-gray-300 hover:border-green-400'
                    }
                  `}
                  title="Include in export"
                >
                  {node.isSelected && '✓'}
                </div>
              </button>

              {/* Arrow Connector */}
              {index < nodes.length - 1 && (
                <div className="flex-shrink-0 mx-1">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}

          {/* Add Follow-up Button */}
          {canAddFollowUp && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 rounded-full border border-gray-300 hover:border-gray-400"
            >
              <span>➕</span>
              <span className="whitespace-nowrap">Add Follow-up</span>
            </button>
          )}
        </div>

        {/* Add Follow-up Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 max-w-md">
              <h3 className="text-lg font-semibold mb-4">Add Follow-up Research</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (followUpQuery.trim()) {
                  onAddFollowup(followUpQuery.trim());
                  setFollowUpQuery('');
                  setShowAddModal(false);
                }
              }}>
                <textarea
                  value={followUpQuery}
                  onChange={(e) => setFollowUpQuery(e.target.value)}
                  placeholder="Enter your follow-up research question..."
                  className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setFollowUpQuery('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    disabled={!followUpQuery.trim()}
                  >
                    Add Research
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
};

export default ResearchTimeline; 