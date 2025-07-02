# Phase 1 Implementation Guide: Enhanced Research Display

## Overview
This guide walks through implementing the 5 core Phase 1 features for the DeepResearch enhanced display system.

## 1. Section Navigator with Reading Time

### Component Structure
```jsx
const SectionNavigator = ({ sections, activeSection, onSectionClick }) => {
  return (
    <div className="sticky top-20 space-y-2">
      <h3 className="font-semibold text-gray-900 mb-3">Contents</h3>
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => onSectionClick(section.id)}
          className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
            activeSection === section.id
              ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
              : 'hover:bg-gray-50 text-gray-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center">
              <span className="mr-2">{section.icon}</span>
              <span className="text-sm font-medium">{section.title}</span>
            </span>
            <span className="text-xs text-gray-500">{section.readingTime} min</span>
          </div>
        </button>
      ))}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          Total reading time: {totalReadingTime} min
        </div>
      </div>
    </div>
  );
};
```

### Implementation Steps:
1. Parse sections with reading time calculation
2. Track active section based on scroll position
3. Smooth scroll to section on click
4. Update active indicator as user scrolls

## 2. Progressive Disclosure System

### Three-Layer Architecture
```jsx
// Layer 1: Executive Summary Card (Always Visible)
const ExecutiveSummaryCard = ({ summary, onExpandClick }) => (
  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
      <span className="mr-2">✨</span>
      Executive Summary
    </h2>
    <div className="space-y-3">
      {summary.map((point, index) => (
        <div key={index} className="flex items-start">
          <span className="text-blue-600 mr-2">•</span>
          <p className="text-gray-700">{point}</p>
        </div>
      ))}
    </div>
    <button
      onClick={onExpandClick}
      className="mt-4 text-blue-600 hover:text-blue-700 font-medium inline-flex items-center"
    >
      Read Full Report
      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  </div>
);

// Layer 2: Section Previews
const SectionPreview = ({ section, isExpanded, onToggle }) => (
  <div className="border border-gray-200 rounded-lg overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
    >
      <div className="flex items-center">
        <span className="text-xl mr-3">{section.icon}</span>
        <div className="text-left">
          <h3 className="font-semibold text-gray-900">{section.title}</h3>
          <p className="text-sm text-gray-600">{section.preview}</p>
        </div>
      </div>
      <svg
        className={`w-5 h-5 text-gray-400 transform transition-transform ${
          isExpanded ? 'rotate-180' : ''
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {isExpanded && (
      <div className="px-6 py-4 bg-white">
        <div className="prose prose-lg max-w-none">
          {section.content}
        </div>
      </div>
    )}
  </div>
);
```

## 3. Reading Mode Selector

### Mode Configuration
```jsx
const readingModes = {
  scan: {
    icon: '📱',
    name: 'Scan Mode',
    description: 'Key points only',
    sections: ['executive', 'keyFindings', 'conclusions']
  },
  study: {
    icon: '📖',
    name: 'Study Mode',
    description: 'Full academic text',
    sections: 'all'
  },
  action: {
    icon: '🎯',
    name: 'Action Mode',
    description: 'Conclusions & recommendations',
    sections: ['conclusions', 'recommendations', 'nextSteps']
  },
  research: {
    icon: '🔬',
    name: 'Research Mode',
    description: 'Methodology & data',
    sections: ['methodology', 'data', 'statistics', 'references']
  }
};

