# Development Workflow Guide

## Git Workflow

### Branch Naming Convention
```
feature/feature-name      - New features
bugfix/bug-description    - Bug fixes
hotfix/critical-issue     - Production hotfixes
docs/documentation-topic  - Documentation updates
refactor/refactor-scope   - Code refactoring
```

### Commit Message Format
```
[TYPE] Brief description (50 chars max)

Detailed explanation of changes (if needed)
- List specific changes
- One item per line

Fixes #123 (if related to an issue)
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Pull Request Process
1. Create feature branch from `main`
2. Make changes with frequent commits
3. Push to remote and create PR
4. Request review from team member
5. Address review comments
6. Merge when approved

## Development Steps

### 1. Adding a New Endpoint

**File:** `src/routes/[module].js`

```javascript
const express = require('express');
const router = express.Router();

// GET /api/[module]/[resource]
router.get('/[resource]', (req, res) => {
  try {
    // Implementation
    res.json({
      success: true,
      data: { /* your data */ },
      message: 'Success message'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'ERROR_CODE',
      message: error.message
    });
  }
});

module.exports = router;
```

**File:** `src/app.js`

```javascript
const moduleRoutes = require('./routes/module');
app.use('/api/module', moduleRoutes);
```

### 2. Updating Swagger Documentation

**File:** `src/docs/swagger.json`

```json
{
  "paths": {
    "/api/module/resource": {
      "get": {
        "tags": ["Module"],
        "summary": "Get resource",
        "parameters": [],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ResourceResponse"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "ResourceResponse": {
        "type": "object",
        "properties": {
          "success": { "type": "boolean" },
          "data": { "type": "object" }
        }
      }
    }
  }
}
```

### 3. Database Changes

**Step 1:** Create migration file
```
migrations/YYYY-MM-DD-HHmmss_description.sql
```

**Step 2:** Write SQL migration

**Step 3:** Update `DATABASE_SCHEMA.md`

**Step 4:** Run migration locally

```bash
npm run db:migrate
```

### 4. Testing an Endpoint

Use REST client or cURL:

```bash
curl -X GET http://localhost:3000/api/endpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or use Swagger UI at: `http://localhost:3000/api-docs`

## Code Quality Standards

### Naming Conventions
- **Files:** `camelCase.js`
- **Variables/Functions:** `camelCase`
- **Classes/Constructors:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Database columns:** `snake_case`

### Error Handling
```javascript
try {
  // Operation
} catch (error) {
  console.error('Context:', error);
  res.status(500).json({
    success: false,
    error: 'ERROR_CODE',
    message: 'User-friendly message'
  });
}
```

### Validation
```javascript
// Input validation
if (!email || !email.includes('@')) {
  return res.status(400).json({
    success: false,
    error: 'INVALID_INPUT',
    message: 'Email is required and must be valid'
  });
}
```

### Comments
```javascript
// Use for complex logic or important context
// Keep comments concise and helpful

/**
 * Function description
 * @param {type} paramName - Parameter description
 * @returns {type} Return description
 */
function myFunction(paramName) {
  // Implementation
}
```

## Testing Checklist

Before committing:
- [ ] Code runs without errors
- [ ] API returns correct response format
- [ ] Error handling works
- [ ] Swagger docs updated
- [ ] Database changes tested
- [ ] No console.log left (use proper logging)
- [ ] Follows naming conventions

## Deployment Checklist

Before deploying to production:
- [ ] All tests pass
- [ ] PR reviewed and approved
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] No sensitive data in code
- [ ] API documentation updated
- [ ] Performance tested

## Environment Setup

### Local Development
```bash
npm install
cp .env.example .env.local
npm run dev
```

### Production
```bash
npm install --production
npm run build
vercel deploy
```

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
npm run db:test

# Check env variables
echo $DATABASE_URL
```

### Port Already in Use
```bash
# Find process on port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Dependency Issues
```bash
rm -rf node_modules package-lock.json
npm install
```
