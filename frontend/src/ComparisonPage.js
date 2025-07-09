import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import Header from './Header';

const ComparisonPage = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [inputMethod, setInputMethod] = useState('url'); // 'url' or 'text'
  const [comparisonFocus, setComparisonFocus] = useState('overall');
  
  // Article 1 data
  const [article1Url, setArticle1Url] = useState('');
  const [article1Text, setArticle1Text] = useState('');
  const [article1Title, setArticle1Title] = useState('');
  
  // Article 2 data
  const [article2Url, setArticle2Url] = useState('');
  const [article2Text, setArticle2Text] = useState('');
  const [article2Title, setArticle2Title] = useState('');
  
  // Context field for targeted analysis
  const [context, setContext] = useState('');
  
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (inputMethod === 'url') {
      if (!article1Url.trim() || !article2Url.trim()) {
        setError('Please provide URLs for both articles');
        return;
      }
    } else {
      if (!article1Text.trim() || !article2Text.trim()) {
        setError('Please provide text for both articles');
        return;
      }
    }

    setLoading(true);

    try {
      const requestBody = {
        comparison_focus: comparisonFocus,
        context: context.trim() || null,
        ...(inputMethod === 'url' ? {
          article1_url: article1Url.trim(),
          article2_url: article2Url.trim()
        } : {
          article1_text: article1Text.trim(),
          article1_title: article1Title.trim() || 'Article 1',
          article2_text: article2Text.trim(),
          article2_title: article2Title.trim() || 'Article 2'
        })
      };

      const response = await fetch('http://127.0.0.1:8000/compare-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        // Navigate to the research page with the comparison conversation
        navigate(`/research?convo_id=${data.conversation_id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to compare articles');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to compare articles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBackToDashboard = () => {
    navigate('/dashboard');
  };

  const comparisonFocusOptions = [
    { value: 'overall', label: 'Overall Comparison', description: 'Comprehensive analysis of all aspects' },
    { value: 'methodology', label: 'Methodology Focus', description: 'Compare research methods and approaches' },
    { value: 'findings', label: 'Findings Focus', description: 'Compare key findings and conclusions' }
  ];

  const exampleComparisons = [
    {
      title: "Climate Change Studies",
      article1: "https://example.com/climate-study-1",
      article2: "https://example.com/climate-study-2",
      focus: "methodology"
    },
    {
      title: "AI Healthcare Applications",
      article1: "https://example.com/ai-healthcare-1",
      article2: "https://example.com/ai-healthcare-2",
      focus: "findings"
    },
    {
      title: "Remote Work Productivity",
      article1: "https://example.com/remote-work-1",
      article2: "https://example.com/remote-work-2",
      focus: "overall"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={goBackToDashboard}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors mr-4"
              title="Back to Dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Smart Article Comparison</h1>
              <p className="text-gray-600 mt-1">Get AI-powered academic analysis tailored for students and researchers</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Input Method Selection */}
                <div>
                  <label className="text-base font-medium text-gray-900 block mb-4">
                    How would you like to provide the articles?
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setInputMethod('url')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        inputMethod === 'url'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-center mb-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <div className="font-medium">URLs</div>
                      <div className="text-sm text-gray-600">Provide article URLs</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMethod('text')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        inputMethod === 'text'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-center mb-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="font-medium">Text</div>
                      <div className="text-sm text-gray-600">Paste article text</div>
                    </button>
                  </div>
                </div>

                {/* Article Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Article 1 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                      <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">1</span>
                      First Article
                    </h3>
                    
                    {inputMethod === 'url' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Article URL
                        </label>
                        <input
                          type="url"
                          value={article1Url}
                          onChange={(e) => setArticle1Url(e.target.value)}
                          placeholder="https://example.com/article1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Article Title (Optional)
                          </label>
                          <input
                            type="text"
                            value={article1Title}
                            onChange={(e) => setArticle1Title(e.target.value)}
                            placeholder="Article 1 Title"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Article Text
                          </label>
                          <textarea
                            value={article1Text}
                            onChange={(e) => setArticle1Text(e.target.value)}
                            placeholder="Paste the full text of the first article here..."
                            rows={8}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Article 2 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                      <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
                      Second Article
                    </h3>
                    
                    {inputMethod === 'url' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Article URL
                        </label>
                        <input
                          type="url"
                          value={article2Url}
                          onChange={(e) => setArticle2Url(e.target.value)}
                          placeholder="https://example.com/article2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Article Title (Optional)
                          </label>
                          <input
                            type="text"
                            value={article2Title}
                            onChange={(e) => setArticle2Title(e.target.value)}
                            placeholder="Article 2 Title"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Article Text
                          </label>
                          <textarea
                            value={article2Text}
                            onChange={(e) => setArticle2Text(e.target.value)}
                            placeholder="Paste the full text of the second article here..."
                            rows={8}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Comparison Focus */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Comparison Focus
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {comparisonFocusOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setComparisonFocus(option.value)}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                          comparisonFocus === option.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{option.label}</div>
                        <div className="text-sm text-gray-600 mt-1">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Context Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center">
                      <span className="mr-2">🎯</span>
                      Context (Optional but Recommended)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder='e.g., "Topic: climate justice" or "Assignment: compare discourse analysis methods"'
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Adding context helps generate more targeted and relevant analysis for your specific needs
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Topic: climate change', 'Assignment: methodology comparison', 'Course: Environmental Policy', 'Focus: practical applications'].map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setContext(example)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                      <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Generating Smart Analysis...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Get Smart Analysis
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* How it Works */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">🎓</span>
                Perfect for Students
              </h3>
              <div className="space-y-3">
                <div className="flex items-start">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</span>
                  <div>
                    <p className="text-sm text-gray-700"><strong>Add Context:</strong> Tell us your assignment topic or course focus</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</span>
                  <div>
                    <p className="text-sm text-gray-700"><strong>Compare Articles:</strong> URLs or paste text directly</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</span>
                  <div>
                    <p className="text-sm text-gray-700"><strong>Get Smart Analysis:</strong> Tables, insights, and essay help</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Success Tips */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">💡</span>
                Pro Tips for Students
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-medium text-blue-900 text-sm">📚 Literature Reviews</div>
                  <div className="text-xs text-blue-700 mt-1">
                    Use context: "Assignment: literature review on climate policy"
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-medium text-green-900 text-sm">🔬 Methodology Papers</div>
                  <div className="text-xs text-green-700 mt-1">
                    Use context: "Course: Research Methods - comparing approaches"
                  </div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="font-medium text-purple-900 text-sm">📝 Essay Writing</div>
                  <div className="text-xs text-purple-700 mt-1">
                    Use context: "Topic: social media impact on democracy"
                  </div>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">✨</span>
                What You'll Get
              </h3>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Side-by-side analysis
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Methodology comparison
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Findings alignment
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Data visualizations
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Synthesis insights
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonPage; 