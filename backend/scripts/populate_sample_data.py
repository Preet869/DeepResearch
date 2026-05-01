#!/usr/bin/env python3
"""
Sample Data Population Script for DeepResearch

This script populates the usage_events and research_library_items tables with realistic sample data
for testing and demonstration purposes.

Usage:
    python populate_sample_data.py --users <user_count> --days <days_back> [--clear]

Arguments:
    --users: Number of sample users to create data for (default: 5)
    --days: Number of days back to generate data for (default: 30)
    --clear: Clear existing data before populating (default: False)
"""

import os
import sys
import argparse
import random
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch

# Sample data for realistic content
SAMPLE_RESEARCH_TOPICS = [
    "climate change and renewable energy",
    "artificial intelligence in healthcare",
    "sustainable agriculture practices",
    "remote work productivity studies",
    "electric vehicle adoption trends",
    "mental health in digital age",
    "blockchain technology applications",
    "gene therapy breakthroughs",
    "smart city infrastructure",
    "cybersecurity in IoT devices",
    "ocean conservation strategies",
    "quantum computing advances",
    "space exploration missions",
    "biodiversity loss prevention",
    "autonomous vehicle safety",
    "personalized medicine trends",
    "social media impact studies",
    "clean energy storage solutions",
    "urban farming innovations",
    "digital privacy regulations"
]

SAMPLE_EVENT_TYPES = [
    'session_started',
    'page_view',
    'search_initiated',
    'search_completed',
    'research_started',
    'research_completed',
    'document_opened',
    'document_exported',
    'library_action',
    'feature_used',
    'content_interaction',
    'button_click',
    'folder_created',
    'folder_selected',
    'conversation_moved',
    'dashboard_search',
    'page_exit'
]

SAMPLE_LIBRARY_CATEGORIES = [
    'research', 'articles', 'books', 'reports', 'notes'
]

SAMPLE_LIBRARY_ITEMS = [
    {
        'title': 'The Future of Renewable Energy: A Comprehensive Analysis',
        'description': 'In-depth study on solar, wind, and hydroelectric power trends',
        'category': 'research',
        'url': 'https://example.com/renewable-energy-analysis',
        'tags': ['renewable energy', 'solar power', 'wind energy', 'sustainability'],
        'notes': 'Key insights on cost reduction trends and policy impacts'
    },
    {
        'title': 'AI in Medical Diagnosis: Current Applications and Future Prospects',
        'description': 'Review of machine learning applications in healthcare diagnostics',
        'category': 'articles',
        'url': 'https://example.com/ai-medical-diagnosis',
        'tags': ['artificial intelligence', 'healthcare', 'machine learning', 'diagnosis'],
        'notes': 'Notable case studies from Mayo Clinic and Johns Hopkins'
    },
    {
        'title': 'Sustainable Agriculture Practices Report 2024',
        'description': 'Annual report on sustainable farming techniques and their impact',
        'category': 'reports',
        'url': 'https://example.com/sustainable-agriculture-2024',
        'tags': ['agriculture', 'sustainability', 'farming', 'environment'],
        'notes': 'Focus on regenerative agriculture and soil health'
    },
    {
        'title': 'The Psychology of Remote Work',
        'description': 'Book exploring mental health aspects of distributed work environments',
        'category': 'books',
        'url': 'https://example.com/psychology-remote-work',
        'tags': ['remote work', 'psychology', 'mental health', 'productivity'],
        'notes': 'Chapter 7 has excellent frameworks for team management'
    },
    {
        'title': 'Electric Vehicle Market Trends - Q3 2024',
        'description': 'Quarterly analysis of EV adoption rates and market dynamics',
        'category': 'reports',
        'url': 'https://example.com/ev-market-trends-q3-2024',
        'tags': ['electric vehicles', 'market analysis', 'automotive', 'trends'],
        'notes': 'Tesla and BYD leading growth in Asia-Pacific region'
    },
    {
        'title': 'Digital Wellness in the Age of Social Media',
        'description': 'Research paper on social media impact on mental health',
        'category': 'research',
        'url': 'https://example.com/digital-wellness-social-media',
        'tags': ['social media', 'mental health', 'digital wellness', 'psychology'],
        'notes': 'Strong correlation between usage time and anxiety levels'
    },
    {
        'title': 'Blockchain Applications Beyond Cryptocurrency',
        'description': 'Comprehensive overview of blockchain use cases in various industries',
        'category': 'articles',
        'url': 'https://example.com/blockchain-applications',
        'tags': ['blockchain', 'cryptocurrency', 'technology', 'innovation'],
        'notes': 'Supply chain and healthcare applications show most promise'
    },
    {
        'title': 'Gene Therapy Clinical Trial Results',
        'description': 'Latest results from Phase III gene therapy trials',
        'category': 'research',
        'url': 'https://example.com/gene-therapy-trials',
        'tags': ['gene therapy', 'clinical trials', 'biotechnology', 'medicine'],
        'notes': 'Promising results for inherited blindness treatments'
    },
    {
        'title': 'Smart City Infrastructure Planning Guide',
        'description': 'Best practices for implementing smart city technologies',
        'category': 'books',
        'url': 'https://example.com/smart-city-planning',
        'tags': ['smart cities', 'urban planning', 'IoT', 'infrastructure'],
        'notes': 'Barcelona and Singapore as model case studies'
    },
    {
        'title': 'Cybersecurity Threats in IoT Devices',
        'description': 'Analysis of security vulnerabilities in connected devices',
        'category': 'reports',
        'url': 'https://example.com/iot-cybersecurity-threats',
        'tags': ['cybersecurity', 'IoT', 'security', 'threats'],
        'notes': 'Default passwords still major vulnerability in 60% of devices'
    }
]

