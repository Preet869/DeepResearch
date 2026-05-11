import { supabase } from '../supabaseClient';

class AnalyticsService {
  constructor() {
    this.isEnabled = false; // Temporarily disable analytics
    this.sessionStartTime = Date.now();
    this.currentPageStartTime = Date.now();
    this.currentPage = null;
    this.batchQueue = [];
    this.batchTimer = null;
    this.BATCH_DELAY = 2000; // Send events every 2 seconds
    this.MAX_BATCH_SIZE = 10; // Max events per batch
    this.rlsErrorLogged = false; // Track if we've already logged RLS error
    
    // Initialize session tracking
    this.initSession();
  }

  // Initialize session and page tracking
  initSession() {
    // Track session start
    this.track('session_started', {
      user_agent: navigator.userAgent,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      referrer: document.referrer
    });

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.track('page_hidden', {
          page: this.currentPage,
          time_visible: Date.now() - this.currentPageStartTime
        });
      } else {
        this.track('page_visible', {
          page: this.currentPage
        });
        this.currentPageStartTime = Date.now();
      }
    });

    // Track window close/unload
    window.addEventListener('beforeunload', () => {
      this.track('session_ended', {
        session_duration: Date.now() - this.sessionStartTime,
        total_pages_visited: this.getSessionData().pagesVisited || 1
      });
      this.flushBatch(true); // Force immediate send
    });
  }

  // Core tracking method
  async track(eventType, eventData = {}, options = {}) {
    if (!this.isEnabled) return;

    const event = {
      event_type: eventType,
      event_data: {
        ...eventData,
        timestamp: new Date().toISOString(),
        page_url: window.location.href,
        page_path: window.location.pathname,
        session_id: this.getSessionId(),
        user_agent: navigator.userAgent
      }
    };

    // Add user ID if available
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          event.user_id = user.id;
        }
      } catch (error) {
        console.debug('Could not get user for analytics:', error);
      }
    }

    // Queue for batch processing or send immediately
    if (options.immediate) {
      await this.sendEvent(event);
    } else {
      this.addToBatch(event);
    }
  }

  // Batch processing
  addToBatch(event) {
    this.batchQueue.push(event);
    
    if (this.batchQueue.length >= this.MAX_BATCH_SIZE) {
      this.flushBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.BATCH_DELAY);
    }
  }

  async flushBatch(force = false) {
    if (this.batchQueue.length === 0) return;
    
    const events = [...this.batchQueue];
    this.batchQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      if (supabase) {
        const { error } = await supabase
          .from('usage_events')
          .insert(events);
        
        if (error) {
          // Only log RLS errors once to avoid spam
          if (error.code === '42501' && !this.rlsErrorLogged) {
            console.warn('Analytics disabled: Row Level Security policy blocks usage_events insertion');
            this.rlsErrorLogged = true;
            this.isEnabled = false; // Auto-disable on RLS errors
          } else if (error.code !== '42501') {
            console.error('Analytics batch insert failed:', error);
          }
          
          // Don't re-queue on RLS errors
          if (!force && error.code !== '42501') {
            this.batchQueue.unshift(...events);
          }
        }
      }
    } catch (error) {
      console.error('Analytics service error:', error);
      if (!force) {
        this.batchQueue.unshift(...events);
      }
    }
  }

  // Send single event immediately
  async sendEvent(event) {
    if (!supabase) return;
    
    try {
      const { error } = await supabase
        .from('usage_events')
        .insert([event]);
      
      if (error) {
        console.error('Analytics event send failed:', error);
      }
    } catch (error) {
      console.error('Analytics service error:', error);
    }
  }

  // Specific tracking methods for common events

  // Research and search tracking
  trackSearch(query, filters = {}, searchMethod = 'basic') {
    this.track('search_initiated', {
      query,
      query_length: query.length,
      query_word_count: query.split(' ').length,
      filters,
      search_method: searchMethod,
      has_filters: Object.keys(filters).length > 0
    });
  }

  trackSearchResults(query, resultsCount, processingTime, sources = []) {
    this.track('search_completed', {
      query,
      results_count: resultsCount,
      processing_time_ms: processingTime,
      sources_count: sources.length,
      source_types: sources.map(s => s.type),
      has_results: resultsCount > 0
    });
  }

  trackResearchStart(conversationId, initialQuery, folderId = null) {
    this.track('research_started', {
      conversation_id: conversationId,
      initial_query: initialQuery,
      query_length: initialQuery.length,
      folder_id: folderId,
      has_folder: !!folderId
    });
  }

  trackResearchCompleted(conversationId, duration, messageCount, exportActions = []) {
    this.track('research_completed', {
      conversation_id: conversationId,
      duration_ms: duration,
      message_count: messageCount,
      export_actions: exportActions,
      total_exports: exportActions.length
    });
  }

  // User interaction tracking
  trackPageView(pageName, metadata = {}) {
    // Track page exit time if we have a current page
    if (this.currentPage) {
      this.track('page_exit', {
        page: this.currentPage,
        time_on_page: Date.now() - this.currentPageStartTime
      });
    }

    this.currentPage = pageName;
    this.currentPageStartTime = Date.now();
    
    this.track('page_view', {
      page: pageName,
      ...metadata
    });

    // Update session data
    const sessionData = this.getSessionData();
    sessionData.pagesVisited = (sessionData.pagesVisited || 0) + 1;
    this.setSessionData(sessionData);
  }

  trackButtonClick(buttonName, location, metadata = {}) {
    this.track('button_click', {
      button_name: buttonName,
      location,
      ...metadata
    });
  }

  trackFeatureUsage(featureName, action, metadata = {}) {
    this.track('feature_used', {
      feature_name: featureName,
      action,
      ...metadata
    });
  }

  // Document and content interactions
  trackDocumentOpen(documentId, documentType, source, metadata = {}) {
    this.track('document_opened', {
      document_id: documentId,
      document_type: documentType,
      source,
      ...metadata
    });
  }

  trackDocumentExport(documentId, exportType, format, metadata = {}) {
    this.track('document_exported', {
      document_id: documentId,
      export_type: exportType,
      format,
      ...metadata
    });
  }

  trackContentInteraction(contentType, action, metadata = {}) {
    this.track('content_interaction', {
      content_type: contentType,
      action,
      ...metadata
    });
  }

  // Research Library tracking
  trackLibraryAction(action, itemData = {}) {
    this.track('library_action', {
      action, // 'add', 'edit', 'delete', 'access', 'search', 'filter'
      item_id: itemData.id,
      item_category: itemData.category,
      item_tags: itemData.tags,
      ...itemData
    });
  }

  // User engagement patterns
  trackUserEngagement(engagementType, duration, metadata = {}) {
    this.track('user_engagement', {
      engagement_type: engagementType,
      duration_ms: duration,
      ...metadata
    });
  }

  trackError(errorType, errorMessage, stackTrace = null, metadata = {}) {
    this.track('error_occurred', {
      error_type: errorType,
      error_message: errorMessage,
      stack_trace: stackTrace,
      ...metadata
    }, { immediate: true });
  }

  // Performance tracking
  trackPerformance(metricName, value, metadata = {}) {
    this.track('performance_metric', {
      metric_name: metricName,
      value,
      ...metadata
    });
  }

  trackLoadTime(component, loadTime, metadata = {}) {
    this.track('load_time', {
      component,
      load_time_ms: loadTime,
      ...metadata
    });
  }

  // AI/ML specific tracking
  trackAIInteraction(interactionType, inputData, outputData, processingTime) {
    this.track('ai_interaction', {
      interaction_type: interactionType,
      input_length: inputData?.length || 0,
      output_length: outputData?.length || 0,
      processing_time_ms: processingTime,
      model_used: outputData?.model || 'unknown'
    });
  }

  // Session and user behavior utilities
  getSessionId() {
    if (!this.sessionId) {
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return this.sessionId;
  }

  getSessionData() {
    const key = `analytics_session_${this.getSessionId()}`;
    try {
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  }

  setSessionData(data) {
    const key = `analytics_session_${this.getSessionId()}`;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.debug('Could not save session data:', error);
    }
  }

  // Control methods
  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  // Manual flush for testing
  async flush() {
    await this.flushBatch(true);
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

// Export both the class and instance
export { AnalyticsService };
export default analyticsService;