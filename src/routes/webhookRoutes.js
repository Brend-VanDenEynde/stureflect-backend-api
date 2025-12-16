const express = require('express');
const router = express.Router();
const {
  verifyWebhookSignature,
  findSubmissionByRepo,
  updateSubmissionStatus,
  getCourseSettings,
  logWebhookEvent
} = require('../controllers/webhookController');

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

    // Verzamel gewijzigde bestanden uit commits
    const changedFiles = new Set();
    for (const commit of data.commits) {
      (commit.added || []).forEach(file => changedFiles.add({ path: file, status: 'added' }));
      (commit.modified || []).forEach(file => changedFiles.add({ path: file, status: 'modified' }));
    }

    logWebhookEvent(event, repoFullName, 'info', `Changed files: ${changedFiles.size}`);

    // TODO: Checkpoint 2 - Gewijzigde bestanden ophalen via GitHub API
    // TODO: Checkpoint 3 - AI analyse triggeren
    // TODO: Checkpoint 4 - Feedback opslaan

    // Tijdelijk: markeer als completed (wordt vervangen in checkpoint 3)
    await updateSubmissionStatus(submission.id, latestCommitSha, 'pending');

    logWebhookEvent(event, repoFullName, 'success', 'Webhook processed successfully');

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