def get_db_connection():
    """Get database connection from environment variables."""
    try:
        # Try to get from environment first (production/staging)
        db_url = os.getenv('DATABASE_URL')
        if db_url:
            return psycopg2.connect(db_url)
        
        # Fallback to individual parameters (development)
        return psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME', 'deepresearch'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', ''),
            port=os.getenv('DB_PORT', 5432)
        )
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        sys.exit(1)

def get_sample_users(conn, limit=None):
    """Get sample user IDs from auth.users table."""
    with conn.cursor() as cur:
        query = "SELECT id FROM auth.users ORDER BY created_at"
        if limit:
            query += f" LIMIT {limit}"
        
        cur.execute(query)
        result = cur.fetchall()
        
        if not result:
            print("No users found in auth.users table. Please create some users first.")
            return []
        
        return [row[0] for row in result]

def clear_existing_data(conn):
    """Clear existing sample data from tables."""
    print("Clearing existing data...")
    with conn.cursor() as cur:
        # Clear usage_events
        cur.execute("DELETE FROM public.usage_events WHERE event_data->>'sample_data' = 'true'")
        usage_deleted = cur.rowcount
        
        # Clear research_library_items (be careful not to delete real user data)
        cur.execute("""
            DELETE FROM public.research_library_items 
            WHERE notes LIKE '%[Sample Data]%'
        """)
        library_deleted = cur.rowcount
        
        conn.commit()
        print(f"Cleared {usage_deleted} usage events and {library_deleted} library items")

def generate_usage_events(user_ids, days_back=30):
    """Generate realistic usage events for the given users and time period."""
    events = []
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days_back)
    
    for user_id in user_ids:
        # Generate sessions for this user (1-3 sessions per day)
        current_date = start_date
        while current_date <= end_date:
            sessions_today = random.randint(0, 3)  # Some days no activity
            
            for session in range(sessions_today):
                session_start = current_date + timedelta(
                    hours=random.randint(8, 22),
                    minutes=random.randint(0, 59),
                    seconds=random.randint(0, 59)
                )
                
                # Session started event
                events.append({
                    'user_id': user_id,
                    'event_type': 'session_started',
                    'event_data': {
                        'user_agent': 'Mozilla/5.0 (sample data)',
                        'screen_resolution': f"{random.choice(['1920x1080', '1366x768', '1440x900'])}",
                        'sample_data': 'true'
                    },
                    'created_at': session_start
                })
                
                # Generate events within this session
                session_events = generate_session_events(user_id, session_start)
                events.extend(session_events)
            
            current_date += timedelta(days=1)
    
    return events

def generate_session_events(user_id, session_start):
    """Generate events within a single user session."""
    events = []
    current_time = session_start
    
    # Session duration: 5-120 minutes
    session_duration = random.randint(5, 120)
    session_end = session_start + timedelta(minutes=session_duration)
    
    # Page view - dashboard
    current_time += timedelta(seconds=random.randint(1, 5))
    events.append({
        'user_id': user_id,
        'event_type': 'page_view',
        'event_data': {
            'page': 'dashboard',
            'sample_data': 'true'
        },
        'created_at': current_time
    })
    
    # Random session activities
    activities = random.randint(3, 15)
    for _ in range(activities):
        if current_time >= session_end:
            break
            
        current_time += timedelta(seconds=random.randint(10, 300))  # 10s to 5min between actions
        
        event_type = random.choice(SAMPLE_EVENT_TYPES)
        event_data = generate_event_data(event_type, user_id)
        
        events.append({
            'user_id': user_id,
            'event_type': event_type,
            'event_data': event_data,
            'created_at': current_time
        })
    
    return events

