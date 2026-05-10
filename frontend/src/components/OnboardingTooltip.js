import React, { useState, useEffect, useRef } from 'react';

/**
 * OnboardingTooltip - A dismissible tooltip that appears for first-time users
 * 
 * @param {boolean} show - Whether to show the tooltip
 * @param {React.RefObject} targetRef - Reference to the element the tooltip should point to
 * @param {function} onDismiss - Callback when tooltip is dismissed
 */
const OnboardingTooltip = ({ show, targetRef, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (show && targetRef.current) {
      // Calculate position relative to the target element
      const updatePosition = () => {
        if (targetRef.current && tooltipRef.current) {
          const targetRect = targetRef.current.getBoundingClientRect();
          const tooltipRect = tooltipRef.current.getBoundingClientRect();
          
          // Position the tooltip above the target element with some spacing
          const top = targetRect.top - tooltipRect.height - 20;
          const left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
          
          // Ensure tooltip stays within viewport
          const viewportWidth = window.innerWidth;
          const adjustedLeft = Math.max(20, Math.min(left, viewportWidth - tooltipRect.width - 20));
          
          setPosition({ 
            top: Math.max(20, top), 
            left: adjustedLeft 
          });
        }
      };

      // Show tooltip with a slight delay for smooth appearance
      const timer = setTimeout(() => {
        setIsVisible(true);
        updatePosition();
      }, 500);

      // Update position on resize
      window.addEventListener('resize', updatePosition);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updatePosition);
      };
    } else {
      setIsVisible(false);
    }
  }, [show, targetRef]);

  const handleDismiss = () => {
    setIsVisible(false);
    // Add slight delay before calling onDismiss for smooth animation
    setTimeout(() => {
      localStorage.setItem('hasSeenResearchTooltip', 'true');
      onDismiss();
    }, 200);
  };

  if (!show || !isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-20 z-40 animate-fadeIn"
        onClick={handleDismiss}
        style={{
          animation: 'tooltipFadeIn 0.3s ease-out'
        }}
      />
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 max-w-sm"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          animation: 'tooltipSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div 
          className="relative p-6 rounded-2xl shadow-2xl"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line-strong)',
            boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.15), 0 8px 24px -8px rgba(124, 92, 255, 0.2)'
          }}
        >
          {/* Arrow pointing down to the input */}
          <div 
            className="absolute top-full left-1/2 transform -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: '12px solid transparent',
              borderRight: '12px solid transparent',
              borderTop: '12px solid var(--card)',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
            }}
          />
          
          {/* Content */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 
                  className="font-semibold text-lg flex items-center gap-2"
                  style={{ color: 'var(--fg)' }}
                >
                  <span className="text-xl">💡</span>
                  How to use DeepResearch
                </h3>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: 'var(--mut2)' }}
                aria-label="Close tooltip"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'var(--violet)' }}
                >
                  1
                </div>
                <span className="text-sm" style={{ color: 'var(--fg)' }}>
                  Ask a specific research question
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'var(--violet)' }}
                >
                  2
                </div>
                <span className="text-sm" style={{ color: 'var(--fg)' }}>
                  Get a report with real sources
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'var(--violet)' }}
                >
                  3
                </div>
                <span className="text-sm" style={{ color: 'var(--fg)' }}>
                  Ask follow-ups to go deeper
                </span>
              </div>
            </div>

            <div 
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' }}
                  />
                  <span 
                    className="text-xs font-medium"
                    style={{ color: 'var(--fg)' }}
                  >
                    Example:
                  </span>
                  <span 
                    className="text-xs italic"
                    style={{ color: 'var(--mut)' }}
                  >
                    "How does carbon pricing affect emissions?"
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'var(--hot)', boxShadow: '0 0 8px var(--hot)' }}
                  />
                  <span 
                    className="text-xs font-medium"
                    style={{ color: 'var(--fg)' }}
                  >
                    Not:
                  </span>
                  <span 
                    className="text-xs italic"
                    style={{ color: 'var(--mut)' }}
                  >
                    *paste entire essay prompt*
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full py-3 px-4 rounded-xl font-medium transition-all hover:transform hover:scale-105"
              style={{
                background: 'var(--violet)',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>

      {/* Add animations */}
      <style>{`
        @keyframes tooltipFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes tooltipSlideUp {
          from { 
            opacity: 0; 
            transform: translateY(20px) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
      `}</style>
    </>
  );
};

export default OnboardingTooltip;