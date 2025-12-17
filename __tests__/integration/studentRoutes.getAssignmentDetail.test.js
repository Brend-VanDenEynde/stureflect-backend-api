/**
 * Integration tests for GET /api/students/me/assignments/:assignmentId
 * Tests the full HTTP request/response cycle for fetching assignment details
 */

const request = require('supertest');

// Mock the database
jest.mock('../../src/config/db', () => ({
  query: jest.fn()
}));

const db = require('../../src/config/db');
const app = require('../../src/app');

describe('GET /api/students/me/assignments/:assignmentId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Success Cases (200 OK)
  // ==========================================
  describe('200 OK - Successful Response', () => {
    it('should return assignment with course context and submission status', async () => {
      const mockAssignmentData = {
        id: 1,
        title: 'JavaScript Basics',
        description: 'Maak een calculator app',
        due_date: '2025-01-15T23:59:59Z',
        created_at: '2025-01-01T10:00:00Z',
        course_id: 5,
        course_title: 'Web Development 101',
        rubric: 'Code kwaliteit: 40%',
        ai_guidelines: 'Focus op clean code',
        submission_id: 42,
        enrollment_id: 1
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const response = await request(app)
        .get('/api/students/me/assignments/1')
        .query({ userId: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignment).toEqual({
        id: 1,
        title: 'JavaScript Basics',
        description: 'Maak een calculator app',
        due_date: '2025-01-15T23:59:59Z',
        created_at: '2025-01-01T10:00:00Z'
      });
      expect(response.body.data.course).toEqual({
        id: 5,
        title: 'Web Development 101',
        rubric: 'Code kwaliteit: 40%',
        ai_guidelines: 'Focus op clean code'
      });
      expect(response.body.data.submission_status).toEqual({
        has_submitted: true,
        submission_id: 42
      });
    });

    it('should return submission_status.has_submitted false when no submission', async () => {
      const mockAssignmentData = {
        id: 1,
        title: 'Test Assignment',
        description: null,
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        course_id: 5,
        course_title: 'Course',
        rubric: null,
        ai_guidelines: null,
        submission_id: null,
        enrollment_id: 1
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const response = await request(app)
        .get('/api/students/me/assignments/1')
        .query({ userId: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.submission_status.has_submitted).toBe(false);
      expect(response.body.data.submission_status.submission_id).toBeNull();
    });
  });

  // ==========================================
  // Bad Request (400)
  // ==========================================
  describe('400 Bad Request - Invalid Input', () => {
    it('should return 400 when assignmentId is not a number', async () => {
      const response = await request(app)
        .get('/api/students/me/assignments/abc')
        .query({ userId: 5 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when assignmentId is zero', async () => {
      const response = await request(app)
        .get('/api/students/me/assignments/0')
        .query({ userId: 5 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when assignmentId is negative', async () => {
      const response = await request(app)
        .get('/api/students/me/assignments/-1')
        .query({ userId: 5 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
    });
  });

  // ==========================================
  // Forbidden (403)
  // ==========================================
  describe('403 Forbidden - Not Enrolled', () => {
    it('should return 403 when student is not enrolled in course', async () => {
      const mockAssignmentData = {
        id: 1,
        title: 'Test',
        course_id: 5,
        course_title: 'Course',
        enrollment_id: null  // Not enrolled
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const response = await request(app)
        .get('/api/students/me/assignments/1')
        .query({ userId: 999 })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('FORBIDDEN');
    });
  });

  // ==========================================
  // Not Found (404)
  // ==========================================
  describe('404 Not Found', () => {
    it('should return 404 when assignment does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // Assignment not found

      const response = await request(app)
        .get('/api/students/me/assignments/999')
        .query({ userId: 5 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });

  // ==========================================
  // Server Error (500)
  // ==========================================
  describe('500 Internal Server Error', () => {
    it('should return 500 on database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/students/me/assignments/1')
        .query({ userId: 5 })
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
      const mockAssignmentData = {
        id: 1,
        title: 'Test',
        description: null,
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        course_id: 5,
        course_title: 'Course',
        rubric: null,
        ai_guidelines: null,
        submission_id: null,
        enrollment_id: 1
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const response = await request(app)
        .get('/api/students/me/assignments/1')
        .query({ userId: 5 });

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error', null);
    });

    it('should include success, message, and error fields on error', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/students/me/assignments/999')
        .query({ userId: 5 });

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });
  });
});
