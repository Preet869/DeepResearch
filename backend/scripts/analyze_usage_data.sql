-- DeepResearch Usage Analytics Queries
-- These queries help analyze user behavior and application usage patterns

-- 1. BASIC USAGE STATISTICS
-- =======================

-- Total events by type
SELECT 
    event_type,
    COUNT(*) as event_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM usage_events 
GROUP BY event_type 
ORDER BY event_count DESC;

-- Daily active users (last 30 days)
SELECT 
    DATE(created_at) as date,
    COUNT(DISTINCT user_id) as daily_active_users
FROM usage_events 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;

-- User engagement summary
SELECT 
    COUNT(DISTINCT user_id) as total_users,
    AVG(events_per_user) as avg_events_per_user,
    MAX(events_per_user) as max_events_per_user,
    MIN(events_per_user) as min_events_per_user
FROM (
    SELECT 
        user_id,
        COUNT(*) as events_per_user
    FROM usage_events 
    GROUP BY user_id
) user_stats;

-- 2. RESEARCH BEHAVIOR ANALYSIS
-- ============================

-- Most popular research topics
SELECT 
    event_data->>'query' as research_topic,
    COUNT(*) as search_count
FROM usage_events 
WHERE event_type IN ('search_initiated', 'research_started')
    AND event_data->>'query' IS NOT NULL
GROUP BY event_data->>'query'
ORDER BY search_count DESC
LIMIT 20;

-- Research session patterns
SELECT 
    EXTRACT(hour FROM created_at) as hour_of_day,
    COUNT(*) as research_sessions
FROM usage_events 
WHERE event_type = 'research_started'
GROUP BY EXTRACT(hour FROM created_at)
ORDER BY hour_of_day;

-- Search to research conversion rate
WITH search_stats AS (
    SELECT 
        user_id,
        DATE(created_at) as date,
        COUNT(CASE WHEN event_type = 'search_initiated' THEN 1 END) as searches,
        COUNT(CASE WHEN event_type = 'research_started' THEN 1 END) as research_starts
    FROM usage_events 
    WHERE event_type IN ('search_initiated', 'research_started')
    GROUP BY user_id, DATE(created_at)
)
SELECT 
    AVG(CASE WHEN searches > 0 THEN research_starts::FLOAT / searches ELSE 0 END) as avg_conversion_rate,
    COUNT(*) as total_days_with_activity
FROM search_stats
WHERE searches > 0;

-- 3. FEATURE USAGE ANALYSIS
-- =========================

-- Most used features
SELECT 
    event_data->>'feature_name' as feature,
    event_data->>'action' as action,
    COUNT(*) as usage_count
FROM usage_events 
WHERE event_type = 'feature_used'
    AND event_data->>'feature_name' IS NOT NULL
GROUP BY event_data->>'feature_name', event_data->>'action'
ORDER BY usage_count DESC;

-- Library usage patterns
SELECT 
    event_data->>'action' as library_action,
    COUNT(*) as action_count,
    COUNT(DISTINCT user_id) as unique_users
FROM usage_events 
WHERE event_type = 'library_action'
GROUP BY event_data->>'action'
ORDER BY action_count DESC;

-- Export behavior
SELECT 
    event_data->>'format' as export_format,
    event_data->>'export_type' as export_type,
    COUNT(*) as export_count,
    COUNT(DISTINCT user_id) as unique_exporters
FROM usage_events 
WHERE event_type = 'document_exported'
GROUP BY event_data->>'format', event_data->>'export_type'
ORDER BY export_count DESC;

-- 4. USER JOURNEY ANALYSIS
-- ========================

-- Page flow analysis (top 10 most common page transitions)
WITH page_transitions AS (
    SELECT 
        user_id,
        event_data->>'page' as current_page,
        LAG(event_data->>'page') OVER (PARTITION BY user_id ORDER BY created_at) as previous_page,
        created_at
    FROM usage_events 
    WHERE event_type = 'page_view' AND event_data->>'page' IS NOT NULL
)
SELECT 
    COALESCE(previous_page, 'entry') as from_page,
    current_page as to_page,
    COUNT(*) as transition_count
FROM page_transitions
WHERE current_page IS NOT NULL
GROUP BY previous_page, current_page
ORDER BY transition_count DESC
LIMIT 10;

-- Session duration analysis
WITH session_durations AS (
    SELECT 
        user_id,
        DATE(created_at) as session_date,
        MIN(created_at) as session_start,
        MAX(created_at) as session_end,
        EXTRACT(epoch FROM MAX(created_at) - MIN(created_at))/60 as duration_minutes
    FROM usage_events 
    GROUP BY user_id, DATE(created_at)
    HAVING COUNT(*) > 1  -- Only sessions with multiple events
)
SELECT 
    ROUND(AVG(duration_minutes), 2) as avg_session_duration_mins,
    ROUND(MIN(duration_minutes), 2) as min_session_duration_mins,
    ROUND(MAX(duration_minutes), 2) as max_session_duration_mins,
    COUNT(*) as total_sessions
