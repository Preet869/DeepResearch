import { apiFetch, AUTH_REQUIRED } from '../apiClient';
import analyticsService from '../services/analyticsService';
import { config } from '../config';

export const handleBetaReviewSubmit = async (reviewData) => {
  try {
    console.log('Submitting beta review:', reviewData);
    
    const response = await apiFetch(`${config.API_BASE_URL}/beta-review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reviewData),
    }, AUTH_REQUIRED);

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Beta review submitted successfully:', result);
      analyticsService.track('beta_review_submitted', {
        rating: reviewData.rating,
        review_length: reviewData.review.length,
      });
      
      // Clear the localStorage flag after successful submission
      localStorage.removeItem('deepresearch_show_beta_review');
    } else {
      let errorMessage = 'Failed to submit review';
      try {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        
        // Provide helpful error messages
        if (response.status === 404 || (errorData.detail && errorData.detail.includes('does not exist'))) {
          errorMessage = 'Beta review system is not yet set up. Please contact support.';
        } else if (response.status === 400 && errorData.detail) {
          errorMessage = errorData.detail;
        } else {
          errorMessage = errorData.detail || 'Failed to submit review';
        }
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Error submitting beta review:', error);
    throw error;
  }
};

export const shouldShowBetaReview = () => {
  return localStorage.getItem('deepresearch_show_beta_review') === 'true';
};

export const clearBetaReviewFlag = () => {
  localStorage.removeItem('deepresearch_show_beta_review');
};