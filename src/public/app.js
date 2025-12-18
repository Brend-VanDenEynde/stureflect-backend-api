// API Base URL
const API_BASE = '/api';

// DOM Elements
const directTestForm = document.getElementById('directTestForm');
const testResult = document.getElementById('testResult');
const submissionForm = document.getElementById('submissionForm');
const submitResult = document.getElementById('submitResult');
const submissionsList = document.getElementById('submissionsList');
const refreshBtn = document.getElementById('refreshBtn');
const feedbackModal = document.getElementById('feedbackModal');
const feedbackContent = document.getElementById('feedbackContent');

// Auth state
let currentUser = null;

// Load submissions on page load
document.addEventListener('DOMContentLoaded', () => {
  handleOAuthCallback();
  checkAuthStatus();
  loadSubmissions();
});

// Handle OAuth callback - check URL for tokens
function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('accessToken');
  const refreshToken = urlParams.get('refreshToken');

  if (accessToken && refreshToken) {
    // Store tokens
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    // Parse user info from JWT
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      currentUser = {
        id: payload.id,
        email: payload.email,
        role: payload.role
      };
      localStorage.setItem('user', JSON.stringify(currentUser));
    } catch (e) {
      console.error('Failed to parse JWT:', e);
    }

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Check if user is logged in
function checkAuthStatus() {
  const accessToken = localStorage.getItem('accessToken');
  const userStr = localStorage.getItem('user');

  if (accessToken && userStr) {
    try {
      currentUser = JSON.parse(userStr);
      showLoggedInState();
    } catch (e) {
      logout();
    }
  } else {
    showLoggedOutState();
  }
}

// Show logged in UI
function showLoggedInState() {
  document.getElementById('notLoggedIn').style.display = 'none';
  document.getElementById('loggedIn').style.display = 'flex';
  document.getElementById('userEmail').textContent = currentUser.email || '';
  document.getElementById('userId').textContent = `(ID: ${currentUser.id})`;

  // Auto-fill studentId
  document.getElementById('studentId').value = currentUser.id;

  // Enable submission section
  document.getElementById('submissionSection').style.opacity = '1';
}

// Show logged out UI
function showLoggedOutState() {
  document.getElementById('notLoggedIn').style.display = 'block';
  document.getElementById('loggedIn').style.display = 'none';

  // Dim submission section
  document.getElementById('submissionSection').style.opacity = '0.6';
}

// Logout function
function logout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  currentUser = null;
  showLoggedOutState();
}

// Refresh button
refreshBtn.addEventListener('click', loadSubmissions);

// Direct Test Form
directTestForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const githubUrl = document.getElementById('testGithubUrl').value.trim();
  const submitBtn = directTestForm.querySelector('button[type="submit"]');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');

  submitBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline';
  testResult.className = 'result-message';
  testResult.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE}/webhooks/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_url: githubUrl })
    });

    const data = await response.json();

    if (data.success) {
      testResult.className = 'result-message success';
      testResult.innerHTML = `
        <strong>Analyse compleet!</strong><br>
        Repository: ${data.data.repository}<br>
        Commit: ${data.data.commit}<br>
        Bestanden geanalyseerd: ${data.data.files_analyzed}<br>
        <strong>Score: ${data.data.score}/100</strong><br>
        <hr style="margin: 10px 0;">
        <strong>Feedback (${data.data.feedback.length} items):</strong><br>
        ${data.data.feedback.slice(0, 5).map(f => `
          <div style="margin: 5px 0; padding: 5px; background: rgba(0,0,0,0.05); border-radius: 4px;">
            <span style="color: ${f.severity === 'critical' ? '#dc2626' : f.severity === 'high' ? '#ea580c' : f.severity === 'medium' ? '#ca8a04' : '#2563eb'}">[${f.severity}]</span>
            ${f.content.substring(0, 150)}${f.content.length > 150 ? '...' : ''}
          </div>
        `).join('')}
        ${data.data.feedback.length > 5 ? `<em>...en ${data.data.feedback.length - 5} meer</em>` : ''}
      `;
    } else {
      testResult.className = 'result-message error';
      testResult.innerHTML = `<strong>Fout:</strong> ${data.error}`;
    }
  } catch (error) {
    testResult.className = 'result-message error';
    testResult.innerHTML = `<strong>Fout:</strong> ${error.message}`;
  } finally {
    submitBtn.disabled = false;
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
    testResult.style.display = 'block';
  }
});

