-- Create usage_events table for tracking application usage
CREATE TABLE IF NOT EXISTS public.usage_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON public.usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON public.usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON public.usage_events(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Create policies for usage_events
CREATE POLICY "Users can view their own usage events" ON public.usage_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all usage events" ON public.usage_events
    FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;