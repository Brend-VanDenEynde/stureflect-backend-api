# GitHub Integration Guide

## Overview
StuReflect integrates with GitHub to automatically analyze student code on every push and provide AI-driven feedback.

## GitHub OAuth Setup

### 1. Create GitHub OAuth App
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth Application
3. Set:
   - **Application name:** StuReflect
   - **Homepage URL:** `https://yourdomain.com`
   - **Authorization callback URL:** `https://yourdomain.com/api/auth/github/callback`
4. Copy Client ID and Client Secret to `.env.local`

### 2. Webhook Configuration
1. Go to your GitHub repository settings → Webhooks
2. Add webhook:
   - **Payload URL:** `https://yourdomain.com/api/webhooks/github`
   - **Content type:** application/json
   - **Events:** Push, Pull Request
   - **Secret:** Set and save to `.env.local` as `GITHUB_WEBHOOK_SECRET`

## API Implementation

### Authentication Endpoints

**POST** `/api/auth/github`
```bash
curl -X POST http://localhost:3000/api/auth/github \
  -H "Content-Type: application/json" \
  -d '{ "code": "github_oauth_code" }'
```

Response:
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "github_username": "octocat",
    "token": "jwt_token"
  },
  "message": "Successfully authenticated with GitHub"
}
```

**GET** `/api/auth/github/callback?code=CODE&state=STATE`
- Handles GitHub OAuth callback
- Creates/updates user record
- Returns redirect to frontend with auth token

### Repository Linking

**POST** `/api/students/repositories`
```bash
curl -X POST http://localhost:3000/api/students/repositories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_TOKEN" \
  -d '{
    "repo_url": "https://github.com/username/repo",
    "class_id": "uuid"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "repository_id": "uuid",
    "repo_name": "repo",
    "repo_owner": "username",
    "linked_at": "2025-12-04T10:30:00Z"
  }
}
```

**GET** `/api/students/repositories`
- List all linked repositories
- Show webhook status

**DELETE** `/api/students/repositories/:repoId`
- Unlink repository
- Remove webhook

## Webhook Processing

### Push Event Handler

**POST** `/api/webhooks/github`

Handles GitHub push events:

```javascript
router.post('/github', (req, res) => {
  const event = req.headers['x-github-event'];
  const signature = req.headers['x-hub-signature-256'];
  
  // Verify webhook signature
  if (!verifySignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  if (event === 'push') {
    handlePushEvent(req.body);
  } else if (event === 'pull_request') {
    handlePREvent(req.body);
  }
  
  res.json({ success: true });
});
```

### Data Extracted from Push Event

```json
{
  "repository": {
    "name": "repo_name",
    "full_name": "owner/repo",
    "id": 123456
  },
  "pusher": {
    "name": "username"
  },
  "commits": [
    {
      "id": "commit_hash",
      "message": "commit message",
      "timestamp": "2025-12-04T10:30:00Z",
      "author": { "name": "Name" }
    }
  ],
  "ref": "refs/heads/main"
}
```

## Code Analysis Workflow

### 1. Fetch Code from GitHub

```javascript
async function fetchCommitCode(owner, repo, commit_hash) {
  const response = await octokit.repos.getCommit({
    owner,
    repo,
    ref: commit_hash
  });
  
  return response.data.files;
}
```

### 2. Store Submission

```sql
INSERT INTO submissions (
  student_id, repository_id, commit_hash, 
  commit_message, branch, pushed_at
) VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id;
```

### 3. Trigger Analysis

```javascript
async function analyzeSubmission(submissionId, code) {
  // Run static analysis
  const analysis = await runLinting(code);
  
  // Check test coverage
  const coverage = await runTests(code);
  
  // Calculate complexity
  const complexity = calculateComplexity(code);
  
  // Store results
  await storeAnalysis(submissionId, {
    analysis,
    coverage,
    complexity
  });
  
  // Generate AI feedback
  await generateAIFeedback(submissionId);
}
```

### 4. Generate AI Feedback

```javascript
async function generateAIFeedback(submissionId, code, assignment) {
  const analysisData = await getAnalysis(submissionId);
  
  const prompt = `
    Student code from assignment: ${assignment.title}
    Course material: ${assignment.curriculum_content}
    
    Code analysis results:
    ${JSON.stringify(analysisData)}
    
    Provide helpful, curriculum-aligned feedback for the student.
  `;
  
  const feedback = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }]
  });
  
  await storeFeedback(submissionId, feedback.choices[0].message.content);
}
```

## Security Considerations

### Webhook Signature Verification

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${hash}` === signature;
}
```

### Token Management

```javascript
// Store encrypted GitHub tokens
const encryptedToken = encrypt(githubToken, process.env.ENCRYPTION_KEY);
await saveUserToken(userId, encryptedToken);

// Use when fetching code
const token = decrypt(userTokenData.token, process.env.ENCRYPTION_KEY);
const octokit = new Octokit({ auth: token });
```

## Rate Limiting

GitHub API has rate limits:
- **Authenticated:** 5,000 requests/hour
- **Unauthenticated:** 60 requests/hour

Implement queue system for batch operations:

```javascript
const queue = require('bull');
const analysisQueue = new queue('code-analysis', process.env.REDIS_URL);

analysisQueue.process(async (job) => {
  await analyzeSubmission(job.data.submissionId);
});

// Add to queue
await analysisQueue.add({ submissionId: 'uuid' });
```

## Testing GitHub Integration

### Mock Webhook for Local Testing

```bash
# Simulate push event
curl -X POST http://localhost:3000/api/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=mock_signature" \
  -d @mock_webhook_payload.json
```

### Check Webhook Delivery

On GitHub repo settings → Webhooks:
- View recent deliveries
- See request/response data
- Redeliver failed events

## Troubleshooting

### Webhook Not Triggering
- [ ] Webhook URL is correct and public
- [ ] Secret is correctly configured
- [ ] Firewall allows GitHub IPs
- [ ] Check webhook delivery logs

### Analysis Slow
- [ ] Check queue status
- [ ] Review OpenAI API limits
- [ ] Optimize code fetching

### Token Expiration
- [ ] Implement refresh token flow
- [ ] Handle 401 responses gracefully
- [ ] Prompt user to re-authorize