// Form submission
submissionForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const githubUrl = document.getElementById('githubUrl').value.trim();
  const assignmentId = document.getElementById('assignmentId').value;
  const studentId = document.getElementById('studentId').value;

  const submitBtn = submissionForm.querySelector('button[type="submit"]');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');

  // Show loading state
  submitBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline';
  submitResult.className = 'result-message';
  submitResult.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE}/students/me/assignments/${assignmentId}/submissions?studentId=${studentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ github_url: githubUrl })
    });

    const data = await response.json();

    if (data.success) {
      const webhook = data.data.webhook || {};
      submitResult.className = 'result-message success';
      submitResult.innerHTML = `
        <strong>Submission aangemaakt!</strong><br>
        ID: ${data.data.id}<br>
        Repository: ${data.data.repository?.owner}/${data.data.repository?.repo}<br>
        Bestanden: ${data.data.files_count} code bestanden gevonden<br>
        <hr style="margin: 8px 0;">
        <strong>Webhook Status:</strong> ${webhook.registered
          ? `<span style="color: #16a34a;">✓ Automatisch geregistreerd (ID: ${webhook.webhookId})</span>`
          : `<span style="color: #dc2626;">✗ Niet geregistreerd - ${webhook.error || 'Log eerst in met GitHub'}</span>`
        }<br>
        ${webhook.registered
          ? '<em>Push nu naar je repo om AI analyse te triggeren!</em>'
          : '<em>Webhook moet handmatig worden ingesteld op GitHub.</em>'
        }
      `;
      document.getElementById('githubUrl').value = '';
      loadSubmissions();
    } else {
      submitResult.className = 'result-message error';
      submitResult.innerHTML = `<strong>Fout:</strong> ${data.message || data.error}`;
    }
  } catch (error) {
    submitResult.className = 'result-message error';
    submitResult.innerHTML = `<strong>Fout:</strong> ${error.message}`;
  } finally {
    submitBtn.disabled = false;
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  }
});

// Load submissions list
async function loadSubmissions() {
  const studentId = document.getElementById('studentId').value || 1;
  submissionsList.innerHTML = '<p class="loading">Laden...</p>';

  try {
    const response = await fetch(`${API_BASE}/students/me/submissions?studentId=${studentId}`);
    const data = await response.json();

    if (data.success && data.data.length > 0) {
      submissionsList.innerHTML = data.data.map(sub => createSubmissionItem(sub)).join('');
    } else if (data.success) {
      submissionsList.innerHTML = `
        <div class="empty-state">
          <p>Nog geen submissions gevonden.</p>
          <p>Dien een GitHub repository in om te beginnen.</p>
        </div>
      `;
    } else {
      submissionsList.innerHTML = `<p class="error">Fout bij laden: ${data.error}</p>`;
    }
  } catch (error) {
    submissionsList.innerHTML = `<p class="error">Fout: ${error.message}</p>`;
  }
}

// Create submission item HTML
function createSubmissionItem(sub) {
  const statusClass = `status-${sub.status}`;
  const scoreClass = sub.ai_score >= 80 ? 'high' : sub.ai_score >= 50 ? 'medium' : 'low';

  return `
    <div class="submission-item">
      <div class="submission-info">
        <div class="repo-url">${sub.github_url || 'Geen URL'}</div>
        <div class="meta">
          ID: ${sub.id} |
          Opdracht: ${sub.assignment_title || sub.assignment_id} |
          ${sub.commit_sha ? `Commit: ${sub.commit_sha.substring(0, 7)}` : ''}
        </div>
      </div>
      <div class="submission-status">
        <span class="status-badge ${statusClass}">${formatStatus(sub.status)}</span>
        ${sub.ai_score !== null ? `<span class="score ${scoreClass}">${sub.ai_score}</span>` : ''}
        ${sub.status === 'analyzed' || sub.status === 'failed' ?
          `<button class="btn btn-secondary btn-small" onclick="viewFeedback(${sub.id})">Feedback</button>` : ''}
        ${sub.status === 'failed' ?
          `<button class="btn btn-secondary btn-small" onclick="retrySubmission(${sub.id})">Retry</button>` : ''}
      </div>
    </div>
  `;
}

