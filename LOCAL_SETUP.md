# DeepResearch Local Development Setup

This guide will help you set up DeepResearch to run locally on your machine, removing all Railway dependencies.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Docker & Docker Compose** (for containerized setup)
  - [Install Docker Desktop](https://docs.docker.com/get-docker/)
  - [Install Docker Compose](https://docs.docker.com/compose/install/)

- **OR Python 3.8+ & Node.js** (for development mode)
  - [Install Python 3.8+](https://www.python.org/downloads/)
  - [Install Node.js](https://nodejs.org/)

## Required API Keys

You'll need the following API keys to run DeepResearch:

1. **OpenAI API Key** - For AI-powered research reports
   - Get it from: https://platform.openai.com/api-keys

2. **Tavily API Key** - For web search functionality
   - Get it from: https://tavily.com/

3. **Supabase Project** - For database and authentication
   - Create a project at: https://supabase.com/
   - You'll need:
     - Project URL
     - Service Role Key (for backend)
     - Anon Key (for frontend)

## Quick Setup

### Option 1: Docker Setup (Recommended)

1. **Clone and navigate to the project:**
   ```bash
   cd /Users/ppreet/Desktop/Work/Project/DeepResearch
   ```

2. **Set up environment variables:**
   ```bash
   # Copy the example files
   cp backend/env.example backend/.env
   cp frontend/env.local.example frontend/.env
   
   # Edit the files with your actual API keys
   nano backend/.env
   nano frontend/.env
   ```

3. **Start the application:**
   ```bash
   ./start-local.sh
   ```

4. **Access your application:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000

### Option 2: Development Mode (No Docker)

1. **Set up environment variables** (same as above)

2. **Start in development mode:**
   ```bash
   ./start-dev.sh
   ```

## Environment Variables

### Backend (.env)
```bash
# Required API Keys
OPENAI_API_KEY=your_openai_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000

# Development mode
NODE_ENV=development
```

### Frontend (.env)
```bash
# Backend API URL
REACT_APP_API_URL=http://localhost:8000

# Supabase Configuration
REACT_APP_SUPABASE_URL=your_supabase_url_here
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Development mode
NODE_ENV=development
```

## Supabase Database Setup

You'll need to set up the following tables in your Supabase project:

### 1. Users Table (handled by Supabase Auth)

### 2. Folders Table
```sql
CREATE TABLE folders (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Conversations Table
```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Messages Table
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model_name TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5. Row Level Security (RLS)
```sql
-- Enable RLS on all tables
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Folders policies
CREATE POLICY "Users can view their own folders" ON folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders" ON folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders" ON folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" ON folders
  FOR DELETE USING (auth.uid() = user_id);

-- Conversations policies
CREATE POLICY "Users can view their own conversations" ON conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages from their conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their conversations" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages from their conversations" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages from their conversations" ON messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );
```

## Useful Commands

### Docker Commands
```bash
# Start services
./start-local.sh

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Rebuild and start
docker-compose up --build -d
```

### Development Commands
```bash
# Start in development mode
./start-dev.sh

# Install backend dependencies
cd backend && pip3 install -r requirements.txt

# Install frontend dependencies
cd frontend && npm install

# Start backend only
cd backend && python3 -m uvicorn main:app --reload

# Start frontend only
cd frontend && npm start
```

## Troubleshooting

### Common Issues

1. **Frontend can't connect to backend**
   - Check that `REACT_APP_API_URL` in `frontend/.env` is set to `http://localhost:8000`
   - Ensure backend is running on port 8000

2. **Backend fails to start**
   - Verify all API keys are correctly set in `backend/.env`
   - Check that Python dependencies are installed: `pip3 install -r requirements.txt`

3. **Database connection issues**
   - Verify Supabase URL and keys are correct
   - Ensure database tables are created with proper RLS policies

4. **CORS errors**
   - Check that `ALLOWED_ORIGINS` in backend includes your frontend URL
   - Default should include `http://localhost:3000`

### Logs and Debugging

- **Docker logs:** `docker-compose logs [service-name]`
- **Backend logs:** Check terminal output when running `uvicorn`
- **Frontend logs:** Check browser console and terminal output

### Health Checks

- Backend health: http://localhost:8000/health
- API root: http://localhost:8000/

## What Was Removed

The following Railway-specific files and configurations have been removed:

- `backend/railway.json` - Railway deployment configuration
- `backend/Procfile` - Railway process configuration
- `backend/start.sh` - Railway startup script
- Railway deployment scripts and references

## Next Steps

1. Set up your API keys in the environment files
2. Create your Supabase project and set up the database tables
3. Run the application using one of the startup scripts
4. Test the functionality by creating a research query
5. Customize the application as needed

## Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed
4. Check the logs for specific error messages

Happy researching! 🚀
