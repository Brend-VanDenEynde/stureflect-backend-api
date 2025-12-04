"""markdown
# StuReflect Backend API - Setup Instructions

## Project Overview
StuReflect is an AI-driven classroom dashboard that provides real-time insights into programming students' progress through GitHub integration and automated code analysis.

## Prerequisites
- Node.js (v16+)
- PostgreSQL (or Neon account for serverless)
- GitHub OAuth credentials
- OpenAI API key
- Vercel account (for deployment)

## Initial Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root directory:
```
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# GitHub Integration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Server
PORT=3000
NODE_ENV=development
```

### 3. Database Setup
```bash
npm run db:setup
```

### 4. Start Development Server
```bash
npm run dev
```

Server will run on `http://localhost:3000`

## Project Structure
```
src/
├── app.js              # Main Express app
├── config/
│   └── db.js          # Database configuration
├── routes/
│   └── general.js     # General routes
└── docs/
    └── swagger.json   # API documentation
```

## Development Workflow

1. **Create new routes** in `src/routes/`
2. **Update Swagger docs** in `src/docs/swagger.json`
3. **Test endpoints** using the Swagger UI at `/api-docs`
4. **Commit changes** with clear messages

## Key Technologies
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (Neon serverless)
- **AI:** OpenAI API
- **Deployment:** Vercel
- **Documentation:** Swagger/OpenAPI

## Deployment
```bash
npm run build
vercel deploy
```

## Support
For questions or issues, refer to the project documentation or contact the development team.
"""