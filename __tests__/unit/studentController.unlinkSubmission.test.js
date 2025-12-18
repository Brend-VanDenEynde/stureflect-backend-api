/**
 * Unit tests for studentController.unlinkSubmission
 * Tests unlinking/removing a GitHub repository from a submission
 */

// Mock database before importing
jest.mock('../../src/config/db', () => ({
  query: jest.fn()
}));

const db = require('../../src/config/db');
const { unlinkSubmission } = require('../../src/controllers/studentController');

describe('studentController.unlinkSubmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Success Cases
  // ==========================================
  describe('Success Cases', () => {
    it('should unlink submission and return old webhook info for cleanup', async () => {
      const mockSubmission = {
        id: 1,
        user_id: 5,
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
        .mockResolvedValueOnce({ rows: [mockSubmission] })  // Get existing submission
        .mockResolvedValueOnce({ rows: [unlinkedSubmission] }); // Update submission

      const result = await unlinkSubmission(1, 5);

      expect(result).toEqual({
        success: true,
        submission: unlinkedSubmission,
        oldWebhookInfo: {
          webhookId: '12345',
          owner: 'student',
          repo: 'project'
        }
      });
    });

    it('should return null oldWebhookInfo if no webhook was registered', async () => {
      const mockSubmission = {
        id: 1,
        user_id: 5,
        github_url: 'https://github.com/student/project',
        webhook_id: null,
        webhook_secret: null
      };
      const unlinkedSubmission = {
        id: 1,
        github_url: null,
        status: 'unlinked'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockSubmission] })
        .mockResolvedValueOnce({ rows: [unlinkedSubmission] });

      const result = await unlinkSubmission(1, 5);

      expect(result.success).toBe(true);
      expect(result.oldWebhookInfo).toBeNull();
    });

    it('should set status to unlinked after unlinking', async () => {
      const mockSubmission = {
        id: 1,
        user_id: 5,
        github_url: 'https://github.com/student/project',
        webhook_id: null
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockSubmission] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'unlinked' }] });

      const result = await unlinkSubmission(1, 5);

      // Verify UPDATE query sets status to 'unlinked'
      expect(db.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('unlinked'),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Already Unlinked
  // ==========================================
  describe('Already Unlinked', () => {
    it('should return ALREADY_UNLINKED when submission has no github_url', async () => {
      const mockSubmission = {
        id: 1,
        user_id: 5,
        github_url: null,
        status: 'unlinked'
      };

      db.query.mockResolvedValueOnce({ rows: [mockSubmission] });

      const result = await unlinkSubmission(1, 5);

      expect(result).toEqual({
        success: false,
        error: 'ALREADY_UNLINKED'
      });
    });
  });

  // ==========================================
  // Not Found Cases
  // ==========================================
  describe('Not Found', () => {
    it('should return NOT_FOUND when submission does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await unlinkSubmission(999, 5);

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
        github_url: 'https://github.com/other/repo'
      };

      db.query.mockResolvedValueOnce({ rows: [mockSubmission] });

      const result = await unlinkSubmission(1, 5);

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

      await expect(unlinkSubmission(1, 5))
        .rejects.toThrow('Connection failed');
    });

    it('should throw on update database error', async () => {
      const mockSubmission = {
        id: 1,
        user_id: 5,
        github_url: 'https://github.com/student/project'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockSubmission] })
        .mockRejectedValueOnce(new Error('Update failed'));

      await expect(unlinkSubmission(1, 5))
        .rejects.toThrow('Update failed');
    });
  });

  // ==========================================
  // Parameterized Query Verification
  // ==========================================
  describe('Parameterized Queries', () => {
    it('should use parameterized query for submission lookup', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await unlinkSubmission(42, 5);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [42]
      );
    });

    it('should clear github_url, webhook_id, webhook_secret in update', async () => {
      const mockSubmission = {
        id: 1,
        user_id: 5,
        github_url: 'https://github.com/student/project',
        webhook_id: '123'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockSubmission] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await unlinkSubmission(1, 5);

      const updateCall = db.query.mock.calls[1];
      expect(updateCall[0]).toContain('github_url');
      expect(updateCall[0]).toContain('webhook_id');
      expect(updateCall[0]).toContain('webhook_secret');
      expect(updateCall[0]).toContain('UPDATE');
    });
  });
});
