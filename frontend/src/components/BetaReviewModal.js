import React, { useState } from 'react';

const BetaReviewModal = ({ isOpen, onClose, onSubmit }) => {
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!review.trim()) return;

    setIsSubmitting(true);
    setError('');
    try {
      await onSubmit({ review: review.trim(), rating: rating || null });
      onClose();
    } catch (error) {
      console.error('Failed to submit review:', error);
      setError(error.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStarClick = (starRating) => {
    setRating(starRating);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div 
        className="relative max-w-lg w-full mx-4 rounded-2xl shadow-xl"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line-strong)',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', letterSpacing: '.18em', marginBottom: 16 }}>
              BETA FEEDBACK
            </div>
            <h2 
              className="serif mb-3"
              style={{ 
                color: 'var(--fg)',
                fontSize: 'clamp(28px, 4vw, 42px)',
                lineHeight: 1.1,
                letterSpacing: '-.015em',
                fontWeight: 400
              }}
            >
              Thank you for using Deep<span style={{ fontStyle: 'italic', color: 'var(--sun)' }}>Research!</span>
            </h2>
            <p style={{ 
              color: 'var(--mut)', 
              lineHeight: 1.55,
              fontSize: 15,
              fontFamily: 'Geist, sans-serif'
            }}>
              You've completed our beta program. Help us build something amazing by sharing your thoughts.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Rating */}
            <div className="mb-8">
              <label 
                className="block mono mb-4"
                style={{ 
                  color: 'var(--fg)',
                  fontSize: 12,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  fontWeight: 500
                }}
              >
                Rate your experience (optional)
              </label>
              <div className="flex justify-center space-x-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleStarClick(star)}
                    className="text-3xl transition-all duration-200 transform hover:scale-110"
                    style={{
                      color: star <= rating ? 'var(--violet)' : 'var(--mut2)',
                      textShadow: star <= rating ? '0 0 20px rgba(124, 92, 255, 0.4)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Review Text */}
            <div className="mb-8">
              <label 
                htmlFor="review" 
                className="block mono mb-4"
                style={{ 
                  color: 'var(--fg)',
                  fontSize: 12,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  fontWeight: 500
                }}
              >
                What can we do better?
              </label>
              <textarea
                id="review"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Share your thoughts on what worked well, what didn't, and what features you'd like to see..."
                rows={5}
                className="w-full p-4 rounded-lg resize-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-2)',
                  border: '2px solid var(--line)',
                  color: 'var(--fg)',
                  fontSize: '15px',
                  lineHeight: '1.55',
                  fontFamily: 'Geist, sans-serif',
                  outline: 'none'
                }}
                maxLength={2000}
                required
                onFocus={(e) => e.target.style.borderColor = 'var(--violet)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--line)'}
              />
              <div 
                className="mono text-right mt-3"
                style={{ 
                  color: 'var(--mut2)',
                  fontSize: 11,
                  letterSpacing: '.04em'
                }}
              >
                {review.length}/2000 characters
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div 
                className="mb-6 p-4 rounded-lg"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444'
                }}
              >
                <div className="mono" style={{ fontSize: 12, letterSpacing: '.04em' }}>
                  {error}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 rounded-lg transition-all duration-200"
                style={{
                  background: 'transparent',
                  border: '2px solid var(--line)',
                  color: 'var(--mut)',
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 600,
                  fontSize: 15,
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = 'var(--mut)';
                  e.target.style.color = 'var(--fg)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = 'var(--line)';
                  e.target.style.color = 'var(--mut)';
                }}
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={!review.trim() || isSubmitting}
                className="flex-1 py-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--violet)',
                  color: 'white',
                  border: 'none',
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 600,
                  fontSize: 15,
                  boxShadow: '0 4px 16px rgba(124, 92, 255, 0.3)',
                }}
                onMouseEnter={(e) => {
                  if (!e.target.disabled) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 8px 24px rgba(124, 92, 255, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.target.disabled) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 16px rgba(124, 92, 255, 0.3)';
                  }
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BetaReviewModal;