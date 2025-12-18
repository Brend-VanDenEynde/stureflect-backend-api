/**
 * Unit tests for studentController.getAssignmentDetail
 * Tests fetching assignment details with course context and submission status
 */

// Mock database before importing
jest.mock('../../src/config/db', () => ({
  query: jest.fn()
}));

const db = require('../../src/config/db');
const { getAssignmentDetail } = require('../../src/controllers/studentController');

describe('studentController.getAssignmentDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Success Cases
  // ==========================================
  describe('Success Cases', () => {
    it('should return assignment with course, rubric and submission status', async () => {
      const mockAssignmentData = {
        id: 1,
        title: 'JavaScript Basics',
        description: 'Maak een calculator app',
        due_date: '2025-01-15T23:59:59Z',
        created_at: '2025-01-01T10:00:00Z',
        course_id: 5,
        course_title: 'Web Development 101',
        rubric: 'Code kwaliteit: 40%...',
        ai_guidelines: 'Focus op clean code principes...',
        submission_id: 42,
        submission_status: 'analyzed',
        ai_score: 85,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 0,
        medium_count: 1,
        low_count: 2,
        feedback_count: 3,
        enrollment_id: 1  // Student is enrolled
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const result = await getAssignmentDetail(1, 5);

      expect(result.success).toBe(true);
      expect(result.data.assignment).toEqual({
        id: 1,
        title: 'JavaScript Basics',
        description: 'Maak een calculator app',
        due_date: '2025-01-15T23:59:59Z',
        created_at: '2025-01-01T10:00:00Z'
      });
      expect(result.data.course).toEqual({
        id: 5,
        title: 'Web Development 101',
        rubric: 'Code kwaliteit: 40%...',
        ai_guidelines: 'Focus op clean code principes...'
      });
      expect(result.data.submission_status.has_submitted).toBe(true);
      expect(result.data.submission_status.submission_id).toBe(42);
      // New enhanced fields
      expect(result.data.submission_status.status_text).toBe('Goed op weg');
      expect(result.data.submission_status.progress_percentage).toBe(85);
    });

    it('should return has_submitted false when no submission exists', async () => {
      const mockAssignmentData = {
        id: 1,
        title: 'JavaScript Basics',
        description: 'Test opdracht',
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        course_id: 5,
        course_title: 'Web Development 101',
        rubric: null,
        ai_guidelines: null,
        submission_id: null,
        submission_status: null,
        ai_score: null,
        last_analysis_date: null,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        feedback_count: 0,
        enrollment_id: 1
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const result = await getAssignmentDetail(1, 5);

      expect(result.success).toBe(true);
      expect(result.data.submission_status.has_submitted).toBe(false);
      expect(result.data.submission_status.submission_id).toBeNull();
      expect(result.data.submission_status.status_text).toBe('Nog niet ingediend');
      expect(result.data.submission_status.progress_percentage).toBe(0);
    });

    it('should handle null rubric and ai_guidelines', async () => {
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

      const result = await getAssignmentDetail(1, 5);

      expect(result.success).toBe(true);
      expect(result.data.course.rubric).toBeNull();
      expect(result.data.course.ai_guidelines).toBeNull();
    });
  });

  // ==========================================
  // Not Enrolled (403 Forbidden)
  // ==========================================
  describe('Not Enrolled', () => {
    it('should return FORBIDDEN when student is not enrolled in course', async () => {
      const mockAssignmentData = {
        id: 1,
        title: 'Test',
        course_id: 5,
        course_title: 'Course',
        enrollment_id: null  // Not enrolled
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const result = await getAssignmentDetail(1, 999);

      expect(result).toEqual({
        success: false,
        error: 'FORBIDDEN'
      });
    });
  });

  // ==========================================
  // Not Found (404)
  // ==========================================
  describe('Not Found', () => {
    it('should return NOT_FOUND when assignment does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // Assignment not found

      const result = await getAssignmentDetail(999, 5);

      expect(result).toEqual({
        success: false,
        error: 'NOT_FOUND'
      });
    });
  });

  // ==========================================
  // Database Errors
  // ==========================================
  describe('Database Errors', () => {
    it('should throw on database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(getAssignmentDetail(1, 5))
        .rejects.toThrow('Connection failed');
    });
  });

  // ==========================================
  // Enhanced Submission Status
  // ==========================================
  describe('Enhanced Submission Status', () => {
    it('should return feedback_summary with severity counts', async () => {
      const mockAssignmentData = {
        id: 1,
        title: 'JavaScript Basics',
        description: 'Test opdracht',
        due_date: '2025-01-15T23:59:59Z',
        created_at: '2025-01-01T10:00:00Z',
        course_id: 5,
        course_title: 'Web Development 101',
        rubric: null,
        ai_guidelines: null,
        submission_id: 42,
        submission_status: 'analyzed',
        ai_score: 85,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 1,
        medium_count: 2,
        low_count: 3,
        feedback_count: 6,
        enrollment_id: 1
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const result = await getAssignmentDetail(1, 5);

      expect(result.success).toBe(true);
      expect(result.data.submission_status.feedback_summary).toEqual({
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        total: 6
      });
    });

    it('should return status_text based on feedback severity', async () => {
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
        submission_id: 42,
        submission_status: 'analyzed',
        ai_score: 60,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 1,
        high_count: 2,
        medium_count: 0,
        low_count: 0,
        feedback_count: 3,
        enrollment_id: 1
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const result = await getAssignmentDetail(1, 5);

      expect(result.data.submission_status.status_text).toBe('Actie vereist');
    });

    it('should return progress_percentage from ai_score', async () => {
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
        submission_id: 42,
        submission_status: 'analyzed',
        ai_score: 75,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 0,
        medium_count: 1,
        low_count: 1,
        feedback_count: 2,
        enrollment_id: 1
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const result = await getAssignmentDetail(1, 5);

      expect(result.data.submission_status.progress_percentage).toBe(75);
    });

    it('should return last_analysis_date from submission', async () => {
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
        submission_id: 42,
        submission_status: 'analyzed',
        ai_score: 90,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        feedback_count: 0,
        enrollment_id: 1
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const result = await getAssignmentDetail(1, 5);

      expect(result.data.submission_status.last_analysis_date).toBe('2025-01-10T14:30:00Z');
    });

    it('should return status_text "Nog niet ingediend" when no submission', async () => {
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
        submission_status: null,
        ai_score: null,
        last_analysis_date: null,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        feedback_count: 0,
        enrollment_id: 1
      };

      db.query.mockResolvedValueOnce({ rows: [mockAssignmentData] });

      const result = await getAssignmentDetail(1, 5);

      expect(result.data.submission_status.status_text).toBe('Nog niet ingediend');
      expect(result.data.submission_status.progress_percentage).toBe(0);
    });
  });

  // ==========================================
  // Parameterized Queries
  // ==========================================
  describe('Parameterized Queries', () => {
    it('should use parameterized query with assignmentId and studentId', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getAssignmentDetail(42, 7);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.id = $1'),
        [42, 7]
      );
    });

    it('should include enrollment check in the same query (no information leakage)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getAssignmentDetail(1, 5);

      // Verify enrollment is checked in same query via LEFT JOIN
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN enrollment'),
        expect.any(Array)
      );
      // Should only be called once (combined query)
      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });
});
