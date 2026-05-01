# DeepResearch Analytics Scripts

This directory contains scripts and queries for analyzing user behavior and application usage data in DeepResearch.

## Overview

The analytics system tracks comprehensive user interactions through two main tables:
- `usage_events`: Tracks all user actions and behaviors
- `research_library_items`: Stores user's saved research items

## Files

### 1. `populate_sample_data.py`
A Python script that generates realistic sample data for testing and demonstration purposes.

**Features:**
- Generates realistic usage events across different event types
- Creates sample research library items for users
- Supports multiple users and configurable time ranges
- Includes realistic research topics and user behavior patterns

**Usage:**
```bash
# Basic usage (5 users, 30 days of data)
python populate_sample_data.py

# Custom parameters
python populate_sample_data.py --users 10 --days 60

# Clear existing sample data and repopulate
python populate_sample_data.py --users 5 --days 30 --clear
```

**Requirements:**
- PostgreSQL database with DeepResearch schema
- Python 3.7+
- psycopg2 library (`pip install psycopg2-binary`)
- Database connection via environment variables:
  - `DATABASE_URL` (full connection string), or
  - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`

### 2. `analyze_usage_data.sql`
A comprehensive set of SQL queries for analyzing user behavior and application performance.

**Query Categories:**

1. **Basic Usage Statistics**
   - Event frequency by type
   - Daily active users
   - User engagement metrics

2. **Research Behavior Analysis**
   - Popular research topics
   - Search patterns by time
   - Search-to-research conversion rates

3. **Feature Usage Analysis**
   - Most used features
   - Library interaction patterns
   - Export behavior

4. **User Journey Analysis**
   - Page navigation flow
   - Session duration analysis

5. **Research Library Analytics**
   - Content categorization
   - Tag popularity
   - User engagement patterns

6. **Error and Performance Analysis**
   - Error frequency and types
   - Performance metrics

7. **User Retention Analysis**
   - Weekly activity trends
   - New vs returning users

8. **Content and Engagement Insights**
   - Content interaction duration
   - Folder usage patterns
   - Search timing analysis

**Usage:**
```bash
# Run all queries
psql -d your_database -f analyze_usage_data.sql

# Run specific sections
psql -d your_database -c "SELECT event_type, COUNT(*) FROM usage_events GROUP BY event_type;"
```

## Event Types Tracked

The analytics system captures these event types:

### Navigation & Sessions
- `session_started` - User login/session initiation
- `session_ended` - Session termination
- `page_view` - Page navigation
- `page_exit` - Page departure with time spent

### Research Activities
- `search_initiated` - Search query submitted
- `search_completed` - Search results returned
- `research_started` - New research conversation begun
- `research_completed` - Research session finished

### Content Interactions
- `document_opened` - Document/source accessed
- `document_exported` - Content exported (PDF, etc.)
- `content_interaction` - General content engagement

### Library Management
- `library_action` - Research library interactions
  - Actions: add, edit, delete, access, search, filter

### Feature Usage
- `feature_used` - Specific feature interactions
  - Features: export_manager, citation_helper, analytics, research_library

### Organization
- `folder_created` - New folder created
- `folder_selected` - Folder navigation
- `conversation_moved` - Research item organization

### System Events
- `button_click` - UI interaction tracking
- `error_occurred` - Error logging
- `performance_metric` - Performance monitoring

## Sample Data Structure

### Usage Events
```json
{
  "event_type": "search_initiated",
  "event_data": {
    "query": "climate change and renewable energy",
    "query_length": 35,
    "query_word_count": 5,
    "search_method": "advanced",
    "filters": {},
    "timestamp": "2024-01-15T10:30:00Z",
    "page_url": "/research",
    "session_id": "session_123",
    "user_agent": "Mozilla/5.0..."
  }
}
```

### Library Items
```json
{
  "title": "The Future of Renewable Energy: A Comprehensive Analysis",
  "description": "In-depth study on solar, wind, and hydroelectric power trends",
  "category": "research",
  "url": "https://example.com/renewable-energy-analysis",
  "tags": ["renewable energy", "solar power", "wind energy", "sustainability"],
  "notes": "Key insights on cost reduction trends and policy impacts"
}
```

## Analytics Implementation

### Frontend Integration
The analytics service (`analyticsService.js`) automatically tracks user interactions:

```javascript
import analyticsService from './services/analyticsService';

// Track specific events
analyticsService.trackSearch(query, filters);
analyticsService.trackFeatureUsage('export_manager', 'opened');
analyticsService.trackLibraryAction('item_added', itemData);

// Automatic tracking
analyticsService.trackPageView('research_page');
```

### Backend Integration
Events are stored in PostgreSQL via Supabase:

```sql
INSERT INTO usage_events (user_id, event_type, event_data, created_at)
VALUES ($1, $2, $3, NOW());
```

## Privacy and Compliance

- All tracking respects user privacy settings
- No personally identifiable information is stored in event data
- Events can be disabled per user if needed
- Data retention policies can be implemented via SQL

## Performance Considerations

- Events are batched and sent asynchronously
- Database indexes are provided for common queries
- Large datasets can be archived or aggregated for reporting

## Development Tips

1. **Testing**: Use the sample data script to generate realistic test data
2. **Debugging**: Check the browser console for analytics service logs
3. **Performance**: Monitor the `performance_metric` events for bottlenecks
4. **Custom Events**: Extend the analytics service for application-specific tracking

## Common Queries

```sql
-- Most active users this week
SELECT user_id, COUNT(*) as events
FROM usage_events 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id 
ORDER BY events DESC 
LIMIT 10;

-- Feature adoption rates
SELECT 
  event_data->>'feature_name' as feature,
  COUNT(DISTINCT user_id) as users,
  COUNT(*) as total_uses
FROM usage_events 
WHERE event_type = 'feature_used'
GROUP BY event_data->>'feature_name';

-- Research topic trends
SELECT 
  event_data->>'query' as topic,
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as searches
FROM usage_events 
WHERE event_type = 'search_initiated'
GROUP BY event_data->>'query', DATE_TRUNC('week', created_at)
ORDER BY week, searches DESC;
```