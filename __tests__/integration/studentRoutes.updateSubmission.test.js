/**
 * Integration tests for PUT /api/students/me/submissions/:submissionId
 * Tests the full HTTP request/response cycle for updating a submission's GitHub repo
 */

const request = require('supertest');

// Mock the database
jest.mock('../../src/config/db', () => ({
  query: jest.fn()
}));

// Mock user model
jest.mock('../../src/models/user', () => ({
  getUserById: jest.fn()
}));

// Mock GitHub service
jest.mock('../../src/services/githubService', () => ({
  validateGitHubUrl: jest.fn(),
  checkRepositoryAccess: jest.fn(),
  getLatestCommitSha: jest.fn(),
  getRepositoryTree: jest.fn(),
  filterCodeFiles: jest.fn(),
  detectLanguage: jest.fn(),
  registerWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
  parseGitHubUrl: jest.fn()
}));

const db = require('../../src/config/db');
const { getUserById } = require('../../src/models/user');
const githubService = require('../../src/services/githubService');
const app = require('../../src/app');

describe('PUT /api/students/me/submissions/:submissionId', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    githubService.parseGitHubUrl.mockImplementation((url) => {
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      return match ? { owner: match[1], repo: match[2] } : null;
    });
  });

  // ==========================================
  // Success Cases (200 OK)
  // ==========================================
  describe('200 OK - Successful Update', () => {
    it('should update submission with new GitHub repo', async () => {
      const existingSubmission = {
        id: 1,
        user_id: 1,
        assignment_id: 10,
        github_url: 'https://github.com/old/repo',
        webhook_id: '123'
      };
      const updatedSubmission = {
        id: 1,
        github_url: 'https://github.com/new/repo',
        commit_sha: 'newsha123',
        status: 'pending'
      };

      // Mock submission lookup
      db.query
        .mockResolvedValueOnce({ rows: [existingSubmission] })  // Get submission
        .mockResolvedValueOnce({ rows: [updatedSubmission] });   // Update submission

      // Mock GitHub service
      githubService.validateGitHubUrl.mockReturnValue({
        valid: true,
        owner: 'new',
        repo: 'repo'
      });
      githubService.checkRepositoryAccess.mockResolvedValue({
        accessible: true,
        repoData: { default_branch: 'main' }
      });
      githubService.getLatestCommitSha.mockResolvedValue({
        success: true,
        sha: 'newsha123'
      });
      githubService.getRepositoryTree.mockResolvedValue({
        success: true,
        files: [{ path: 'index.js', size: 100 }]
      });
      githubService.filterCodeFiles.mockReturnValue([{ path: 'index.js', size: 100 }]);
      githubService.deleteWebhook.mockResolvedValue({ success: true });
      githubService.registerWebhook.mockResolvedValue({
        success: true,
        webhookId: 456
      });
      getUserById.mockResolvedValue({ github_access_token: 'token123' });

      // Mock webhook update
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, webhook_id: '456' }] });

      const response = await request(app)
        .put('/api/students/me/submissions/1')
        .send({ github_url: 'https://github.com/new/repo' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.github_url).toBe('https://github.com/new/repo');
    });

    it('should delete old webhook before registering new one', async () => {
      const existingSubmission = {
        id: 1,
        user_id: 1,
        github_url: 'https://github.com/old/repo',
        webhook_id: '123'
      };

      db.query
        .mockResolvedValueOnce({ rows: [existingSubmission] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      githubService.validateGitHubUrl.mockReturnValue({ valid: true, owner: 'new', repo: 'repo' });
      githubService.checkRepositoryAccess.mockResolvedValue({ accessible: true, repoData: {} });
      githubService.getLatestCommitSha.mockResolvedValue({ success: true, sha: 'sha' });
      githubService.getRepositoryTree.mockResolvedValue({ success: true, files: [{ path: 'a.js' }] });
      githubService.filterCodeFiles.mockReturnValue([{ path: 'a.js' }]);
      githubService.deleteWebhook.mockResolvedValue({ success: true });
      githubService.registerWebhook.mockResolvedValue({ success: true, webhookId: 456 });
      getUserById.mockResolvedValue({ github_access_token: 'token' });

      await request(app)
        .put('/api/students/me/submissions/1')
        .send({ github_url: 'https://github.com/new/repo' })
        .expect(200);

      // Verify old webhook was deleted
      expect(githubService.deleteWebhook).toHaveBeenCalledWith('old', 'repo', '123');
    });
  });

  // ==========================================
  // Bad Request (400)
  // ==========================================
  describe('400 Bad Request - Invalid Input', () => {
    it('should return 400 when github_url is missing', async () => {
      const response = await request(app)
        .put('/api/students/me/submissions/1')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when github_url is empty', async () => {
      const response = await request(app)
        .put('/api/students/me/submissions/1')
        .send({ github_url: '' })
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when submissionId is not a number', async () => {
      const response = await request(app)
        .put('/api/students/me/submissions/abc')
        .send({ github_url: 'https://github.com/user/repo' })
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when github_url is invalid', async () => {
      githubService.validateGitHubUrl.mockReturnValue({
        valid: false,
        error: 'Ongeldige GitHub URL'
      });

      const response = await request(app)
        .put('/api/students/me/submissions/1')
        .send({ github_url: 'not-a-github-url' })
        .expect(400);

      expect(response.body.error).toBe('INVALID_URL');
    });
  });

  // ==========================================
  // Forbidden (403)
  // ==========================================
  describe('403 Forbidden - Authorization', () => {
    it('should return 403 when student does not own submission', async () => {
      const existingSubmission = {
        id: 1,
        user_id: 999,  // Different user
        github_url: 'https://github.com/old/repo'
      };

      // Setup all mocks needed before the authorization check
      githubService.validateGitHubUrl.mockReturnValue({ valid: true, owner: 'new', repo: 'repo' });
      githubService.checkRepositoryAccess.mockResolvedValue({ accessible: true, repoData: {} });
      githubService.getLatestCommitSha.mockResolvedValue({ success: true, sha: 'sha' });
      githubService.getRepositoryTree.mockResolvedValue({ success: true, files: [{ path: 'a.js' }] });
      githubService.filterCodeFiles.mockReturnValue([{ path: 'a.js' }]);

      db.query.mockResolvedValueOnce({ rows: [existingSubmission] });

      const response = await request(app)
        .put('/api/students/me/submissions/1')
        .send({ github_url: 'https://github.com/new/repo' })
        .expect(403);

      expect(response.body.error).toBe('FORBIDDEN');
    });
  });

  // ==========================================
  // Not Found (404)
  // ==========================================
  describe('404 Not Found', () => {
    it('should return 404 when submission does not exist', async () => {
      // Setup all mocks needed before the db check
      githubService.validateGitHubUrl.mockReturnValue({ valid: true, owner: 'new', repo: 'repo' });
      githubService.checkRepositoryAccess.mockResolvedValue({ accessible: true, repoData: {} });
      githubService.getLatestCommitSha.mockResolvedValue({ success: true, sha: 'sha' });
      githubService.getRepositoryTree.mockResolvedValue({ success: true, files: [{ path: 'a.js' }] });
      githubService.filterCodeFiles.mockReturnValue([{ path: 'a.js' }]);

      // Mock submission not found
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/students/me/submissions/999')
        .send({ github_url: 'https://github.com/new/repo' })
        .expect(404);

      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should return 404 when new GitHub repo does not exist', async () => {
      githubService.validateGitHubUrl.mockReturnValue({ valid: true, owner: 'new', repo: 'nonexistent' });
      githubService.checkRepositoryAccess.mockResolvedValue({
        accessible: false,
        error: 'Repository niet gevonden',
        errorCode: 'REPO_NOT_FOUND'
      });

      const response = await request(app)
        .put('/api/students/me/submissions/1')
        .send({ github_url: 'https://github.com/new/nonexistent' })
        .expect(404);

      expect(response.body.error).toBe('REPO_NOT_FOUND');
    });
  });

  // ==========================================
  // Server Error (500)
  // ==========================================
  describe('500 Internal Server Error', () => {
    it('should return 500 on database error', async () => {
      // Setup mocks before the database call
      githubService.validateGitHubUrl.mockReturnValue({ valid: true, owner: 'new', repo: 'repo' });
      githubService.checkRepositoryAccess.mockResolvedValue({ accessible: true, repoData: {} });
      githubService.getLatestCommitSha.mockResolvedValue({ success: true, sha: 'sha' });
      githubService.getRepositoryTree.mockResolvedValue({ success: true, files: [{ path: 'a.js' }] });
      githubService.filterCodeFiles.mockReturnValue([{ path: 'a.js' }]);

      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .put('/api/students/me/submissions/1')
        .send({ github_url: 'https://github.com/new/repo' })
        .expect(500);

      expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  // ==========================================
  // Response Format
  // ==========================================
  describe('Response Format', () => {
    it('should include success, data, message, and error fields', async () => {
      // Setup mocks
      githubService.validateGitHubUrl.mockReturnValue({ valid: true, owner: 'new', repo: 'repo' });
      githubService.checkRepositoryAccess.mockResolvedValue({ accessible: true, repoData: {} });
      githubService.getLatestCommitSha.mockResolvedValue({ success: true, sha: 'sha' });
      githubService.getRepositoryTree.mockResolvedValue({ success: true, files: [{ path: 'a.js' }] });
      githubService.filterCodeFiles.mockReturnValue([{ path: 'a.js' }]);

      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/students/me/submissions/1')
        .send({ github_url: 'https://github.com/new/repo' });

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });
  });
});
