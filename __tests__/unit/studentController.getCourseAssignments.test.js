/**
 * Unit tests for studentController.getCourseAssignments
 * Tests fetching course assignments with enhanced submission status
 */

// Mock database before importing
jest.mock('../../src/config/db', () => ({
  query: jest.fn()
}));

const db = require('../../src/config/db');
const { getCourseAssignments } = require('../../src/controllers/studentController');

describe('studentController.getCourseAssignments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Enhanced Submission Status
  // ==========================================
  describe('Enhanced Submission Status', () => {
    it('should return progress_percentage based on ai_score', async () => {
      const mockData = [{
        id: 1,
        title: 'Test Assignment',
        description: 'Description',
        due_date: '2025-01-15T23:59:59Z',
        created_at: '2025-01-01T10:00:00Z',
        submission_id: 42,
        status: 'analyzed',
        ai_score: 75,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 1,
        medium_count: 2,
        low_count: 3,
        feedback_count: 6
      }];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const result = await getCourseAssignments(1, 5);

      expect(result[0].progress_percentage).toBe(75);
    });

    it('should return status_text "Uitstekend" when no feedback at all', async () => {
      const mockData = [{
        id: 1,
        title: 'Test Assignment',
        description: 'Description',
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        submission_id: 42,
        submission_status: 'submitted',
        status: 'analyzed',
        ai_score: 100,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        feedback_count: 0
      }];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const result = await getCourseAssignments(1, 5);

      expect(result[0].status_text).toBe('Uitstekend');
    });

    it('should return status_text "Actie vereist" when critical feedback exists', async () => {
      const mockData = [{
        id: 1,
        title: 'Test Assignment',
        description: 'Description',
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        submission_id: 42,
        status: 'analyzed',
        ai_score: 40,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 2,
        high_count: 1,
        medium_count: 0,
        low_count: 0,
        feedback_count: 3
      }];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const result = await getCourseAssignments(1, 5);

      expect(result[0].status_text).toBe('Actie vereist');
    });

    it('should return status_text "Verbeteringen nodig" when high feedback exists', async () => {
      const mockData = [{
        id: 1,
        title: 'Test Assignment',
        description: 'Description',
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        submission_id: 42,
        status: 'analyzed',
        ai_score: 60,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 3,
        medium_count: 1,
        low_count: 0,
        feedback_count: 4
      }];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const result = await getCourseAssignments(1, 5);

      expect(result[0].status_text).toBe('Verbeteringen nodig');
    });

    it('should return status_text "Goed op weg" when only medium/low feedback', async () => {
      const mockData = [{
        id: 1,
        title: 'Test Assignment',
        description: 'Description',
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        submission_id: 42,
        status: 'analyzed',
        ai_score: 80,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 0,
        medium_count: 3,
        low_count: 2,
        feedback_count: 5
      }];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const result = await getCourseAssignments(1, 5);

      expect(result[0].status_text).toBe('Goed op weg');
    });

    it('should return feedback_count from query', async () => {
      const mockData = [{
        id: 1,
        title: 'Test Assignment',
        description: 'Description',
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        submission_id: 42,
        status: 'analyzed',
        ai_score: 85,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 0,
        medium_count: 2,
        low_count: 5,
        feedback_count: 7
      }];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const result = await getCourseAssignments(1, 5);

      expect(result[0].feedback_count).toBe(7);
    });

    it('should return ai_score from query', async () => {
      const mockData = [{
        id: 1,
        title: 'Test Assignment',
        description: 'Description',
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        submission_id: 42,
        status: 'analyzed',
        ai_score: 92,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 0,
        medium_count: 1,
        low_count: 1,
        feedback_count: 2
      }];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const result = await getCourseAssignments(1, 5);

      expect(result[0].ai_score).toBe(92);
    });

    it('should return last_analysis_date from submission updated_at', async () => {
      const mockData = [{
        id: 1,
        title: 'Test Assignment',
        description: 'Description',
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        submission_id: 42,
        status: 'analyzed',
        ai_score: 85,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        feedback_count: 0
      }];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const result = await getCourseAssignments(1, 5);

      expect(result[0].last_analysis_date).toBe('2025-01-10T14:30:00Z');
    });
  });

  // ==========================================
  // Pending/No Submission Cases
  // ==========================================
  describe('Pending/No Submission Cases', () => {
    it('should return status_text "Nog niet ingediend" when no submission', async () => {
      const mockData = [{
        id: 1,
        title: 'Test Assignment',
        description: 'Description',
        due_date: '2025-01-15T23:59:59Z',
        created_at: '2025-01-01T10:00:00Z',
        submission_id: null,
        submission_status: 'pending',
        status: null,
        ai_score: null,
        last_analysis_date: null,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        feedback_count: 0
      }];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const result = await getCourseAssignments(1, 5);

      expect(result[0].status_text).toBe('Nog niet ingediend');
      expect(result[0].submission_status).toBe('pending');
    });

    it('should return progress_percentage 0 when no submission', async () => {
      const mockData = [{
        id: 1,
        title: 'Test Assignment',
        description: 'Description',
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        submission_id: null,
        status: null,
        ai_score: null,
        last_analysis_date: null,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        feedback_count: 0
      }];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const result = await getCourseAssignments(1, 5);

      expect(result[0].progress_percentage).toBe(0);
    });

    it('should return status_text "In behandeling" when submitted but not yet analyzed', async () => {
      const mockData = [{
        id: 1,
        title: 'Test Assignment',
        description: 'Description',
        due_date: null,
        created_at: '2025-01-01T10:00:00Z',
        submission_id: 42,
        status: 'pending',
        ai_score: null,
        last_analysis_date: '2025-01-10T14:30:00Z',
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        feedback_count: 0
      }];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const result = await getCourseAssignments(1, 5);

      expect(result[0].status_text).toBe('In behandeling');
    });
  });

  // ==========================================
  // Query Structure
  // ==========================================
  describe('Query Structure', () => {
    it('should query with feedback counts subquery', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getCourseAssignments(1, 5);

      // Verify the query includes feedback counting
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('feedback'),
        expect.any(Array)
      );
    });

    it('should use LEFT JOIN for feedback counts', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getCourseAssignments(1, 5);

      // Verify LEFT JOIN is used for feedback subquery
      const calledQuery = db.query.mock.calls[0][0];
      expect(calledQuery).toContain('LEFT JOIN');
      expect(calledQuery).toContain('FROM feedback');
      expect(calledQuery).toContain('fc ON');
    });
  });

  // ==========================================
  // Filtering (existing functionality)
  // ==========================================
  describe('Filtering', () => {
    it('should filter by submitted status', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getCourseAssignments(1, 5, { status: 'submitted' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('s.id IS NOT NULL'),
        expect.any(Array)
      );
    });

    it('should filter by pending status', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getCourseAssignments(1, 5, { status: 'pending' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('s.id IS NULL'),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Sorting (existing functionality)
  // ==========================================
  describe('Sorting', () => {
    it('should sort by due_date ascending by default', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getCourseAssignments(1, 5);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY a.due_date ASC'),
        expect.any(Array)
      );
    });

    it('should sort by title when specified', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getCourseAssignments(1, 5, { sortBy: 'title', order: 'desc' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY a.title DESC'),
        expect.any(Array)
      );
    });
  });

  // ==========================================
  // Error Handling
  // ==========================================
  describe('Error Handling', () => {
    it('should throw on database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(getCourseAssignments(1, 5))
        .rejects.toThrow('Connection failed');
    });
  });
});
