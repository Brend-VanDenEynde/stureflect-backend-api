const express = require('express');
const router = express.Router();
const {
  verifyWebhookSignature,
  findSubmissionByRepo,
  updateSubmissionStatus,
  tryStartProcessing,
  getCourseSettings,
  logWebhookEvent,
  saveFeedback,
  updateSubmissionWithScore,
  markSubmissionFailed,
  getFailedSubmissions,
  getSubmissionForRetry
} = require('../controllers/webhookController');
const {
  parseGitHubUrl,
  getRepositoryTree,
  getMultipleFileContents,
  filterCodeFiles
} = require('../services/githubService');
const {
  analyzeFiles,
  calculateScore,
  logAIEvent
} = require('../services/aiService');
const {
  withRetry,
  isGitHubRetryable,
  isOpenAIRetryable
} = require('../utils/retry');

/**
 * Process een submission (herbruikbaar voor webhook en retry)
 * @param {object} submission - Submission object
 * @param {string} commitSha - Commit SHA
 * @param {string} branch - Branch naam
 * @param {string} repoFullName - Repository full name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function processSubmission(submission, commitSha, branch, repoFullName) {
  try {
    // Atomic check: probeer processing te starten (voorkomt race condition)
    const startResult = await tryStartProcessing(submission.id, commitSha, branch);

    if (!startResult.success) {
      if (startResult.alreadyProcessing) {
        logWebhookEvent('push', repoFullName, 'skipped', 'Already processing');
        return { success: false, error: 'Already processing', skipped: true };
      }
      return { success: false, error: 'Could not start processing' };
    }

    // Haal course settings op voor AI context
    const courseSettings = await getCourseSettings(submission.course_id);

    // Parse repository info
    const repoInfo = parseGitHubUrl(`https://github.com/${repoFullName}`);
    if (!repoInfo) {
      await markSubmissionFailed(submission.id, commitSha, 'Could not parse repository URL', 'INVALID_URL');
      return { success: false, error: 'Invalid repository URL' };
    }

    // Haal alle bestanden op uit repository (niet alleen commit diff)
    let treeResult;
    try {
      treeResult = await withRetry(
        () => getRepositoryTree(repoInfo.owner, repoInfo.repo, commitSha),
        {
          maxRetries: 3,
          initialDelay: 2000,
          shouldRetry: (error) => isGitHubRetryable(error),
          onRetry: (error, attempt, delay) => {
            logWebhookEvent('push', repoFullName, 'retry', `GitHub API retry ${attempt}, waiting ${delay}ms`);
          }
        }
      );
    } catch (error) {
      await markSubmissionFailed(submission.id, commitSha, `GitHub API error: ${error.message}`, 'GITHUB_ERROR');
      return { success: false, error: 'GitHub API error' };
    }

    if (!treeResult.success) {
      await markSubmissionFailed(submission.id, commitSha, treeResult.error, treeResult.errorCode || 'GITHUB_ERROR');
      return { success: false, error: treeResult.error };
    }

    // Filter alleen code bestanden
    const codeFiles = filterCodeFiles(treeResult.files);

    if (codeFiles.length === 0) {
      await updateSubmissionStatus(submission.id, commitSha, 'completed', branch);
      logWebhookEvent('push', repoFullName, 'info', 'No code files to analyze');
      return { success: true, message: 'No code files to analyze' };
    }

    logWebhookEvent('push', repoFullName, 'info', `Code files to analyze: ${codeFiles.length}`);

    // Haal file contents op (max 20 bestanden, met retry)
    const filesToFetch = codeFiles.slice(0, 20).map(f => f.path);
    let fileContents;
    try {
      fileContents = await withRetry(
        () => getMultipleFileContents(repoInfo.owner, repoInfo.repo, filesToFetch, commitSha),
        {
          maxRetries: 2,
          initialDelay: 1000,
          shouldRetry: (error) => isGitHubRetryable(error),
          onRetry: (error, attempt) => {
            logWebhookEvent('push', repoFullName, 'retry', `File contents retry ${attempt}`);
          }
        }
      );
    } catch (error) {
      await markSubmissionFailed(submission.id, commitSha, `Failed to fetch file contents: ${error.message}`, 'FILE_FETCH_ERROR');
      return { success: false, error: 'Failed to fetch files' };
    }

    const validFiles = fileContents.filter(f => f.content !== null);
    logWebhookEvent('push', repoFullName, 'info', `Files retrieved: ${validFiles.length}/${filesToFetch.length}`);

    if (validFiles.length === 0) {
      await markSubmissionFailed(submission.id, commitSha, 'No file contents could be retrieved', 'NO_FILES');
      return { success: false, error: 'No file contents' };
    }

    // AI analyse (met retry)
    logAIEvent('start', `Analyseer ${validFiles.length} bestanden voor ${repoFullName}`);

    let analysisResult;
    try {
      analysisResult = await withRetry(
        () => analyzeFiles(validFiles, courseSettings),
        {
          maxRetries: 2,
          initialDelay: 3000,
          maxDelay: 15000,
          shouldRetry: (error) => isOpenAIRetryable(error),
          onRetry: (error, attempt, delay) => {
            logAIEvent('retry', `OpenAI retry ${attempt}, waiting ${delay}ms: ${error.message}`);
          }
        }
      );
    } catch (error) {
      await markSubmissionFailed(submission.id, commitSha, `AI analysis error: ${error.message}`, 'AI_ERROR');
      return { success: false, error: 'AI analysis failed' };
    }

    if (!analysisResult.success) {
      await markSubmissionFailed(submission.id, commitSha, 'AI analysis returned failure', 'AI_ANALYSIS_FAILED');
      return { success: false, error: 'AI analysis failed' };
    }

    // Bereken score en sla feedback op
    const aiScore = calculateScore(analysisResult.feedback);
    logAIEvent('complete', `${analysisResult.summary.total_feedback} feedback items, score: ${aiScore}`);

    const savedFeedback = await saveFeedback(submission.id, analysisResult.feedback);
    logWebhookEvent('push', repoFullName, 'info', `Feedback saved: ${savedFeedback.length} items`);

    // Update submission met score
    await updateSubmissionWithScore(submission.id, commitSha, aiScore, 'analyzed');

    logWebhookEvent('push', repoFullName, 'success', `Analysis complete - score: ${aiScore}`);
    return { success: true, score: aiScore, feedbackCount: savedFeedback.length };

  } catch (error) {
    console.error('[API] Process error:', error.message);
    try {
      await markSubmissionFailed(submission.id, commitSha, error.message, 'PROCESS_ERROR');
    } catch (updateError) {
      console.error('[API] Could not update submission status:', updateError.message);
    }
    return { success: false, error: error.message };
  }
}

/**
 * @swagger
 * /api/webhooks/github:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: GitHub Webhook Handler
 *     description: |
 *       Ontvangt push events van GitHub en start automatische AI code analyse.
 *       Dit endpoint wordt aangeroepen door GitHub wanneer er naar een repository wordt gepusht.
 *
 *       **Belangrijk:** Dit endpoint wordt NIET direct door de frontend aangeroepen.
 *       Het wordt automatisch getriggerd door GitHub na registratie via POST /submissions.
 *
 *       **Flow:**
 *       1. Valideer request (payload, signature header, event type, branch)
 *       2. Stuur 202 Accepted response (async verwerking)
 *       3. Zoek bijbehorende submission in database
 *       4. Verifieer webhook signature met submission-specifieke secret
 *       5. Haal ALLE code bestanden op uit repository (niet alleen commit diff)
 *       6. Analyseer code met AI (GPT-5 mini)
 *       7. Sla feedback en score op
 *
 *       **Race condition preventie:** Bij gelijktijdige pushes wordt slechts één
 *       analyse tegelijk uitgevoerd per submission (atomic lock).
 *     parameters:
 *       - in: header
 *         name: X-GitHub-Event
 *         required: true
 *         schema:
 *           type: string
 *           enum: [push, ping]
 *         description: Type GitHub event (alleen push events worden verwerkt)
 *       - in: header
 *         name: X-Hub-Signature-256
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC-SHA256 signature voor verificatie
 *       - in: header
 *         name: X-GitHub-Delivery
 *         schema:
 *           type: string
 *         description: Unieke delivery ID van GitHub
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ref:
 *                 type: string
 *                 example: refs/heads/main
 *                 description: Git ref (branch) waar naar gepusht is
 *               after:
 *                 type: string
 *                 example: abc123def456
 *                 description: Commit SHA na de push
 *               repository:
 *                 type: object
 *                 properties:
 *                   full_name:
 *                     type: string
 *                     example: username/repository
 *               commits:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Event ontvangen maar overgeslagen (geen push, geen branch, geen commits)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received:
 *                   type: boolean
 *                   example: true
 *                 skipped:
 *                   type: string
 *                   example: Not a push event
 *       202:
 *         description: Push event geaccepteerd, analyse gestart (async)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received:
 *                   type: boolean
 *                   example: true
 *                 delivery_id:
 *                   type: string
 *                   example: abc-123-def
 *                 processing:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Ongeldige request (geen payload)
 *       401:
 *         description: Ontbrekende signature header
 */
