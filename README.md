# DeepResearch 🧠

**AI-Powered Academic Research Platform**

DeepResearch transforms any research question into a comprehensive academic report with data visualizations, proper citations, and intelligent follow-up suggestions. It's designed for students, researchers, and academics who need high-quality research analysis and organization tools.

![DeepResearch Dashboard](https://img.shields.io/badge/Status-Active-brightgreen) ![React](https://img.shields.io/badge/React-18.3.1-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-Latest-green) ![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-purple)

## 🎯 What DeepResearch Does

### **1. AI Research Reports**
- **Input**: Any research question (e.g., "Latest developments in renewable energy")
- **Process**: 
  - Searches the web using Tavily API for current information
  - Analyzes sources with GPT-4o to create comprehensive academic reports
  - Generates data visualizations and insights
  - Provides proper APA-style citations
- **Output**: Professional academic report with:
  - Executive Summary
  - Literature Review
  - Critical Analysis
  - Data visualizations (charts/graphs)
  - References and citations
  - Smart follow-up questions

### **2. Article Comparison**
- **Input**: Two articles (via URL or pasted text) + optional context
- **Process**: 
  - Extracts and analyzes both articles
  - Compares methodology, findings, evidence quality
  - Generates side-by-side analysis tables
  - Creates comparative visualizations
- **Output**: Detailed comparison report with:
  - Executive summary of similarities/differences
  - Comparative analysis tables
  - Methodology assessment
  - Evidence quality evaluation
  - Practical implications
  - Final recommendations

### **3. Research Organization**
- **Smart Folders**: Organize research by topic with color-coded, draggable folders
- **Research Timeline**: Track your research journey with visual timeline
- **Follow-up System**: AI generates intelligent follow-up questions for deeper research
- **Export Options**: Save research as PDF, Markdown, or JSON

## 📝 Real Example

**Input Question**: *"What are the latest developments in renewable energy storage?"*

**What DeepResearch Does**:
1. **Searches the web** for current information about renewable energy storage
2. **Analyzes sources** from academic papers, news articles, and industry reports
3. **Generates a comprehensive report** including:
   - Executive summary of key findings
   - Current state of battery technology
   - Emerging storage solutions (hydrogen, compressed air, etc.)
   - Market trends and investment data
   - Policy implications
   - Future outlook
4. **Creates data visualizations** showing market growth, technology adoption rates
5. **Provides proper citations** for all sources used
6. **Suggests follow-up questions** like:
   - "What are the main challenges in grid-scale energy storage?"
   - "How do different storage technologies compare in cost-effectiveness?"
   - "What are the environmental impacts of battery production?"

**Result**: A professional, citation-ready research report that would take hours to compile manually, delivered in minutes.

## 🌟 Features

### 🔍 **Intelligent Research Engine**
- **AI-Powered Analysis**: Generate comprehensive academic reports using GPT-4o
- **Web Search Integration**: Real-time information gathering via Tavily API
- **Smart Follow-ups**: AI-generated follow-up questions for deeper research
- **Academic Citations**: Proper APA-style citations and source attribution
- **Data Visualizations**: Interactive charts and graphs for research insights

### 📚 **Research Organization**
- **Smart Folders**: Organize research with color-coded, draggable folders
- **Research Timeline**: Track your research journey with visual timeline
- **Drag & Drop**: Intuitive interface for organizing research items
- **Search & Filter**: Find research quickly with powerful search capabilities
- **Export Options**: PDF, Markdown, and JSON export formats

### 📊 **Article Comparison**
- **Side-by-Side Analysis**: Compare two articles with detailed breakdowns
- **Methodology Focus**: Compare research methods and approaches
- **Findings Analysis**: Analyze key findings and conclusions
- **Context-Aware**: Tailored analysis based on your specific needs
- **Student-Friendly**: Perfect for literature reviews and academic assignments

### 🛠️ **Research Tools**
- **Citation Helper**: Generate proper academic citations
- **Source Tracker**: Track and manage research sources
- **Analytics Dashboard**: Research insights and statistics
- **Export Manager**: Bulk export and document management
- **Research Library**: Centralized research repository

### 🔐 **User Management**
- **Secure Authentication**: Supabase-powered user authentication
- **Personal Workspace**: Private research environment
- **Data Persistence**: All research saved securely in the cloud
- **Multi-Device Access**: Access your research from anywhere

## 🏗️ Architecture

### **Frontend (React)**
- **Framework**: React 18.3.1 with modern hooks
- **Styling**: Tailwind CSS for responsive design
- **State Management**: React Context API
- **Routing**: React Router for navigation
- **UI Components**: Custom components with drag-and-drop functionality
- **Charts**: Recharts for data visualization

### **Backend (FastAPI)**
- **Framework**: FastAPI with async/await support
- **AI Integration**: OpenAI GPT-4o for research generation
- **Search Engine**: Tavily API for web search
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Authentication**: JWT-based authentication via Supabase
- **API Design**: RESTful API with comprehensive error handling

### **Database Schema**
```sql
-- Core Tables
folders (id, user_id, name, color, created_at)
conversations (id, user_id, title, folder_id, created_at)
messages (id, conversation_id, role, content, model_name, metadata, created_at)
```

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (recommended)
- **OR** Python 3.8+ & Node.js 16+
- **API Keys**: OpenAI, Tavily, and Supabase

### 1. Clone the Repository
```bash
git clone <repository-url>
cd DeepResearch
```

### 2. Set Up Environment Variables
```bash
# Copy example files
cp backend/env.example backend/.env
cp frontend/env.local.example frontend/.env

# Edit with your API keys
nano backend/.env
nano frontend/.env
```

### 3. Start the Application
```bash
# Using Docker (Recommended)
./start-local.sh

# OR Development Mode
./start-dev.sh
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 📋 Environment Setup

### Backend Environment Variables
```bash
# Required API Keys
OPENAI_API_KEY=your_openai_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
NODE_ENV=development
```

### Frontend Environment Variables
```bash
# Backend API URL
REACT_APP_API_URL=http://localhost:8000

# Supabase Configuration
REACT_APP_SUPABASE_URL=your_supabase_url_here
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Development mode
NODE_ENV=development
```

## 🗄️ Database Setup

### Supabase Tables
Run these SQL commands in your Supabase SQL editor:

```sql
-- Folders Table
CREATE TABLE folders (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations Table
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages Table
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model_name TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (see LOCAL_SETUP.md for complete policies)
```

## 🎯 Usage Guide

### Starting Your First Research
1. **Sign Up/Login**: Create an account or sign in
2. **Create a Folder**: Organize your research topics
3. **Ask a Question**: Enter your research query
4. **Review Results**: Get comprehensive academic reports
5. **Follow Up**: Use AI-generated follow-up questions
6. **Export**: Save your research in multiple formats

### Article Comparison
1. **Navigate to Compare**: Click "Compare Articles" from dashboard
2. **Choose Input Method**: URLs or paste text directly
3. **Set Focus**: Overall, methodology, or findings comparison
4. **Add Context**: Specify your assignment or research focus
5. **Generate Analysis**: Get detailed comparison report

### Organizing Research
- **Drag & Drop**: Move research between folders
- **Color Coding**: Use colored folders for different topics
- **Search**: Find research quickly with the search bar
- **Timeline**: Track your research progress visually

## 🔧 Development

### Project Structure
```
DeepResearch/
├── backend/                 # FastAPI backend
│   ├── main.py             # Main application file
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment variables
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── Dashboard.js    # Main dashboard
│   │   ├── ResearchPage.js # Research interface
│   │   └── ComparisonPage.js # Article comparison
│   ├── package.json       # Node dependencies
│   └── .env              # Frontend environment
├── start-local.sh         # Docker startup script
├── start-dev.sh          # Development startup script
└── LOCAL_SETUP.md        # Detailed setup guide
```

### Available Scripts
```bash
# Development
./start-dev.sh              # Start in development mode
./start-local.sh            # Start with Docker

# Backend
cd backend
python -m uvicorn main:app --reload  # Start backend only

# Frontend
cd frontend
npm start                   # Start frontend only
npm run build              # Build for production
```

### API Endpoints
- `POST /research` - Generate research reports
- `POST /compare-articles` - Compare two articles
- `GET /conversations` - Get user conversations
- `GET /folders` - Get user folders
- `POST /folders` - Create new folder
- `PUT /folders/{id}` - Update folder
- `DELETE /folders/{id}` - Delete folder

## 🛡️ Security

- **Authentication**: JWT-based authentication via Supabase
- **Authorization**: Row Level Security (RLS) for data isolation
- **API Security**: CORS protection and input validation
- **Data Privacy**: User data is isolated and encrypted
- **Environment Variables**: Sensitive data stored securely

## 🚀 Deployment

### Docker Deployment
```bash
# Build and start
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Considerations
- Set up proper environment variables
- Configure CORS for your domain
- Set up SSL certificates
- Configure database backups
- Set up monitoring and logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow React best practices
- Use TypeScript for new components
- Write tests for new features
- Update documentation
- Follow the existing code style

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for GPT-4o API
- **Tavily** for web search capabilities
- **Supabase** for backend infrastructure
- **React** and **FastAPI** communities
- **Tailwind CSS** for styling framework

## 📞 Support

- **Documentation**: Check `LOCAL_SETUP.md` for detailed setup
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact the development team

## 🔮 Roadmap

### Upcoming Features
- [ ] **Collaborative Research**: Share research with team members
- [ ] **Advanced Analytics**: Research insights and trends
- [ ] **Citation Management**: Zotero/Mendeley integration
- [ ] **Research Templates**: Pre-built research frameworks
- [ ] **Mobile App**: iOS and Android applications
- [ ] **AI Research Assistant**: Chat-based research help
- [ ] **Integration APIs**: Connect with academic databases
- [ ] **Research Workflows**: Automated research pipelines

### Version History
- **v1.0.0** - Initial release with core research features
- **v1.1.0** - Added article comparison functionality
- **v1.2.0** - Enhanced organization with drag-and-drop
- **v1.3.0** - Added research tools and analytics

---

**Built with ❤️ for researchers, students, and academics worldwide.**

*Start your research journey with DeepResearch today!*
=======




>>>>>>> main
