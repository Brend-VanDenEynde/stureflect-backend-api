/**
 * Integration tests for DELETE /api/students/me/submissions/:submissionId
 * Tests the full HTTP request/response cycle for unlinking a GitHub repo from a submission
 */

const request = require('supertest');

// Mock the database
jest.mock('../../src/config/db', () => ({
  query: jest.fn()
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

// Mock user model
jest.mock('../../src/models/user', () => ({
  getUserById: jest.fn()
}));

const db = require('../../src/config/db');
const githubService = require('../../src/services/githubService');
const app = require('../../src/app');

describe('DELETE /api/students/me/submissions/:submissionId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Success Cases (200 OK)
  // ==========================================
  describe('200 OK - Successful Unlink', () => {
    it('should unlink submission and return success', async () => {
      const existingSubmission = {
        id: 1,
        user_id: 1,
        assignment_id: 10,
        github_url: 'https://github.com/student/project',
        webhook_id: '12345',
        webhook_secret: 'secret123'
      };
      const unlinkedSubmission = {
        id: 1,
        github_url: null,
        webhook_id: null,
        webhook_secret: null,
        status: 'unlinked'
      };

      db.query
        .mockResolvedValueOnce({ rows: [existingSubmission] })  // Get submission
        .mockResolvedValueOnce({ rows: [unlinkedSubmission] });  // Update submission

      githubService.deleteWebhook.mockResolvedValue({ success: true });

      const response = await request(app)
        .delete('/api/students/me/submissions/1?studentId=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('unlinked');
      expect(response.body.data.github_url).toBeNull();
      expect(response.body.message).toBe('Repository succesvol ontkoppeld');
    });

    it('should delete webhook from GitHub when present', async () => {
      const existingSubmission = {
        id: 1,
        user_id: 1,
        github_url: 'https://github.com/student/project',
        webhook_id: '12345'
      };

      db.query
        .mockResolvedValueOnce({ rows: [existingSubmission] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'unlinked' }] });

      githubService.deleteWebhook.mockResolvedValue({ success: true });

      await request(app)
        .delete('/api/students/me/submissions/1?studentId=1')
        .expect(200);

      expect(githubService.deleteWebhook).toHaveBeenCalledWith('student', 'project', '12345');
    });

    it('should succeed even if webhook deletion fails', async () => {
      const existingSubmission = {
        id: 1,
        user_id: 1,
        github_url: 'https://github.com/student/project',
        webhook_id: '12345'
      };

      db.query
        .mockResolvedValueOnce({ rows: [existingSubmission] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'unlinked' }] });

      // Webhook deletion fails
      githubService.deleteWebhook.mockRejectedValue(new Error('GitHub API error'));

      const response = await request(app)
        .delete('/api/students/me/submissions/1?studentId=1')
        .expect(200);

      // Should still succeed - webhook failure is non-blocking
      expect(response.body.success).toBe(true);
    });

    it('should not call deleteWebhook when no webhook was registered', async () => {
      const existingSubmission = {
        id: 1,
        user_id: 1,
        github_url: 'https://github.com/student/project',
        webhook_id: null  // No webhook
      };

      db.query
        .mockResolvedValueOnce({ rows: [existingSubmission] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'unlinked' }] });

      await request(app)
        .delete('/api/students/me/submissions/1?studentId=1')
        .expect(200);

      expect(githubService.deleteWebhook).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Bad Request (400)
  // ==========================================
  describe('400 Bad Request - Invalid Input', () => {
    it('should return 400 when submissionId is not a number', async () => {
      const response = await request(app)
        .delete('/api/students/me/submissions/abc?studentId=1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
      expect(response.body.message).toBe('Ongeldig submission ID');
    });

    it('should return 400 when submissionId is zero', async () => {
      const response = await request(app)
        .delete('/api/students/me/submissions/0?studentId=1')
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when submissionId is negative', async () => {
      const response = await request(app)
        .delete('/api/students/me/submissions/-1?studentId=1')
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when studentId is missing in dev mode', async () => {
      const response = await request(app)
        .delete('/api/students/me/submissions/1')
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
      expect(response.body.message).toContain('studentId');
    });

    it('should return 400 when submission already has no repo (ALREADY_UNLINKED)', async () => {
      const existingSubmission = {
        id: 1,
        user_id: 1,
        github_url: null,  // Already unlinked
        status: 'unlinked'
      };

      db.query.mockResolvedValueOnce({ rows: [existingSubmission] });

      const response = await request(app)
        .delete('/api/students/me/submissions/1?studentId=1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('ALREADY_UNLINKED');
      expect(response.body.message).toBe('Deze submission heeft al geen repository gekoppeld');
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
        github_url: 'https://github.com/other/repo'
      };

      db.query.mockResolvedValueOnce({ rows: [existingSubmission] });

      const response = await request(app)
        .delete('/api/students/me/submissions/1?studentId=1')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('FORBIDDEN');
      expect(response.body.message).toBe('Je hebt geen toegang tot deze submission');
    });
  });

  // ==========================================
  // Not Found (404)
  // ==========================================
  describe('404 Not Found', () => {
    it('should return 404 when submission does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .delete('/api/students/me/submissions/999?studentId=1')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
      expect(response.body.message).toBe('Submission niet gevonden');
    });
  });

  // ==========================================
  // Server Error (500)
  // ==========================================
  describe('500 Internal Server Error', () => {
    it('should return 500 on database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .delete('/api/students/me/submissions/1?studentId=1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  // ==========================================
  // Response Format
  // ==========================================
  describe('Response Format', () => {
    it('should include success, data, message, and error fields on success', async () => {
      const existingSubmission = {
        id: 1,
        user_id: 1,
        github_url: 'https://github.com/student/project',
        webhook_id: null
      };

      db.query
        .mockResolvedValueOnce({ rows: [existingSubmission] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'unlinked' }] });

      const response = await request(app)
        .delete('/api/students/me/submissions/1?studentId=1')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error', null);
    });

    it('should include success, message, and error fields on error', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .delete('/api/students/me/submissions/999?studentId=1')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });
  });
});