FROM session_durations;

-- 5. RESEARCH LIBRARY ANALYTICS
-- =============================

-- Library items by category
SELECT 
    category,
    COUNT(*) as item_count,
    COUNT(DISTINCT user_id) as users_with_items,
    ROUND(AVG(array_length(tags, 1)), 2) as avg_tags_per_item
FROM research_library_items 
GROUP BY category
ORDER BY item_count DESC;

-- Most popular tags
SELECT 
    tag,
    COUNT(*) as usage_count
FROM (
    SELECT unnest(tags) as tag 
    FROM research_library_items
) tag_data
GROUP BY tag
ORDER BY usage_count DESC
LIMIT 20;

-- Library engagement patterns
SELECT 
    user_id,
    COUNT(*) as total_items,
    MIN(created_at) as first_item_added,
    MAX(last_accessed_at) as last_access,
    EXTRACT(days FROM NOW() - MAX(last_accessed_at)) as days_since_last_access
FROM research_library_items 
GROUP BY user_id
ORDER BY total_items DESC;

-- 6. ERROR AND PERFORMANCE ANALYSIS
-- =================================

-- Error frequency by type
SELECT 
    event_data->>'error_type' as error_type,
    COUNT(*) as error_count,
    COUNT(DISTINCT user_id) as affected_users
FROM usage_events 
WHERE event_type = 'error_occurred'
GROUP BY event_data->>'error_type'
ORDER BY error_count DESC;

-- Performance metrics
SELECT 
    event_data->>'metric_name' as metric,
    ROUND(AVG((event_data->>'value')::FLOAT), 2) as avg_value,
    ROUND(MIN((event_data->>'value')::FLOAT), 2) as min_value,
    ROUND(MAX((event_data->>'value')::FLOAT), 2) as max_value,
    COUNT(*) as sample_count
FROM usage_events 
WHERE event_type = 'performance_metric' 
    AND event_data->>'value' IS NOT NULL
    AND event_data->>'value' ~ '^[0-9]+\.?[0-9]*$'  -- Valid numbers only
GROUP BY event_data->>'metric_name'
ORDER BY avg_value DESC;

-- 7. USER RETENTION ANALYSIS
-- ==========================

-- User activity by week
SELECT 
    DATE_TRUNC('week', created_at) as week,
    COUNT(DISTINCT user_id) as active_users,
    COUNT(*) as total_events
FROM usage_events 
WHERE created_at >= NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week;

-- New vs returning users (based on session starts)
WITH user_first_session AS (
    SELECT 
        user_id,
        MIN(created_at) as first_session
    FROM usage_events 
    WHERE event_type = 'session_started'
    GROUP BY user_id
)
SELECT 
    DATE(ue.created_at) as date,
    COUNT(DISTINCT CASE 
        WHEN DATE(ue.created_at) = DATE(ufs.first_session) THEN ue.user_id 
    END) as new_users,
    COUNT(DISTINCT CASE 
        WHEN DATE(ue.created_at) > DATE(ufs.first_session) THEN ue.user_id 
    END) as returning_users
FROM usage_events ue
JOIN user_first_session ufs ON ue.user_id = ufs.user_id
WHERE ue.event_type = 'session_started'
    AND ue.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(ue.created_at)
ORDER BY date;

-- 8. CONTENT AND ENGAGEMENT INSIGHTS
-- ==================================

-- Most engaging content types (by time spent)
SELECT 
    event_data->>'content_type' as content_type,
    ROUND(AVG((event_data->>'duration_ms')::FLOAT / 1000), 2) as avg_duration_seconds,
    COUNT(*) as interaction_count
FROM usage_events 
WHERE event_type = 'content_interaction' 
    AND event_data->>'duration_ms' IS NOT NULL
    AND event_data->>'duration_ms' ~ '^[0-9]+$'
GROUP BY event_data->>'content_type'
ORDER BY avg_duration_seconds DESC;

-- Folder usage patterns
SELECT 
    event_data->>'folder_name' as folder_name,
    COUNT(*) as selection_count,
    COUNT(DISTINCT user_id) as unique_users
FROM usage_events 
WHERE event_type = 'folder_selected'
    AND event_data->>'folder_name' IS NOT NULL
GROUP BY event_data->>'folder_name'
ORDER BY selection_count DESC;

-- Search patterns analysis
SELECT 
    EXTRACT(hour FROM created_at) as hour,
    EXTRACT(dow FROM created_at) as day_of_week,  -- 0=Sunday, 6=Saturday
    COUNT(*) as search_count
FROM usage_events 
WHERE event_type = 'search_initiated'
GROUP BY EXTRACT(hour FROM created_at), EXTRACT(dow FROM created_at)
ORDER BY day_of_week, hour;