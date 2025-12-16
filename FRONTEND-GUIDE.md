# Frontend Integration Guide - StuReflect API

Dit document beschrijft de backend API voor het frontend team.

---

## Inhoudsopgave

1. [Quick Start](#quick-start)
2. [Authentication (GitHub OAuth)](#authentication-github-oauth)
3. [Student API Endpoints](#student-api-endpoints)
4. [Submission & AI Feedback Flow](#submission--ai-feedback-flow)
5. [Response Formats](#response-formats)
6. [Error Handling](#error-handling)

---

## Quick Start

### Base URL
```
Development: http://localhost:3000/api
Production:  https://backend.stureflect.com/api
```

### Authentication Header
```
Authorization: Bearer {accessToken}
```

### Development Shortcut
Tijdens development kun je `?studentId=1` gebruiken om JWT te bypassen:
```
GET /api/students/me/courses?studentId=1
```

---

## Authentication (GitHub OAuth)

### Flow Diagram
```
1. Frontend: Redirect naar /api/auth/github
   ↓
2. GitHub: User autoriseert app
   ↓
3. Backend: Callback ontvangt tokens
   ↓
4. Backend: Redirect naar {FRONTEND_URL}/auth-callback?accessToken=xxx&refreshToken=xxx
   ↓
5. Frontend: Sla tokens op en redirect naar dashboard
```

### Endpoints

#### Start OAuth Login
```
GET /api/auth/github
```
Redirect de user hierheen om de OAuth flow te starten.

#### Token Refresh
```
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "accessToken": "nieuwe_access_token",
  "refreshToken": "nieuwe_refresh_token"
}
```

#### Logout
```
POST /api/auth/logout
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Token Info
| Token | Geldigheid | Gebruik |
|-------|------------|---------|
| Access Token | 15 minuten | Authorization header |
| Refresh Token | 7 dagen | Nieuwe tokens ophalen |

### Frontend Implementatie
```javascript
// 1. Login button
const handleLogin = () => {
  window.location.href = 'http://localhost:3000/api/auth/github';
};

// 2. Callback page (/auth-callback)
const params = new URLSearchParams(window.location.search);
const accessToken = params.get('accessToken');
const refreshToken = params.get('refreshToken');

localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

window.location.href = '/dashboard';

// 3. API calls met token
const fetchCourses = async () => {
  const res = await fetch('/api/students/me/courses', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    }
  });
  return res.json();
};
```

---

## Student API Endpoints

### Cursussen Ophalen
```
GET /api/students/me/courses
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Web Development 101",
      "description": "Introductie webontwikkeling",
      "assignment_count": "5"
    }
  ]
}
```

---

### Opdrachten per Cursus
```
GET /api/students/me/courses/:courseId/assignments
```

**Query Parameters:**
| Param | Type | Default | Opties |
|-------|------|---------|--------|
| status | string | all | `submitted`, `pending`, `all` |
| sortBy | string | due_date | `due_date`, `title`, `created_at` |
| order | string | asc | `asc`, `desc` |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "HTML & CSS Basics",
      "description": "Maak een responsive website",
      "due_date": "2024-01-20T23:59:59Z",
      "submission_status": "submitted"
    }
  ]
}
```

---

### Alle Submissions
```
GET /api/students/me/submissions
```

**Query Parameters:**
| Param | Type | Beschrijving |
|-------|------|--------------|
| courseId | integer | Filter op cursus |
| status | string | `pending`, `processing`, `analyzed`, `failed` |
| branch | string | Filter op branch |

---

### Submission Detail + Feedback
```
GET /api/students/me/submissions/:submissionId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "submission": {
      "id": 123,
      "github_url": "https://github.com/user/repo",
      "commit_sha": "abc123",
      "status": "analyzed",
      "ai_score": 85,
      "created_at": "2024-01-15T10:30:00Z"
    },
    "assignment": {
      "id": 5,
      "title": "Assignment Title"
    },
    "feedback": [...]
  }
}
```

---

### Feedback Ophalen (gefilterd)
```
GET /api/students/me/submissions/:submissionId/feedback
```

**Query Parameters:**
| Param | Type | Default | Opties |
|-------|------|---------|--------|
| reviewer | string | all | `ai`, `teacher`, `all` |
| severity | string | - | `critical`, `high`, `medium`, `low` |

**Response:**
```json
{
  "success": true,
  "data": {
    "submission_id": 123,
    "total_count": 15,
    "feedback": [
      {
        "id": 1,
        "type": "naming",
        "severity": "medium",
        "message": "Variabele 'x' is niet beschrijvend",
        "suggestion": "Gebruik 'userCount' of 'totalItems'",
        "line_number": 42,
        "reviewer": "ai"
      }
    ],
    "summary": {
      "critical": 2,
      "high": 5,
      "medium": 6,
      "low": 2
    }
  }
}
```

---

## Submission & AI Feedback Flow

### Repo Indienen
```
POST /api/students/me/assignments/:assignmentId/submissions
Content-Type: application/json

{
  "github_url": "https://github.com/username/repository"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "status": "pending",
    "github_url": "https://github.com/username/repository",
    "files_count": 12,
    "webhook": {
      "registered": true,
      "webhookId": 12345
    }
  }
}
```

### Wat Gebeurt Er?

```
1. Student submit repo URL
   ↓
2. Backend valideert URL en haalt files op
   ↓
3. Backend registreert webhook op GitHub repo
   ↓
4. Status: "pending" (wacht op push)
   ↓
5. Student pusht code naar repo
   ↓
6. GitHub stuurt webhook naar backend
   ↓
7. Status: "processing" (AI analyseert)
   ↓
8. Status: "analyzed" + feedback + score
```

### Submission Statussen

| Status | Betekenis | Actie Frontend |
|--------|-----------|----------------|
| `pending` | Wacht op push | Toon "Push je code" |
| `processing` | AI analyseert | Toon spinner |
| `analyzed` | Klaar | Toon score + feedback |
| `failed` | Fout opgetreden | Toon retry button |
| `completed` | Geen code files | Toon waarschuwing |

### Polling voor Status Updates

Poll elke 2-3 seconden totdat status != `pending`/`processing`:

```javascript
const pollSubmission = async (submissionId) => {
  const poll = async () => {
    const res = await fetch(`/api/students/me/submissions/${submissionId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { data } = await res.json();

    if (data.submission.status === 'analyzed') {
      // Toon feedback
      displayFeedback(data.feedback);
      return;
    }

    if (data.submission.status === 'failed') {
      // Toon error
      return;
    }

    // Blijf pollen
    setTimeout(poll, 3000);
  };

  poll();
};
```

---

### AI Feedback Structuur

**Severity Levels:**
| Level | Punten Aftrek | Kleur Suggestie |
|-------|---------------|-----------------|
| critical | -20 | Rood |
| high | -10 | Oranje |
| medium | -5 | Geel |
| low | -2 | Grijs |

**Feedback Types:**
- `code_quality` - Algemene codekwaliteit
- `best_practices` - Conventie overtredingen
- `security` - Beveiligingsproblemen
- `performance` - Performance issues
- `maintainability` - Onderhoudbaarheid
- `documentation` - Documentatie
- `error_handling` - Foutafhandeling
- `naming` - Naamgeving
- `structure` - Code structuur

**Score Berekening:**
```
Score = 100 - (critical×20) - (high×10) - (medium×5) - (low×2)
Minimum: 0, Maximum: 100
```

---

## Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Beschrijving",
  "error": null
}
```

