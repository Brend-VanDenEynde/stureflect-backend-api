"""markdown
# API Development Guide

## Authentication Endpoints

### GitHub OAuth Flow
- **POST** `/api/auth/github` - Initiate GitHub login
- **GET** `/api/auth/github/callback` - GitHub OAuth callback
- **POST** `/api/auth/logout` - Logout user

## Teacher Endpoints

### Dashboard & Analytics
- **GET** `/api/teachers/dashboard` - Main dashboard data
- **GET** `/api/teachers/classes` - List all classes
- **POST** `/api/teachers/classes` - Create new class
- **GET** `/api/teachers/classes/:classId` - Get class details
- **GET** `/api/teachers/classes/:classId/students` - List students in class
- **GET** `/api/teachers/classes/:classId/analytics` - Class analytics & trends

### Student Progress
- **GET** `/api/teachers/students/:studentId` - Student profile
- **GET** `/api/teachers/students/:studentId/progress` - Student progress overview
- **GET** `/api/teachers/students/:studentId/submissions` - Student code submissions
- **GET** `/api/teachers/students/:studentId/feedback` - AI feedback history

## Student Endpoints

### GitHub Integration
- **POST** `/api/students/repositories` - Link GitHub repository
- **GET** `/api/students/repositories` - List linked repositories
- **DELETE** `/api/students/repositories/:repoId` - Unlink repository

### Submissions & Feedback
- **GET** `/api/students/submissions` - List user submissions
- **GET** `/api/students/submissions/:submissionId` - Get submission details
- **GET** `/api/students/feedback` - List all received feedback
- **GET** `/api/students/feedback/:feedbackId` - Get specific feedback

### Profile
- **GET** `/api/students/profile` - Get user profile
- **PUT** `/api/students/profile` - Update profile
- **GET** `/api/students/statistics` - Personal learning statistics

## Code Analysis Endpoints

### Analysis Results
- **POST** `/api/analysis/analyze` - Trigger code analysis
- **GET** `/api/analysis/results/:submissionId` - Get analysis results
- **POST** `/api/analysis/feedback` - Generate AI feedback

## Admin Endpoints

### System Management
- **GET** `/api/admin/analytics` - Platform-wide analytics
- **GET** `/api/admin/users` - List all users
- **GET** `/api/admin/classes` - List all classes
- **PUT** `/api/admin/settings` - Update platform settings

## Webhook Endpoints

### GitHub Webhooks
- **POST** `/api/webhooks/github` - Handle GitHub push events
- **POST** `/api/webhooks/github/pull-request` - Handle PR events

## Response Format

All API responses follow this format:
```json
{
  "success": true,
  "data": {},
  "message": "Optional success message",
  "error": null
}
```

Error responses:
```json
{
  "success": false,
  "data": null,
  "message": "Error message",
  "error": "ERROR_CODE"
}
```

## Status Codes
- **200** - OK
- **201** - Created
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **500** - Server Error

## Implementation Priority

**Phase 1 (MVP):**
1. Authentication (GitHub OAuth)
2. GitHub integration (repository linking)
3. Basic code analysis
4. Student feedback endpoints
5. Teacher dashboard (basic)

**Phase 2:**
1. Advanced analytics
2. Webhook processing
3. Historical tracking
4. Class management

**Phase 3:**
1. Admin panel
2. Advanced AI features
3. Performance optimization
4. Additional integrations

"""