router.post('/github', async (req, res) => {
  const event = req.headers['x-github-event'];
  const signature = req.headers['x-hub-signature-256'];
  const deliveryId = req.headers['x-github-delivery'];
  const payload = req.rawBody;
  const data = req.body;

  // === SYNC VALIDATIE (vóór response) ===

  // Check of rawBody beschikbaar is (nodig voor signature verificatie)
  if (!payload) {
    console.error('[API] rawBody not available - webhook signature cannot be verified');
    return res.status(400).json({ error: 'Invalid request' });
  }

  // Check of signature header aanwezig is
  if (!signature) {
    console.warn('[API] Missing X-Hub-Signature-256 header');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const repoFullName = data.repository?.full_name || 'unknown';
  logWebhookEvent(event, repoFullName, 'received', `Delivery: ${deliveryId}`);

  // Alleen push events verwerken
  if (event !== 'push') {
    logWebhookEvent(event, repoFullName, 'skipped', 'Not a push event');
    return res.status(200).json({ received: true, skipped: 'Not a push event' });
  }

  // Check of ref een branch is (niet een tag of PR)
  if (!data.ref?.startsWith('refs/heads/')) {
    logWebhookEvent(event, repoFullName, 'skipped', `Not a branch push: ${data.ref}`);
    return res.status(200).json({ received: true, skipped: 'Not a branch push' });
  }

  // Check of er een commit SHA is (force push kan lege commits array hebben)
  if (!data.after || data.after === '0000000000000000000000000000000000000000') {
    logWebhookEvent(event, repoFullName, 'skipped', 'Branch deleted or no commits');
    return res.status(200).json({ received: true, skipped: 'No commits' });
  }

  const branch = data.ref.replace('refs/heads/', '');
  const latestCommitSha = data.after;

  // === RESPONSE + ASYNC PROCESSING ===
  // Nu pas 202 Accepted sturen - we weten dat het een geldige push event is
  res.status(202).json({ received: true, delivery_id: deliveryId, processing: true });

  try {
    // Zoek submission
    const submission = await findSubmissionByRepo(repoFullName, branch);
    if (!submission) {
      logWebhookEvent(event, repoFullName, 'skipped', `No submission for branch: ${branch}`);
      return;
    }

    // Valideer signature met submission-specifieke secret
    if (!verifyWebhookSignature(payload, signature, submission.webhook_secret)) {
      logWebhookEvent(event, repoFullName, 'error', 'Invalid signature');
      return;
    }

    logWebhookEvent(event, repoFullName, 'processing', `Branch: ${branch}, Commit: ${latestCommitSha.substring(0, 7)}`);

    // Process de submission
    await processSubmission(submission, latestCommitSha, branch, repoFullName);

  } catch (error) {
    console.error('[API] Webhook error:', error.message);
    logWebhookEvent('push', repoFullName, 'error', error.message);
  }
});

/**
 * @swagger
 * /api/webhooks/retry/{submissionId}:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Retry een gefaalde submission
 *     description: |
 *       Start de AI analyse opnieuw voor een submission die eerder is mislukt.
 *       Verwerking gebeurt asynchroon - response wordt direct teruggegeven.
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de submission om opnieuw te analyseren
 *     responses:
 *       202:
 *         description: Retry gestart (verwerking is async)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Retry started
 *                 data:
 *                   type: object
 *                   properties:
 *                     submission_id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       example: processing
 *       400:
 *         description: Ongeldig submission ID of submission wordt al verwerkt
 *       404:
 *         description: Submission niet gevonden
 */
router.post('/retry/:submissionId', async (req, res) => {
  try {
    const submissionId = parseInt(req.params.submissionId);

    if (isNaN(submissionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid submission ID'
      });
    }

    // Haal submission op
    const submission = await getSubmissionForRetry(submissionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found'
      });
    }

    // Check of submission retry mag (alle statussen behalve 'processing' - dat loopt nog)
    // We staan ook 'analyzed' toe voor het geval iemand opnieuw wil analyseren
    const nonRetryableStatuses = ['processing'];
    if (nonRetryableStatuses.includes(submission.status)) {
      return res.status(400).json({
        success: false,
        error: `Submission is currently being processed, please wait`
      });
    }

    // Parse repo info
    const repoInfo = parseGitHubUrl(submission.github_url);
    if (!repoInfo) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GitHub URL in submission'
      });
    }

    const repoFullName = `${repoInfo.owner}/${repoInfo.repo}`;
    const branch = submission.branch || 'main';
    const commitSha = submission.commit_sha;

    logWebhookEvent('retry', repoFullName, 'start', `Retry submission ${submissionId}`);

    // Start retry - response eerst, dan async processing
    res.status(202).json({
      success: true,
      message: 'Retry started',
      data: {
        submission_id: submissionId,
        status: 'processing'
      }
    });

    // Process async (na response)
    try {
      const result = await processSubmission(submission, commitSha, branch, repoFullName);

      if (result.success) {
        logWebhookEvent('retry', repoFullName, 'success', `Retry complete - score: ${result.score}`);
      } else {
        logWebhookEvent('retry', repoFullName, 'failed', result.error);
      }
    } catch (processError) {
      // Log error maar stuur geen response (al verzonden)
      console.error('[API] Retry process error:', processError.message);
      logWebhookEvent('retry', repoFullName, 'error', processError.message);
    }

  } catch (error) {
    // Deze catch is voor errors VOOR de response
    console.error('[API] Retry error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

/**
 * @swagger
 * /api/webhooks/failed:
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: Haal gefaalde submissions op
 *     description: Retourneert alle submissions met status 'failed' binnen een bepaalde periode
 *     parameters:
 *       - in: query
 *         name: maxAge
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Maximum leeftijd in uren (default 24 uur)
 *     responses:
 *       200:
 *         description: Lijst met gefaalde submissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 3
 *                     submissions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Submission'
 *       500:
 *         description: Server error
 */
router.get('/failed', async (req, res) => {
  try {
    const maxAge = parseInt(req.query.maxAge) || 24;
    const failed = await getFailedSubmissions(maxAge);

    res.json({
      success: true,
      data: {
        count: failed.length,
        submissions: failed
      }
    });
  } catch (error) {
    console.error('[API] Failed list error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve submissions'
    });
  }
});

/**
 * @swagger
 * /api/webhooks/health:
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: Health check voor webhook service
 *     description: Controleert of de webhook service operationeel is
 *     responses:
 *       200:
 *         description: Service is gezond
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * @swagger
 * /api/webhooks/test:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Direct test endpoint voor AI analyse
 *     description: |
 *       Test de AI code analyse direct op een GitHub repository zonder database of webhook.
 *       Handig voor development en debugging.
 *
 *       **Let op:** Dit endpoint slaat geen data op in de database.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - github_url
 *             properties:
 *               github_url:
 *                 type: string
 *                 format: uri
 *                 example: https://github.com/username/repository
 *                 description: GitHub repository URL om te analyseren
 *     responses:
 *       200:
 *         description: Analyse succesvol
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     repository:
 *                       type: string
 *                       example: username/repository
 *                     commit:
 *                       type: string
 *                       example: abc1234
 *                     files_analyzed:
 *                       type: integer
 *                       example: 5
 *                     score:
 *                       type: integer
 *                       example: 85
 *                     feedback:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Feedback'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_files:
 *                           type: integer
 *                         total_feedback:
 *                           type: integer
 *                         by_severity:
 *                           type: object
 *       400:
 *         description: Ongeldige GitHub URL of geen code bestanden gevonden
 *       500:
 *         description: AI analyse mislukt
 */
router.post('/test', async (req, res) => {
  const { github_url } = req.body;

  if (!github_url) {
    return res.status(400).json({ success: false, error: 'github_url required' });
  }

  const repoInfo = parseGitHubUrl(github_url);
  if (!repoInfo) {
    return res.status(400).json({ success: false, error: 'Invalid GitHub URL' });
  }

  const repoFullName = `${repoInfo.owner}/${repoInfo.repo}`;
  logWebhookEvent('test', repoFullName, 'start', 'Direct test');

  try {
    const { getLatestCommitSha, getRepositoryTree } = require('../services/githubService');

    // Get latest commit
    const commitResult = await getLatestCommitSha(repoInfo.owner, repoInfo.repo);
    if (!commitResult.success) {
      return res.status(400).json({ success: false, error: commitResult.error });
    }

    // Get files
    const treeResult = await getRepositoryTree(repoInfo.owner, repoInfo.repo, commitResult.sha);
    if (!treeResult.success) {
      return res.status(400).json({ success: false, error: treeResult.error });
    }

    const codeFiles = filterCodeFiles(treeResult.files).slice(0, 10);
    if (codeFiles.length === 0) {
      return res.status(400).json({ success: false, error: 'No code files found' });
    }

    // Get contents
    const fileContents = await getMultipleFileContents(repoInfo.owner, repoInfo.repo, codeFiles.map(f => f.path), commitResult.sha);
    const validFiles = fileContents.filter(f => f.content);

    if (validFiles.length === 0) {
      return res.status(400).json({ success: false, error: 'Could not read files' });
    }

    // AI analysis
    logAIEvent('start', `Test: ${validFiles.length} files`);
    const analysisResult = await analyzeFiles(validFiles, null);

    if (!analysisResult.success) {
      return res.status(500).json({ success: false, error: 'AI analysis failed' });
    }

    const score = calculateScore(analysisResult.feedback);
    logWebhookEvent('test', repoFullName, 'success', `Score: ${score}`);

    res.json({
      success: true,
      data: {
        repository: repoFullName,
        commit: commitResult.sha.substring(0, 7),
        files_analyzed: validFiles.length,
        score,
        feedback: analysisResult.feedback,
        summary: analysisResult.summary
      }
    });
  } catch (error) {
    console.error('[API] Test error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
