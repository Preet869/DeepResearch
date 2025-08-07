// Configuration for API endpoints
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

export const config = {
  API_BASE_URL,
  endpoints: {
    research: `${API_BASE_URL}/research`,
    messages: (conversationId) => `${API_BASE_URL}/messages/${conversationId}`,
    conversations: `${API_BASE_URL}/conversations`,
    folders: `${API_BASE_URL}/folders`,
    compareArticles: `${API_BASE_URL}/compare-articles`,
  }
};