// Format status for display
function formatStatus(status) {
  const statusMap = {
    'pending': 'Wachtend',
    'processing': 'Bezig...',
    'analyzed': 'Geanalyseerd',
    'failed': 'Mislukt',
    'completed': 'Voltooid'
  };
  return statusMap[status] || status;
}

// View feedback for a submission
async function viewFeedback(submissionId) {
  const studentId = document.getElementById('studentId').value || 1;
  feedbackContent.innerHTML = '<p class="loading">Feedback laden...</p>';
  feedbackModal.style.display = 'flex';

  try {
    const response = await fetch(`${API_BASE}/students/me/submissions/${submissionId}/feedback?studentId=${studentId}`);
    const data = await response.json();

    if (data.success) {
      if (data.data.feedback && data.data.feedback.length > 0) {
        feedbackContent.innerHTML = `
          <div class="feedback-summary">
            <strong>Samenvatting:</strong>
            ${data.data.summary.critical} kritiek,
            ${data.data.summary.high} hoog,
            ${data.data.summary.medium} medium,
            ${data.data.summary.low} laag
          </div>
          <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;">
          ${data.data.feedback.map(item => createFeedbackItem(item)).join('')}
        `;
      } else {
        feedbackContent.innerHTML = `
          <div class="no-feedback">
            <p>Geen feedback gevonden.</p>
            <p>Dit kan betekenen dat de code perfect is, of dat de analyse nog niet is uitgevoerd.</p>
          </div>
        `;
      }
    } else {
      feedbackContent.innerHTML = `<p class="error">Fout: ${data.error}</p>`;
    }
  } catch (error) {
    feedbackContent.innerHTML = `<p class="error">Fout: ${error.message}</p>`;
  }
}

// Create feedback item HTML
function createFeedbackItem(item) {
  return `
    <div class="feedback-item severity-${item.severity}">
      <div class="feedback-header">
        <span class="feedback-type">${item.type}</span>
        <span class="feedback-severity ${item.severity}">${item.severity}</span>
        ${item.line_number ? `<span class="feedback-line">Regel ${item.line_number}</span>` : ''}
      </div>
      <div class="feedback-content-text">${item.content}</div>
      ${item.suggestion ? `<div class="feedback-suggestion">${item.suggestion}</div>` : ''}
    </div>
  `;
}

// Close feedback modal
function closeFeedbackModal() {
  feedbackModal.style.display = 'none';
}

// Close modal on outside click
feedbackModal.addEventListener('click', (e) => {
  if (e.target === feedbackModal) {
    closeFeedbackModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && feedbackModal.style.display === 'flex') {
    closeFeedbackModal();
  }
});

// Retry a failed submission
async function retrySubmission(submissionId) {
  try {
    const response = await fetch(`${API_BASE}/webhooks/retry/${submissionId}`, {
      method: 'POST'
    });
    const data = await response.json();

    if (data.success) {
      alert('Retry gestart! De analyse wordt opnieuw uitgevoerd.');
      setTimeout(loadSubmissions, 2000);
    } else {
      alert(`Retry mislukt: ${data.error}`);
    }
  } catch (error) {
    alert(`Fout: ${error.message}`);
  }
}

// Auto-refresh every 10 seconds if there are processing submissions
setInterval(() => {
  const processingItems = document.querySelectorAll('.status-processing');
  if (processingItems.length > 0) {
    loadSubmissions();
  }
}, 10000);
