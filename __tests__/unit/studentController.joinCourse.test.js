/**
 * Unit tests for studentController.joinCourseByCode
 * Tests course enrollment via join code functionality
 */

// Mock database before importing
jest.mock('../../src/config/db', () => ({
  query: jest.fn()
}));

const db = require('../../src/config/db');
const { joinCourseByCode } = require('../../src/controllers/studentController');

describe('studentController.joinCourseByCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Success Cases
  // ==========================================
  describe('Success Cases', () => {
    it('should successfully enroll student with valid join code', async () => {
      const mockCourse = { id: 1, title: 'Web Development', description: 'Learn web dev' };

      // Mock: course lookup returns course
      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })  // SELECT course
        .mockResolvedValueOnce({ rows: [] })             // SELECT enrollment (not enrolled)
        .mockResolvedValueOnce({ rows: [] });            // INSERT enrollment

      const result = await joinCourseByCode(5, 'ABC123');

      expect(result).toEqual({
        success: true,
        course: mockCourse
      });
      expect(db.query).toHaveBeenCalledTimes(3);
      expect(db.query).toHaveBeenNthCalledWith(1,
        'SELECT id, title, description FROM course WHERE join_code = $1',
        ['ABC123']
      );
      expect(db.query).toHaveBeenNthCalledWith(2,
        'SELECT id FROM enrollment WHERE user_id = $1 AND course_id = $2',
        [5, 1]
      );
      expect(db.query).toHaveBeenNthCalledWith(3,
        'INSERT INTO enrollment (course_id, user_id, created_at) VALUES ($1, $2, NOW())',
        [1, 5]
      );
    });

    it('should pass join code to database as-is (case preservation)', async () => {
      // Note: Case sensitivity depends on database collation, not this function
      // This test verifies we pass the join code unchanged to the query
      db.query.mockResolvedValueOnce({ rows: [] });

      await joinCourseByCode(1, 'abc123');

      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, title, description FROM course WHERE join_code = $1',
        ['abc123']  // Verify exact casing is preserved
      );
    });
  });

  // ==========================================
  // Invalid Join Code Cases
  // ==========================================
  describe('Invalid Join Code', () => {
    it('should return INVALID_JOIN_CODE when course does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await joinCourseByCode(1, 'INVALID');

      expect(result).toEqual({
        success: false,
        error: 'INVALID_JOIN_CODE'
      });
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('should query database even with empty join code string', async () => {
      // Note: In production, empty strings are blocked at route level (400)
      // This tests controller behavior if called directly with empty string
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await joinCourseByCode(1, '');

      expect(result).toEqual({
        success: false,
        error: 'INVALID_JOIN_CODE'
      });
      // Verify query was still made (controller doesn't validate input)
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, title, description FROM course WHERE join_code = $1',
        ['']
      );
    });

    it('should handle special characters in join code', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await joinCourseByCode(1, "'; DROP TABLE course; --");

      expect(result).toEqual({
        success: false,
        error: 'INVALID_JOIN_CODE'
      });
      // Verify parameterized query was used (SQL injection safe)
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, title, description FROM course WHERE join_code = $1',
        ["'; DROP TABLE course; --"]
      );
    });
  });

  // ==========================================
  // Already Enrolled Cases
  // ==========================================
  describe('Already Enrolled', () => {
    it('should return ALREADY_ENROLLED when student is already enrolled', async () => {
      const mockCourse = { id: 1, title: 'Web Development', description: 'Learn web dev' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })       // SELECT course
        .mockResolvedValueOnce({ rows: [{ id: 99 }] });      // SELECT enrollment (already enrolled)

      const result = await joinCourseByCode(5, 'ABC123');

      expect(result).toEqual({
        success: false,
        error: 'ALREADY_ENROLLED',
        course: mockCourse
      });
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should include course info in ALREADY_ENROLLED response', async () => {
      const mockCourse = { id: 42, title: 'Advanced Programming', description: 'Expert level' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await joinCourseByCode(10, 'ADV2024');

      expect(result.course).toBeDefined();
      expect(result.course.id).toBe(42);
      expect(result.course.title).toBe('Advanced Programming');
    });
  });

  // ==========================================
  // Race Condition Handling
  // ==========================================
  describe('Race Condition (Duplicate Key)', () => {
    it('should handle duplicate key violation gracefully', async () => {
      const mockCourse = { id: 1, title: 'Web Development', description: 'Learn web dev' };
      const duplicateKeyError = new Error('duplicate key value violates unique constraint');
      duplicateKeyError.code = '23505';
      duplicateKeyError.constraint = 'enrollment_course_id_user_id_key';

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })  // SELECT course
        .mockResolvedValueOnce({ rows: [] })             // SELECT enrollment (not enrolled at check time)
        .mockRejectedValueOnce(duplicateKeyError)        // INSERT fails due to race condition
        .mockResolvedValueOnce({ rows: [mockCourse] });  // Re-fetch course for response

      const result = await joinCourseByCode(5, 'ABC123');

      expect(result).toEqual({
        success: false,
        error: 'ALREADY_ENROLLED',
        course: mockCourse
      });
    });

    it('should re-throw non-duplicate-key database errors', async () => {
      const mockCourse = { id: 1, title: 'Web Development', description: 'Test' };
      const dbError = new Error('Connection lost');
      dbError.code = '08006';

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(dbError);

      await expect(joinCourseByCode(5, 'ABC123')).rejects.toThrow('Connection lost');
    });

    it('should handle other unique constraint violations by re-throwing', async () => {
      const mockCourse = { id: 1, title: 'Test', description: 'Test' };
      const otherConstraintError = new Error('other constraint violation');
      otherConstraintError.code = '23505';
      otherConstraintError.constraint = 'some_other_constraint';

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(otherConstraintError);

      await expect(joinCourseByCode(5, 'ABC123')).rejects.toThrow('other constraint violation');
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================
  describe('Edge Cases', () => {
    it('should handle studentId of 0', async () => {
      const mockCourse = { id: 1, title: 'Test Course', description: null };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await joinCourseByCode(0, 'TEST');

      expect(result.success).toBe(true);
      expect(db.query).toHaveBeenNthCalledWith(2,
        'SELECT id FROM enrollment WHERE user_id = $1 AND course_id = $2',
        [0, 1]
      );
    });

    it('should handle course with null description', async () => {
      const mockCourse = { id: 1, title: 'Minimal Course', description: null };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await joinCourseByCode(1, 'MIN');

      expect(result.success).toBe(true);
      expect(result.course.description).toBeNull();
    });

    it('should handle very long join codes', async () => {
      const longJoinCode = 'A'.repeat(1000);
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await joinCourseByCode(1, longJoinCode);

      expect(result).toEqual({
        success: false,
        error: 'INVALID_JOIN_CODE'
      });
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, title, description FROM course WHERE join_code = $1',
        [longJoinCode]
      );
    });

    it('should handle unicode in join code', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await joinCourseByCode(1, '课程代码');

      expect(result).toEqual({
        success: false,
        error: 'INVALID_JOIN_CODE'
      });
    });

    it('should handle numeric join code as string', async () => {
      const mockCourse = { id: 1, title: 'Course', description: 'Test' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await joinCourseByCode(1, '123456');

      expect(result.success).toBe(true);
    });
  });

  // ==========================================
  // Database Error Handling
  // ==========================================
  describe('Database Errors', () => {
    it('should throw on course lookup database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(joinCourseByCode(1, 'TEST')).rejects.toThrow('Database connection failed');
    });

    it('should throw on enrollment check database error', async () => {
      const mockCourse = { id: 1, title: 'Test', description: 'Test' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockRejectedValueOnce(new Error('Query timeout'));

      await expect(joinCourseByCode(1, 'TEST')).rejects.toThrow('Query timeout');
    });

    it('should throw on insert database error (non-duplicate)', async () => {
      const mockCourse = { id: 1, title: 'Test', description: 'Test' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('Foreign key violation'));

      await expect(joinCourseByCode(1, 'TEST')).rejects.toThrow('Foreign key violation');
    });
  });

  // ==========================================
  // Parameterized Query Verification
  // ==========================================
  describe('Parameterized Query Usage', () => {
    // NOTE: These tests verify that parameterized queries are USED.
    // Actual SQL injection prevention depends on the database driver (pg).
    // With mocks, we cannot test actual SQL execution safety.

    it('should pass join code as parameter, not interpolated in query', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await joinCourseByCode(1, "test'; DELETE FROM course; --");

      // Verify: malicious string is passed as parameter $1, not in query string
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, title, description FROM course WHERE join_code = $1',
        ["test'; DELETE FROM course; --"]
      );
      // The query string itself should NOT contain the malicious input
      const [queryString] = db.query.mock.calls[0];
      expect(queryString).not.toContain('DELETE');
    });

    it('should pass studentId as parameter in enrollment check', async () => {
      const mockCourse = { id: 1, title: 'Test', description: 'Test' };

      db.query
        .mockResolvedValueOnce({ rows: [mockCourse] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await joinCourseByCode(999, 'TEST');

      expect(db.query).toHaveBeenNthCalledWith(2,
        'SELECT id FROM enrollment WHERE user_id = $1 AND course_id = $2',
        [999, 1]
      );
    });
  });
});