def generate_event_data(event_type, user_id):
    """Generate realistic event data based on event type."""
    base_data = {'sample_data': 'true'}
    
    if event_type == 'search_initiated':
        topic = random.choice(SAMPLE_RESEARCH_TOPICS)
        return {
            **base_data,
            'query': topic,
            'query_length': len(topic),
            'query_word_count': len(topic.split()),
            'search_method': random.choice(['basic', 'advanced']),
            'filters': {}
        }
    
    elif event_type == 'search_completed':
        topic = random.choice(SAMPLE_RESEARCH_TOPICS)
        results_count = random.randint(5, 50)
        return {
            **base_data,
            'query': topic,
            'results_count': results_count,
            'processing_time_ms': random.randint(1000, 8000),
            'sources_count': random.randint(3, 15),
            'has_results': results_count > 0
        }
    
    elif event_type == 'research_started':
        return {
            **base_data,
            'conversation_id': random.randint(1, 1000),
            'initial_query': random.choice(SAMPLE_RESEARCH_TOPICS),
            'folder_id': random.choice([None, random.randint(1, 10)]),
        }
    
    elif event_type == 'document_opened':
        return {
            **base_data,
            'document_id': f"doc_{random.randint(1, 1000)}",
            'document_type': random.choice(['research_paper', 'article', 'report']),
            'source': random.choice(['search_results', 'library', 'recommendation']),
        }
    
    elif event_type == 'library_action':
        return {
            **base_data,
            'action': random.choice(['add', 'edit', 'delete', 'access', 'search']),
            'item_category': random.choice(SAMPLE_LIBRARY_CATEGORIES),
            'item_id': f"lib_{random.randint(1, 100)}",
        }
    
    elif event_type == 'feature_used':
        return {
            **base_data,
            'feature_name': random.choice([
                'export_manager', 'citation_helper', 'analytics', 
                'research_library', 'comparison_tool'
            ]),
            'action': random.choice(['opened', 'closed', 'used']),
        }
    
    elif event_type == 'folder_created':
        return {
            **base_data,
            'folder_name': f"Research Folder {random.randint(1, 100)}",
            'folder_color': random.choice(['#3B82F6', '#10B981', '#F59E0B', '#EF4444']),
        }
    
    elif event_type == 'page_view':
        return {
            **base_data,
            'page': random.choice(['dashboard', 'research_page', 'comparison_page']),
        }
    
    else:
        return base_data

def generate_library_items(user_ids):
    """Generate sample library items for users."""
    items = []
    
    for user_id in user_ids:
        # Each user gets 3-12 library items
        num_items = random.randint(3, 12)
        user_items = random.sample(SAMPLE_LIBRARY_ITEMS, min(num_items, len(SAMPLE_LIBRARY_ITEMS)))
        
        for item in user_items:
            # Add some variation to make items unique per user
            created_at = datetime.now(timezone.utc) - timedelta(
                days=random.randint(1, 90),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59)
            )
            
            last_accessed = created_at + timedelta(
                days=random.randint(0, 30),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59)
            )
            
            items.append({
                'user_id': user_id,
                'title': item['title'],
                'description': item['description'],
                'category': item['category'],
                'url': item['url'],
                'tags': item['tags'],
                'notes': item['notes'] + ' [Sample Data]',  # Mark as sample data
                'created_at': created_at,
                'last_accessed_at': last_accessed
            })
    
    return items

def insert_usage_events(conn, events):
    """Insert usage events in batches."""
    print(f"Inserting {len(events)} usage events...")
    
    insert_query = """
        INSERT INTO public.usage_events (user_id, event_type, event_data, created_at)
        VALUES (%(user_id)s, %(event_type)s, %(event_data)s, %(created_at)s)
    """
    
    # Convert event_data to JSON strings
    for event in events:
        event['event_data'] = json.dumps(event['event_data'])
    
    with conn.cursor() as cur:
        execute_batch(cur, insert_query, events, page_size=1000)
    
    conn.commit()
    print(f"Successfully inserted {len(events)} usage events")

def insert_library_items(conn, items):
    """Insert library items in batches."""
    print(f"Inserting {len(items)} library items...")
    
    insert_query = """
        INSERT INTO public.research_library_items 
        (user_id, title, description, category, url, tags, notes, created_at, last_accessed_at)
        VALUES (%(user_id)s, %(title)s, %(description)s, %(category)s, %(url)s, %(tags)s, %(notes)s, %(created_at)s, %(last_accessed_at)s)
    """
    
    with conn.cursor() as cur:
        execute_batch(cur, insert_query, items, page_size=1000)
    
    conn.commit()
    print(f"Successfully inserted {len(items)} library items")

def main():
    parser = argparse.ArgumentParser(description='Populate DeepResearch tables with sample data')
    parser.add_argument('--users', type=int, default=5, 
                        help='Number of sample users to create data for (default: 5)')
    parser.add_argument('--days', type=int, default=30, 
                        help='Number of days back to generate data for (default: 30)')
    parser.add_argument('--clear', action='store_true', 
                        help='Clear existing sample data before populating')
    
    args = parser.parse_args()
    
    print(f"Populating sample data for {args.users} users over {args.days} days")
    
    # Connect to database
    conn = get_db_connection()
    
    try:
        # Clear existing data if requested
        if args.clear:
            clear_existing_data(conn)
        
        # Get sample users
        user_ids = get_sample_users(conn, args.users)
        if not user_ids:
            return
        
        print(f"Found {len(user_ids)} users to populate data for")
        
        # Generate and insert usage events
        print("Generating usage events...")
        events = generate_usage_events(user_ids, args.days)
        insert_usage_events(conn, events)
        
        # Generate and insert library items
        print("Generating library items...")
        items = generate_library_items(user_ids)
        insert_library_items(conn, items)
        
        print("\nSample data population completed successfully!")
        print(f"- {len(events)} usage events created")
        print(f"- {len(items)} library items created")
        
    except Exception as e:
        print(f"Error during data population: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    main()