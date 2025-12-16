const express = require('express');
const router = express.Router();
const {
  verifyWebhookSignature,
  findSubmissionByRepo,
  updateSubmissionStatus,
  getCourseSettings,
  logWebhookEvent,
  saveFeedback,
  updateSubmissionWithScore
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

/**
 * GitHub Webhook Handler
 * POST /api/webhooks/github
 *
 * Ontvangt push events van GitHub en triggert AI analyse
 */
router.post('/github', async (req, res) => {
  const event = req.headers['x-github-event'];
  const signature = req.headers['x-hub-signature-256'];
  const deliveryId = req.headers['x-github-delivery'];

  // Altijd 200 teruggeven om retry storm te voorkomen
  // Fouten worden intern afgehandeld
  res.status(200).json({ received: true, delivery_id: deliveryId });

  try {
    // Gebruik raw body voor signature verificatie, parsed body voor data
    const payload = req.rawBody;
    const data = req.body;

    // Valideer dat rawBody beschikbaar is
    if (!payload) {
      console.warn('[WEBHOOK] rawBody not available - middleware may not be configured correctly');
    }

    // Log inkomende webhook
    const repoFullName = data.repository?.full_name || 'unknown';
    logWebhookEvent(event, repoFullName, 'received', `Delivery: ${deliveryId}`);

    // Alleen push events verwerken
    if (event !== 'push') {
      logWebhookEvent(event, repoFullName, 'skipped', 'Not a push event');
      return;
    }

    // Check of er commits zijn
    if (!data.commits || data.commits.length === 0) {
      logWebhookEvent(event, repoFullName, 'skipped', 'No commits in push');
      return;
    }

    // Zoek bijbehorende submission
    const submission = await findSubmissionByRepo(repoFullName);

    if (!submission) {
      logWebhookEvent(event, repoFullName, 'skipped', 'No matching submission found');
      return;
    }

    // Valideer webhook signature
    if (!verifyWebhookSignature(payload, signature, submission.webhook_secret)) {
      logWebhookEvent(event, repoFullName, 'error', 'Invalid webhook signature');
      return;
    }

    // Haal laatste commit SHA
    const latestCommitSha = data.after;
    const branch = data.ref?.replace('refs/heads/', '') || 'unknown';

    logWebhookEvent(event, repoFullName, 'processing', `Branch: ${branch}, Commit: ${latestCommitSha.substring(0, 7)}`);

    // Update submission naar processing status
    await updateSubmissionStatus(submission.id, latestCommitSha, 'processing');

    // Haal course settings op voor AI context
    const courseSettings = await getCourseSettings(submission.course_id);

    // Parse repository info
    const repoInfo = parseGitHubUrl(`https://github.com/${repoFullName}`);
    if (!repoInfo) {
      logWebhookEvent(event, repoFullName, 'error', 'Could not parse repository URL');
      return;
    }

    // Haal gewijzigde bestanden op via GitHub API
    const commitResult = await getCommitFiles(repoInfo.owner, repoInfo.repo, latestCommitSha);
    if (!commitResult.success) {
      logWebhookEvent(event, repoFullName, 'error', `Failed to get commit files: ${commitResult.error}`);
      await updateSubmissionStatus(submission.id, latestCommitSha, 'failed');
      return;
    }

    // Filter alleen code bestanden (geen node_modules, lock files, etc.)
    const codeFiles = filterCodeFiles(commitResult.files);

    // Filter alleen added en modified bestanden (niet removed)
    const filesToAnalyze = codeFiles.filter(f => f.status === 'added' || f.status === 'modified');

    if (filesToAnalyze.length === 0) {
      logWebhookEvent(event, repoFullName, 'skipped', 'No code files to analyze in commit');
      await updateSubmissionStatus(submission.id, latestCommitSha, 'completed');
      return;
    }

    logWebhookEvent(event, repoFullName, 'info', `Code files to analyze: ${filesToAnalyze.length}`);

    // Haal file contents op
    const filePaths = filesToAnalyze.map(f => f.path);
    const fileContents = await getMultipleFileContents(
      repoInfo.owner,
      repoInfo.repo,
      filePaths,
      latestCommitSha
    );

    // Filter bestanden die succesvol opgehaald zijn
    const validFiles = fileContents.filter(f => f.content !== null);
    logWebhookEvent(event, repoFullName, 'info', `Files retrieved successfully: ${validFiles.length}/${filesToAnalyze.length}`);

    if (validFiles.length === 0) {
      logWebhookEvent(event, repoFullName, 'error', 'No file contents could be retrieved');
      await updateSubmissionStatus(submission.id, latestCommitSha, 'failed');
      return;
    }

    // Checkpoint 3: AI analyse triggeren
    logAIEvent('start', `Analyseer ${validFiles.length} bestanden voor ${repoFullName}`);

    const analysisResult = await analyzeFiles(validFiles, courseSettings);

    if (!analysisResult.success) {
      logWebhookEvent(event, repoFullName, 'error', 'AI analysis failed');
      await updateSubmissionStatus(submission.id, latestCommitSha, 'failed');
      return;
    }

    // Bereken AI score
    const aiScore = calculateScore(analysisResult.feedback);

    logAIEvent('complete', `${analysisResult.summary.total_feedback} feedback items, score: ${aiScore}`);
    logWebhookEvent(event, repoFullName, 'info', `AI analysis complete: ${analysisResult.summary.total_feedback} feedback items, score: ${aiScore}`);

    // Checkpoint 4: Feedback opslaan in database
    const savedFeedback = await saveFeedback(submission.id, analysisResult.feedback);
    logWebhookEvent(event, repoFullName, 'info', `Feedback saved: ${savedFeedback.length} items`);

    // Update submission met AI score en status
    await updateSubmissionWithScore(submission.id, latestCommitSha, aiScore, 'analyzed');

    logWebhookEvent(event, repoFullName, 'success', `Analysis complete - score: ${aiScore}, feedback items: ${savedFeedback.length}`);

  } catch (error) {
    console.error('[WEBHOOK ERROR]', error);
    logWebhookEvent('push', 'unknown', 'error', error.message);
  }
});

/**
 * Health check endpoint voor webhook
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