### Error Response
```json
{
  "success": false,
  "message": "Foutmelding voor user",
  "error": "ERROR_CODE"
}
```

---

## Error Handling

### HTTP Status Codes
| Code | Betekenis | Frontend Actie |
|------|-----------|----------------|
| 200 | OK | - |
| 201 | Created | - |
| 400 | Bad Request | Toon validatie error |
| 401 | Unauthorized | Redirect naar login |
| 403 | Forbidden | Toon "Geen toegang" |
| 404 | Not Found | Toon "Niet gevonden" |
| 409 | Conflict | Toon "Al ingediend" |
| 429 | Rate Limited | Toon "Probeer later" |
| 500 | Server Error | Toon algemene error |

### Specifieke Error Codes

**Submission errors:**
- `INVALID_URL` - Ongeldige GitHub URL
- `REPO_NOT_FOUND` - Repository bestaat niet
- `ALREADY_SUBMITTED` - Al een submission voor deze opdracht

**Webhook errors:**
- `WEBHOOK_EXISTS` - Webhook al geregistreerd
- `FORBIDDEN` - Geen permissie voor webhook
- `RATE_LIMITED` - GitHub rate limit

---

## Test Endpoint

Voor snel testen zonder volledige OAuth flow:

```
POST /api/webhooks/test
Content-Type: application/json

{
  "github_url": "https://github.com/username/repo"
}
```

Analyseert direct de repo en retourneert feedback (geen database/webhook nodig).

---

## Checklist Frontend Implementatie

### Authentication
- [ ] Login button → redirect naar `/api/auth/github`
- [ ] Callback page → extract tokens uit URL
- [ ] Token storage (localStorage)
- [ ] Token refresh mechanisme
- [ ] Logout functionaliteit

### Dashboard
- [ ] Cursussen ophalen en tonen
- [ ] Opdrachten per cursus
- [ ] Deadline indicators

### Submissions
- [ ] GitHub URL input form
- [ ] Validatie (GitHub URL format)
- [ ] Submit button met loading state
- [ ] Webhook status tonen

### Feedback
- [ ] Status polling (pending → analyzed)
- [ ] Score visualisatie
- [ ] Feedback lijst met severity kleuren
- [ ] Filter op type/severity
- [ ] Retry button voor failed submissions

### Error Handling
- [ ] 401 → Redirect naar login
- [ ] 403 → "Geen toegang" melding
- [ ] 409 → "Al ingediend" melding
- [ ] Algemene error handling

---

## Contact

Vragen? Neem contact op met het backend team.