const ReadingModeSelector = ({ currentMode, onModeChange }) => (
  <div className="flex space-x-2 p-1 bg-gray-100 rounded-lg">
    {Object.entries(readingModes).map(([mode, config]) => (
      <button
        key={mode}
        onClick={() => onModeChange(mode)}
        className={`flex items-center px-4 py-2 rounded-md transition-all ${
          currentMode === mode
            ? 'bg-white shadow-sm text-blue-600'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <span className="mr-2">{config.icon}</span>
        <span className="font-medium">{config.name}</span>
      </button>
    ))}
  </div>
);
```

## 4. Smart Citations with Hover Preview

### Citation Component
```jsx
const SmartCitation = ({ citation, sourceData }) => {
  const [showPreview, setShowPreview] = useState(false);
  
  return (
    <span className="relative inline-block">
      <button
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
        className="text-blue-600 hover:text-blue-700 underline decoration-dotted cursor-help"
      >
        [{citation.number}]
      </button>
      
      {showPreview && (
        <div className="absolute bottom-full left-0 mb-2 w-80 p-4 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <h4 className="font-semibold text-gray-900">{sourceData.title}</h4>
              <span className={`px-2 py-1 text-xs rounded-full ${
                sourceData.type === 'peer-reviewed' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {sourceData.type}
              </span>
            </div>
            <p className="text-sm text-gray-600">{sourceData.authors} ({sourceData.year})</p>
            <p className="text-sm text-gray-700">{sourceData.preview}</p>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-gray-500">
                Quality Score: {sourceData.qualityScore}/10
              </span>
              <a
                href={sourceData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                View Source →
              </a>
            </div>
          </div>
        </div>
      )}
    </span>
  );
};
```

## 5. Visual Quality & Confidence Indicators

### Confidence Score Component
```jsx
const ConfidenceIndicator = ({ score, factors, expanded, onToggle }) => {
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getScoreColor(score)}`}>
            <span className="text-2xl font-bold">{score}</span>
          </div>
          <div className="ml-4">
            <h3 className="font-semibold text-gray-900">Confidence Score</h3>
            <p className="text-sm text-gray-600">Based on source quality & consensus</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transform transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <FactorBar label="Source Diversity" value={factors.sourceDiversity} max={10} />
          <FactorBar label="Data Recency" value={factors.dataRecency} max={100} />
          <FactorBar label="Peer Review %" value={factors.peerReviewPercentage} max={100} />
          <FactorBar label="Consensus Level" value={factors.consensusLevel} max={100} />
        </div>
      )}
    </div>
  );
};

const FactorBar = ({ label, value, max }) => (
  <div>
    <div className="flex justify-between text-sm mb-1">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}/{max}</span>
    </div>
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-600 transition-all duration-500"
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  </div>
);
```

## Integration Example

```jsx
const EnhancedResearchDisplay = ({ messages }) => {
  const [readingMode, setReadingMode] = useState('scan');
  const [activeSection, setActiveSection] = useState(null);
  const [showFullReport, setShowFullReport] = useState(false);
  const [confidenceExpanded, setConfidenceExpanded] = useState(false);

  // Parse and prepare data
  const sections = parseEnhancedSections(mainReport.content);
  const confidenceScore = calculateConfidenceScore(mainReport.metadata);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Reading Mode Selector */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
        <ReadingModeSelector
          currentMode={readingMode}
          onModeChange={setReadingMode}
        />
      </div>

      <div className="grid grid-cols-12 gap-8 max-w-7xl mx-auto px-6 py-8">
        {/* Section Navigator */}
        <div className="col-span-3">
          <SectionNavigator
            sections={sections}
            activeSection={activeSection}
            onSectionClick={scrollToSection}
          />
        </div>

        {/* Main Content */}
        <div className="col-span-6">
          {/* Executive Summary */}
          <ExecutiveSummaryCard
            summary={sections.executiveSummary}
            onExpandClick={() => setShowFullReport(true)}
          />

          {/* Progressive Sections */}
          {showFullReport && (
            <div className="mt-8 space-y-6">
              {filterSectionsByMode(sections, readingMode).map(section => (
                <SectionPreview
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections[section.id]}
                  onToggle={() => toggleSection(section.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quality Indicators Sidebar */}
        <div className="col-span-3">
          <ConfidenceIndicator
            score={confidenceScore}
            factors={confidenceFactors}
            expanded={confidenceExpanded}
            onToggle={() => setConfidenceExpanded(!confidenceExpanded)}
          />
        </div>
      </div>
    </div>
  );
};
```

## CSS Additions Needed

```css
/* Smooth scrolling for section navigation */
html {
  scroll-behavior: smooth;
}

/* Progress indicator for section navigator */
.section-progress {
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  background: linear-gradient(to bottom, #3b82f6, #6366f1);
  transition: height 0.3s ease;
}

/* Citation hover effects */
.citation-preview {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## Next Steps

1. Implement scroll tracking for section navigator
2. Add keyboard shortcuts for reading modes (1-4 keys)
3. Persist user's reading mode preference
4. Add animation transitions between modes
5. Implement citation caching for performance

This completes the Phase 1 implementation guide! 