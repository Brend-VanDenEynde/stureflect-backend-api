/**
 * Integration tests for GET /api/students/me/assignments/:assignmentId/events
 * Tests SSE endpoint for real-time feedback notifications
 *
 * Note: Full SSE streaming tests are skipped due to Jest limitations with persistent connections.
 * The error cases and validation are fully tested.
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

const db = require('../../src/config/db');
const app = require('../../src/app');
const sseManager = require('../../src/services/sseManager');

describe('GET /api/students/me/assignments/:assignmentId/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sseManager.clearAll();
  });

  // ==========================================
  // Bad Request (400)
  // ==========================================
  describe('400 Bad Request', () => {
    it('should return 400 when assignmentId is not a number', async () => {
      const response = await request(app)
        .get('/api/students/me/assignments/abc/events?studentId=1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when assignmentId is zero', async () => {
      const response = await request(app)
        .get('/api/students/me/assignments/0/events?studentId=1')
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when assignmentId is negative', async () => {
      const response = await request(app)
        .get('/api/students/me/assignments/-5/events?studentId=1')
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when studentId is missing in dev mode', async () => {
      const response = await request(app)
        .get('/api/students/me/assignments/10/events')
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
      expect(response.body.message).toContain('studentId');
    });

    it('should return 400 when studentId is invalid', async () => {
      const response = await request(app)
        .get('/api/students/me/assignments/10/events?studentId=abc')
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when studentId is zero', async () => {
      const response = await request(app)
        .get('/api/students/me/assignments/10/events?studentId=0')
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });
  });

  // ==========================================
  // Not Found (404)
  // ==========================================
  describe('404 Not Found', () => {
    it('should return 404 when no submission exists for assignment', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/students/me/assignments/10/events?studentId=1')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
      expect(response.body.message).toContain('submission');
    });
  });

  // ==========================================
  // Server Error (500)
  // ==========================================
  describe('500 Internal Server Error', () => {
    it('should return 500 on database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/students/me/assignments/10/events?studentId=1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  // ==========================================
  // Query Parameters
  // ==========================================
  describe('Query Parameters', () => {
    it('should use studentId from query parameter in dev mode', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/students/me/assignments/10/events?studentId=5')
        .expect(404);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [5, 10]
      );
    });
  });
});
