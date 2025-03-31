# AI Speech Assessment Agent

An interactive voice-based assessment system that evaluates students' understanding through speech recognition and AI analysis.

## Features

- 🎤 Voice-based question answering
- 🧠 AI-powered answer evaluation
- 👁️ Webcam proctoring with object detection
- 📊 Score calculation and feedback generation
- 🗄️ PostgreSQL database integration

## System Architecture
Frontend (React) ← HTTP → Backend (Flask) ←→ Database (PostgreSQL)
↑
AI Evaluation (Groq/Llama)


## Prerequisites

- Python 3.9+
- Node.js 16+
- PostgreSQL
- Groq API key

## Installation

### Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Prerna-lily/AI-Speech-Assessment-Agent.git
   cd AI-Speech-Assessment-Agent
Set up Python environment:


python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
pip install -r requirements.txt
Configure environment variables:
Create .env file in backend directory:


GROQ_API_KEY=your_groq_api_key
DATABASE_URL=postgresql://username:password@localhost:5432/examdb
Initialize database:


psql -U postgres -c "CREATE DATABASE examdb;"
Frontend Setup
Navigate to frontend directory:


cd frontend
Install dependencies:


npm install
Running the Application
Backend Server
bash
Copy
python agent.py
Runs on http://localhost:5000

Frontend Development Server
bash
Copy
npm start
Runs on http://localhost:3000

API Endpoints
Endpoint	Method	Description
/evaluate-answer	POST	Evaluate student answers
/store-exam-result	POST	Store exam results
/extract-keywords	POST	Extract keywords from text


Database Schema

CREATE TABLE exam_results (
    id SERIAL PRIMARY KEY,
    student_name VARCHAR(100),
    subject VARCHAR(100),
    topic TEXT,
    score INTEGER,
    cheated BOOLEAN,
    entry_time TIMESTAMP
);
Configuration
Backend
Modify agent.py for port changes

Edit .env for API keys and DB connection

Frontend
Configure API base URL in src/api.js

Adjust proctoring sensitivity in src/components/WebcamMonitor.js

Troubleshooting
Webcam not working:

Ensure browser permissions

Check console for errors

Speech recognition issues:

Use Chrome/Firefox

Ensure microphone permissions

Database connection problems:

Verify PostgreSQL service is running

Check .env credentials

