/**
 * Unit tests for studentController.updateSubmission
 * Tests updating a submission's GitHub repository URL
 */

// Mock database before importing
jest.mock('../../src/config/db', () => ({
  query: jest.fn()
}));

const db = require('../../src/config/db');
const { updateSubmission } = require('../../src/controllers/studentController');

describe('studentController.updateSubmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Success Cases
  // ==========================================
  describe('Success Cases', () => {
    it('should update submission with new github_url and commit_sha', async () => {
      const mockSubmission = {
        id: 1,
        user_id: 5,
        assignment_id: 10,
        github_url: 'https://github.com/old/repo',
        webhook_id: '123'
      };
      const updatedSubmission = {
        id: 1,
        github_url: 'https://github.com/new/repo',
        commit_sha: 'abc123',
        status: 'pending'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockSubmission] })  // Get existing submission
        .mockResolvedValueOnce({ rows: [updatedSubmission] }); // Update submission

      const result = await updateSubmission(1, 5, 'https://github.com/new/repo', 'abc123');

      expect(result).toEqual({
        success: true,
        submission: updatedSubmission,
        oldWebhookInfo: {
          webhookId: '123',
          owner: 'old',
          repo: 'repo'
        }
      });
    });

    it('should return null oldWebhookInfo if no webhook was registered', async () => {
      const mockSubmission = {
        id: 1,
        user_id: 5,
        github_url: 'https://github.com/old/repo',
        webhook_id: null
      };
      const updatedSubmission = {
        id: 1,
        github_url: 'https://github.com/new/repo',
        commit_sha: 'def456'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockSubmission] })
        .mockResolvedValueOnce({ rows: [updatedSubmission] });

      const result = await updateSubmission(1, 5, 'https://github.com/new/repo', 'def456');

      expect(result.success).toBe(true);
      expect(result.oldWebhookInfo).toBeNull();
    });
  });

  // ==========================================
  // Not Found Cases
  // ==========================================
  describe('Not Found', () => {
    it('should return NOT_FOUND when submission does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await updateSubmission(999, 5, 'https://github.com/new/repo', 'abc');

      expect(result).toEqual({
        success: false,
        error: 'NOT_FOUND'
      });
    });
  });

  // ==========================================
  // Authorization Cases
  // ==========================================
  describe('Authorization', () => {
    it('should return FORBIDDEN when student does not own submission', async () => {
      const mockSubmission = {
        id: 1,
        user_id: 10,  // Different user
        github_url: 'https://github.com/old/repo'
      };

      db.query.mockResolvedValueOnce({ rows: [mockSubmission] });

      const result = await updateSubmission(1, 5, 'https://github.com/new/repo', 'abc');

      expect(result).toEqual({
        success: false,
        error: 'FORBIDDEN'
      });
    });
  });

  // ==========================================
  // Database Error Cases
  // ==========================================
  describe('Database Errors', () => {
    it('should throw on submission lookup database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(updateSubmission(1, 5, 'https://github.com/new/repo', 'abc'))
        .rejects.toThrow('Connection failed');
    });

    it('should throw on update database error', async () => {
      const mockSubmission = { id: 1, user_id: 5, github_url: 'https://github.com/old/repo' };

      db.query
        .mockResolvedValueOnce({ rows: [mockSubmission] })
        .mockRejectedValueOnce(new Error('Update failed'));

      await expect(updateSubmission(1, 5, 'https://github.com/new/repo', 'abc'))
        .rejects.toThrow('Update failed');
    });
  });

  // ==========================================
  // Parameterized Query Verification
  // ==========================================
  describe('Parameterized Queries', () => {
    it('should use parameterized query for submission lookup', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await updateSubmission(1, 5, 'https://github.com/new/repo', 'abc');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });

    it('should use parameterized query for update', async () => {
      const mockSubmission = { id: 1, user_id: 5, github_url: 'https://github.com/old/repo' };
      const updatedSubmission = { id: 1, github_url: 'https://github.com/new/repo' };

      db.query
        .mockResolvedValueOnce({ rows: [mockSubmission] })
        .mockResolvedValueOnce({ rows: [updatedSubmission] });

      await updateSubmission(1, 5, 'https://github.com/new/repo', 'newsha123');

      expect(db.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['https://github.com/new/repo', 'newsha123', 1])
      );
    });
  });
});
