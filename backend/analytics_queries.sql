-- DeepResearch Analytics Queries
-- Helper queries for analyzing assignment brief detection and usage patterns

-- ===================================================================
-- ASSIGNMENT BRIEF USAGE ANALYSIS
-- ===================================================================

-- 1. Assignment brief usage rate by date and endpoint
-- Shows daily trends of students pasting assignment briefs
SELECT 
  DATE(created_at) as date,
  COUNT(*) as assignment_briefs,
  endpoint,
  AVG((metadata->>'word_count')::int) as avg_word_count
FROM usage_events
WHERE event_type = 'assignment_brief_detected'
GROUP BY date, endpoint
ORDER BY date DESC, endpoint;

-- 2. Field breakdown for assignment briefs
-- Identifies which input fields students use most for pasting assignments
SELECT 
  COALESCE(metadata->>'field', 'prompt') as field,
  COUNT(*) as count,
  AVG((metadata->>'word_count')::int) as avg_words,
  MIN((metadata->>'word_count')::int) as min_words,
  MAX((metadata->>'word_count')::int) as max_words
FROM usage_events
WHERE event_type = 'assignment_brief_detected'
GROUP BY field
ORDER BY count DESC;

-- 3. Peak assignment times (hourly breakdown)
-- Identifies when students are most likely to submit assignment briefs
SELECT 
  EXTRACT(HOUR FROM created_at) as hour_of_day,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM usage_events
WHERE event_type = 'assignment_brief_detected'
GROUP BY hour_of_day
ORDER BY count DESC;

-- 4. Weekly assignment patterns
-- Shows which days of the week see the most assignment submissions
SELECT 
  EXTRACT(DOW FROM created_at) as day_of_week,
  CASE EXTRACT(DOW FROM created_at)
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name,
  COUNT(*) as assignment_briefs
FROM usage_events
WHERE event_type = 'assignment_brief_detected'
GROUP BY day_of_week, day_name
ORDER BY day_of_week;

-- ===================================================================
-- COMPARATIVE USAGE ANALYSIS
-- ===================================================================

-- 5. Assignment vs casual research ratio
-- Compares assignment brief usage to total research requests
WITH assignment_stats AS (
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as assignment_count
  FROM usage_events
  WHERE event_type = 'assignment_brief_detected'
  GROUP BY DATE(created_at)
),
research_stats AS (
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_research
  FROM usage_events
  WHERE event_type = 'research_completed'
  GROUP BY DATE(created_at)
)
SELECT 
  COALESCE(a.date, r.date) as date,
  COALESCE(a.assignment_count, 0) as assignment_briefs,
  COALESCE(r.total_research, 0) as total_research,
  CASE 
    WHEN r.total_research > 0 
    THEN ROUND((COALESCE(a.assignment_count, 0) * 100.0 / r.total_research), 2)
    ELSE 0 
  END as assignment_percentage
FROM assignment_stats a
FULL OUTER JOIN research_stats r ON a.date = r.date
ORDER BY date DESC;

-- 6. User behavior: Assignment users vs casual users
-- Identifies users who frequently use assignment briefs vs those who don't
SELECT 
  user_id,
  COUNT(*) as total_events,
  SUM(CASE WHEN event_type = 'assignment_brief_detected' THEN 1 ELSE 0 END) as assignment_briefs,
  SUM(CASE WHEN event_type = 'research_completed' THEN 1 ELSE 0 END) as research_completed,
  CASE 
    WHEN SUM(CASE WHEN event_type = 'research_completed' THEN 1 ELSE 0 END) > 0 
    THEN ROUND(
      (SUM(CASE WHEN event_type = 'assignment_brief_detected' THEN 1 ELSE 0 END) * 100.0 / 
       SUM(CASE WHEN event_type = 'research_completed' THEN 1 ELSE 0 END)), 2
    )
    ELSE 0 
  END as assignment_usage_rate
FROM usage_events
WHERE event_type IN ('assignment_brief_detected', 'research_completed')
  AND user_id IS NOT NULL
GROUP BY user_id
HAVING SUM(CASE WHEN event_type = 'research_completed' THEN 1 ELSE 0 END) >= 3
ORDER BY assignment_usage_rate DESC;

-- ===================================================================
-- CONTENT LENGTH ANALYSIS
-- ===================================================================

-- 7. Assignment brief length distribution
-- Shows the distribution of assignment brief lengths
SELECT 
  CASE 
    WHEN (metadata->>'word_count')::int BETWEEN 500 AND 750 THEN '500-750 words'
    WHEN (metadata->>'word_count')::int BETWEEN 751 AND 1000 THEN '751-1000 words'
    WHEN (metadata->>'word_count')::int BETWEEN 1001 AND 1500 THEN '1001-1500 words'
    WHEN (metadata->>'word_count')::int BETWEEN 1501 AND 2000 THEN '1501-2000 words'
    WHEN (metadata->>'word_count')::int > 2000 THEN '2000+ words'
  END as word_range,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM usage_events
WHERE event_type = 'assignment_brief_detected'
GROUP BY word_range
ORDER BY MIN((metadata->>'word_count')::int);

-- 8. Longest assignment briefs (potential misuse detection)
-- Identifies extremely long submissions that might indicate bulk text pasting
SELECT 
  created_at,
  user_id,
  endpoint,
  COALESCE(metadata->>'field', 'prompt') as field,
  (metadata->>'word_count')::int as word_count,
  (metadata->>'prompt_length')::int as char_count
FROM usage_events
WHERE event_type = 'assignment_brief_detected'
ORDER BY (metadata->>'word_count')::int DESC
LIMIT 20;

-- ===================================================================
-- TREND ANALYSIS
-- ===================================================================

-- 9. Monthly assignment brief trends
-- Shows month-over-month growth in assignment usage
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as assignment_briefs,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(AVG((metadata->>'word_count')::int), 2) as avg_word_count
FROM usage_events
WHERE event_type = 'assignment_brief_detected'
GROUP BY month
ORDER BY month DESC;

-- 10. Recent assignment activity (last 7 days)
-- Shows detailed recent activity for monitoring
SELECT 
  DATE(created_at) as date,
  COUNT(*) as assignment_briefs,
  COUNT(DISTINCT user_id) as unique_users,
  endpoint,
  COALESCE(metadata->>'field', 'prompt') as field
FROM usage_events
WHERE event_type = 'assignment_brief_detected'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY date, endpoint, field
ORDER BY date DESC, endpoint, field;

-- ===================================================================
-- PERFORMANCE QUERIES
-- ===================================================================

-- 11. Quick stats for dashboards
-- Simple query for real-time dashboard metrics
SELECT 
  COUNT(*) as total_assignment_briefs,
  COUNT(DISTINCT user_id) as unique_assignment_users,
  AVG((metadata->>'word_count')::int) as avg_assignment_length,
  MAX(created_at) as last_assignment_brief
FROM usage_events
WHERE event_type = 'assignment_brief_detected';

-- 12. Today's assignment activity
-- Current day monitoring
SELECT 
  COUNT(*) as todays_assignment_briefs,
  COUNT(DISTINCT user_id) as unique_users_today,
  MIN(created_at) as first_assignment_today,
  MAX(created_at) as latest_assignment_today
FROM usage_events
WHERE event_type = 'assignment_brief_detected'
  AND DATE(created_at) = CURRENT_DATE;