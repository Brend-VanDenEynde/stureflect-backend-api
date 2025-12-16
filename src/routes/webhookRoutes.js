const express = require('express');
const router = express.Router();
const {
  verifyWebhookSignature,
  findSubmissionByRepo,
  updateSubmissionStatus,
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
  getCommitFiles,
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
    // Update submission naar processing status
    await updateSubmissionStatus(submission.id, commitSha, 'processing', branch);

    // Haal course settings op voor AI context
    const courseSettings = await getCourseSettings(submission.course_id);

    // Parse repository info
    const repoInfo = parseGitHubUrl(`https://github.com/${repoFullName}`);
    if (!repoInfo) {
      await markSubmissionFailed(submission.id, commitSha, 'Could not parse repository URL', 'INVALID_URL');
      return { success: false, error: 'Invalid repository URL' };
    }

    // Haal gewijzigde bestanden op via GitHub API (met retry)
    let commitResult;
    try {
      commitResult = await withRetry(
        () => getCommitFiles(repoInfo.owner, repoInfo.repo, commitSha),
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

    if (!commitResult.success) {
      await markSubmissionFailed(submission.id, commitSha, commitResult.error, commitResult.errorCode || 'GITHUB_ERROR');
      return { success: false, error: commitResult.error };
    }

    // Filter alleen code bestanden
    const codeFiles = filterCodeFiles(commitResult.files);
    const filesToAnalyze = codeFiles.filter(f => f.status === 'added' || f.status === 'modified');

    if (filesToAnalyze.length === 0) {
      await updateSubmissionStatus(submission.id, commitSha, 'completed', branch);
      logWebhookEvent('push', repoFullName, 'info', 'No code files to analyze');
      return { success: true, message: 'No code files to analyze' };
    }

    logWebhookEvent('push', repoFullName, 'info', `Code files to analyze: ${filesToAnalyze.length}`);

    // Haal file contents op (met retry)
    let fileContents;
    try {
      fileContents = await withRetry(
        () => getMultipleFileContents(repoInfo.owner, repoInfo.repo, filesToAnalyze.map(f => f.path), commitSha),
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
    logWebhookEvent('push', repoFullName, 'info', `Files retrieved: ${validFiles.length}/${filesToAnalyze.length}`);

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
    console.error('[PROCESS ERROR]', error);
    try {
      await markSubmissionFailed(submission.id, commitSha, error.message, 'PROCESS_ERROR');
    } catch (updateError) {
      console.error('[PROCESS ERROR] Could not update submission status:', updateError);
    }
    return { success: false, error: error.message };
  }
}

/**
 * GitHub Webhook Handler
 * POST /api/webhooks/github
 */
router.post('/github', async (req, res) => {
  const event = req.headers['x-github-event'];
  const signature = req.headers['x-hub-signature-256'];
  const deliveryId = req.headers['x-github-delivery'];

  // Altijd 200 teruggeven om retry storm te voorkomen
  res.status(200).json({ received: true, delivery_id: deliveryId });

  try {
    const payload = req.rawBody;
    const data = req.body;

    if (!payload) {
      console.warn('[WEBHOOK] rawBody not available');
    }

    const repoFullName = data.repository?.full_name || 'unknown';
    logWebhookEvent(event, repoFullName, 'received', `Delivery: ${deliveryId}`);

    // Alleen push events verwerken
    if (event !== 'push') {
      logWebhookEvent(event, repoFullName, 'skipped', 'Not a push event');
      return;
    }

    if (!data.commits || data.commits.length === 0) {
      logWebhookEvent(event, repoFullName, 'skipped', 'No commits in push');
      return;
    }

    const branch = data.ref?.replace('refs/heads/', '') || 'main';
    const latestCommitSha = data.after;

    // Zoek submission
    const submission = await findSubmissionByRepo(repoFullName, branch);
    if (!submission) {
      logWebhookEvent(event, repoFullName, 'skipped', `No submission for branch: ${branch}`);
      return;
    }

    // Valideer signature
    if (!verifyWebhookSignature(payload, signature, submission.webhook_secret)) {
      logWebhookEvent(event, repoFullName, 'error', 'Invalid signature');
      return;
    }

    logWebhookEvent(event, repoFullName, 'processing', `Branch: ${branch}, Commit: ${latestCommitSha.substring(0, 7)}`);

    // Process de submission
    await processSubmission(submission, latestCommitSha, branch, repoFullName);

  } catch (error) {
    console.error('[WEBHOOK ERROR]', error);
    logWebhookEvent('push', 'unknown', 'error', error.message);
  }
});

/**
 * Retry een failed submission
 * POST /api/webhooks/retry/:submissionId
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

    // Start retry in background
    res.status(202).json({
      success: true,
      message: 'Retry started',
      data: {
        submission_id: submissionId,
        status: 'processing'
      }
    });

    // Process async
    const result = await processSubmission(submission, commitSha, branch, repoFullName);

    if (result.success) {
      logWebhookEvent('retry', repoFullName, 'success', `Retry complete - score: ${result.score}`);
    } else {
      logWebhookEvent('retry', repoFullName, 'failed', result.error);
    }

  } catch (error) {
    console.error('[RETRY ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Haal failed submissions op
 * GET /api/webhooks/failed
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
    console.error('[FAILED LIST ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve submissions'
    });
  }
});

/**
 * Health check endpoint
 * GET /api/webhooks/health
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

module.exports = router;
