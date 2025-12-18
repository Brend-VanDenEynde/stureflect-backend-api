/**
 * Integration tests for POST /api/students/me/courses/join
 * Tests the full HTTP request/response cycle for course enrollment
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

describe('POST /api/students/me/courses/join', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Success Cases (201 Created)
  // ==========================================
  describe('201 Created - Successful Enrollment', () => {
    it('should enroll student successfully with valid join code', async () => {
      const mockCourse = { id: 1, title: 'Web Development 101', description: 'Learn web development' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })  // Course lookup
        .mockResolvedValueOnce({ rows: [] })             // Enrollment check
        .mockResolvedValueOnce({ rows: [] });            // Insert enrollment

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'ABC123' })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: { course: mockCourse },
        message: 'Succesvol ingeschreven voor Web Development 101',
        error: null
      });
    });

    it('should trim whitespace from join code', async () => {
      const mockCourse = { id: 1, title: 'Test Course', description: 'Test' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: '  ABC123  ' })
        .expect(201);

      // Verify trimmed join code was used
      expect(db.query).toHaveBeenNthCalledWith(1,
        'SELECT id, title, description FROM course WHERE join_code = $1',
        ['ABC123']
      );
    });

    it('should use studentId from query param in development mode', async () => {
      const mockCourse = { id: 1, title: 'Test', description: 'Test' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/students/me/courses/join?studentId=42')
        .send({ join_code: 'TEST' })
        .expect(201);

      expect(db.query).toHaveBeenNthCalledWith(2,
        'SELECT id FROM enrollment WHERE user_id = $1 AND course_id = $2',
        [42, 1]
      );
    });
  });

  // ==========================================
  // Bad Request (400)
  // ==========================================
  describe('400 Bad Request - Invalid Input', () => {
    it('should return 400 when join_code is missing', async () => {
      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Join code is verplicht',
        error: 'BAD_REQUEST'
      });
    });

    it('should return 400 when join_code is null', async () => {
      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: null })
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when join_code is empty string', async () => {
      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: '' })
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when join_code is only whitespace', async () => {
      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: '   ' })
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when join_code is a number', async () => {
      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 12345 })
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when join_code is an object', async () => {
      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: { code: 'ABC' } })
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when join_code is an array', async () => {
      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: ['ABC', '123'] })
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when join_code is boolean', async () => {
      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: true })
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });
  });

  // ==========================================
  // Not Found (404)
  // ==========================================
  describe('404 Not Found - Invalid Join Code', () => {
    it('should return 404 when join code does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'INVALID' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: 'Ongeldige join code',
        error: 'NOT_FOUND'
      });
    });

    it('should pass join code to database preserving case', async () => {
      // Note: Actual case sensitivity depends on DB collation
      // This test verifies the API passes the code as-is to the DB
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'abc123' })
        .expect(404);

      // Verify the exact casing was passed to the database
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, title, description FROM course WHERE join_code = $1',
        ['abc123']
      );
    });
  });

  // ==========================================
  // Conflict (409)
  // ==========================================
  describe('409 Conflict - Already Enrolled', () => {
    it('should return 409 when student is already enrolled', async () => {
      const mockCourse = { id: 1, title: 'Web Development', description: 'Learn web' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [{ id: 99 }] });  // Already enrolled

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'ABC123' })
        .expect(409);

      expect(response.body).toEqual({
        success: false,
        message: 'Je bent al ingeschreven voor Web Development',
        error: 'CONFLICT',
        data: { course: mockCourse }
      });
    });

    it('should return 409 on race condition (duplicate key)', async () => {
      const mockCourse = { id: 1, title: 'Test Course', description: 'Test' };
      const duplicateKeyError = new Error('duplicate key');
      duplicateKeyError.code = '23505';
      duplicateKeyError.constraint = 'enrollment_course_id_user_id_key';

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(duplicateKeyError)
        .mockResolvedValueOnce({ rows: [mockCourse] });

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'ABC123' })
        .expect(409);

      expect(response.body.error).toBe('CONFLICT');
    });
  });

  // ==========================================
  // Server Error (500)
  // ==========================================
  describe('500 Internal Server Error', () => {
    it('should return 500 on database connection error', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'ABC123' })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: 'Fout bij inschrijven',
        error: 'INTERNAL_SERVER_ERROR'
      });
    });

    it('should return 500 on query timeout', async () => {
      db.query.mockRejectedValueOnce(new Error('Query timeout'));

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'ABC123' })
        .expect(500);

      expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  // ==========================================
  // Content-Type Handling
  // ==========================================
  describe('Content-Type Handling', () => {
    it('should accept application/json', async () => {
      const mockCourse = { id: 1, title: 'Test', description: 'Test' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/students/me/courses/join')
        .set('Content-Type', 'application/json')
        .send({ join_code: 'TEST' })
        .expect(201);
    });

    it('should return response with correct content-type', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'TEST' })
        .expect(404);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  // ==========================================
  // Security Tests
  // ==========================================
  describe('Security', () => {
    it('should not expose internal errors in response', async () => {
      const internalError = new Error('Database table does not exist: secret_table');
      db.query.mockRejectedValueOnce(internalError);

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'TEST' })
        .expect(500);

      // Should not expose internal error details
      expect(response.body.message).not.toContain('secret_table');
      expect(response.body.message).toBe('Fout bij inschrijven');
    });

    it('should pass malicious input as parameter (not in query string)', async () => {
      // NOTE: This tests that input is passed as parameter.
      // Actual SQL injection prevention depends on pg driver behavior.
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: "'; DROP TABLE course; --" })
        .expect(404);

      // Verify malicious string is passed as parameter, not in query
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, title, description FROM course WHERE join_code = $1',
        ["'; DROP TABLE course; --"]
      );
    });

    it('should respond within reasonable time', async () => {
      // NOTE: This is NOT a timing attack prevention test.
      // Real timing attack tests require statistical analysis over many requests.
      // This simply verifies the endpoint doesn't hang.
      db.query.mockResolvedValueOnce({ rows: [] });

      const start = Date.now();
      await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'NONEXISTENT' })
        .expect(404);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });

  // ==========================================
  // Response Format Consistency
  // ==========================================
  describe('Response Format Consistency', () => {
    it('should always include success field', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'TEST' });

      expect(response.body).toHaveProperty('success');
      expect(typeof response.body.success).toBe('boolean');
    });

    it('should always include message field', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'TEST' });

      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
    });

    it('should always include error field', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'TEST' });

      expect(response.body).toHaveProperty('error');
    });

    it('should include data on success', async () => {
      const mockCourse = { id: 1, title: 'Test', description: 'Test' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/students/me/courses/join')
        .send({ join_code: 'TEST' })
        .expect(201);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('course');
    });
  });
});
