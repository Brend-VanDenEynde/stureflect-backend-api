/**
 * Unit tests for SSE Manager
 * Manages Server-Sent Events connections for real-time feedback notifications
 */

const sseManager = require('../../src/services/sseManager');

describe('sseManager', () => {
  // Mock response object
  const createMockResponse = () => ({
    write: jest.fn(),
    on: jest.fn(),
    writeHead: jest.fn(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn()
  });

  beforeEach(() => {
    // Clear all connections before each test
    sseManager.clearAll();
  });

  // ==========================================
  // Subscribe Tests
  // ==========================================
  describe('subscribe', () => {
    it('should register a connection for a submission', () => {
      const mockRes = createMockResponse();

      sseManager.subscribe(42, mockRes);

      expect(sseManager.getConnectionCount(42)).toBe(1);
    });

    it('should allow multiple connections for the same submission', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      sseManager.subscribe(42, mockRes1);
      sseManager.subscribe(42, mockRes2);

      expect(sseManager.getConnectionCount(42)).toBe(2);
    });

    it('should handle connections for different submissions independently', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      sseManager.subscribe(42, mockRes1);
      sseManager.subscribe(99, mockRes2);

      expect(sseManager.getConnectionCount(42)).toBe(1);
      expect(sseManager.getConnectionCount(99)).toBe(1);
    });

    it('should set up close event handler', () => {
      const mockRes = createMockResponse();

      sseManager.subscribe(42, mockRes);

      expect(mockRes.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  // ==========================================
  // Unsubscribe Tests
  // ==========================================
  describe('unsubscribe', () => {
    it('should remove a connection for a submission', () => {
      const mockRes = createMockResponse();

      sseManager.subscribe(42, mockRes);
      sseManager.unsubscribe(42, mockRes);

      expect(sseManager.getConnectionCount(42)).toBe(0);
    });

    it('should not throw when unsubscribing non-existent connection', () => {
      const mockRes = createMockResponse();

      expect(() => sseManager.unsubscribe(42, mockRes)).not.toThrow();
    });

    it('should only remove the specified connection', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      sseManager.subscribe(42, mockRes1);
      sseManager.subscribe(42, mockRes2);
      sseManager.unsubscribe(42, mockRes1);

      expect(sseManager.getConnectionCount(42)).toBe(1);
    });
  });

  // ==========================================
  // Broadcast Tests
  // ==========================================
  describe('broadcast', () => {
    it('should send event to all connections for a submission', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      sseManager.subscribe(42, mockRes1);
      sseManager.subscribe(42, mockRes2);

      sseManager.broadcast(42, 'feedback_updated');

      expect(mockRes1.write).toHaveBeenCalled();
      expect(mockRes2.write).toHaveBeenCalled();
    });

    it('should format event correctly as SSE', () => {
      const mockRes = createMockResponse();

      sseManager.subscribe(42, mockRes);
      sseManager.broadcast(42, 'feedback_updated', { submissionId: 42 });

      const writeCall = mockRes.write.mock.calls[0][0];
      expect(writeCall).toContain('event: feedback_updated');
      expect(writeCall).toContain('data:');
      expect(writeCall).toContain('"submissionId":42');
    });

    it('should not throw when broadcasting to submission with no connections', () => {
      expect(() => sseManager.broadcast(999, 'feedback_updated')).not.toThrow();
    });

    it('should not send to connections of other submissions', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      sseManager.subscribe(42, mockRes1);
      sseManager.subscribe(99, mockRes2);

      sseManager.broadcast(42, 'feedback_updated');

      expect(mockRes1.write).toHaveBeenCalled();
      expect(mockRes2.write).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Send Heartbeat Tests
  // ==========================================
  describe('sendHeartbeat', () => {
    it('should send heartbeat event to a specific connection', () => {
      const mockRes = createMockResponse();

      sseManager.sendHeartbeat(mockRes);

      const writeCall = mockRes.write.mock.calls[0][0];
      expect(writeCall).toContain('event: heartbeat');
      expect(writeCall).toContain('data:');
    });
  });

  // ==========================================
  // Utility Tests
  // ==========================================
  describe('getConnectionCount', () => {
    it('should return 0 for submission with no connections', () => {
      expect(sseManager.getConnectionCount(999)).toBe(0);
    });

    it('should return correct count after subscribe and unsubscribe', () => {
      const mockRes = createMockResponse();

      expect(sseManager.getConnectionCount(42)).toBe(0);

      sseManager.subscribe(42, mockRes);
      expect(sseManager.getConnectionCount(42)).toBe(1);

      sseManager.unsubscribe(42, mockRes);
      expect(sseManager.getConnectionCount(42)).toBe(0);
    });
  });

  describe('getTotalConnectionCount', () => {
    it('should return total connections across all submissions', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const mockRes3 = createMockResponse();

      sseManager.subscribe(42, mockRes1);
      sseManager.subscribe(42, mockRes2);
      sseManager.subscribe(99, mockRes3);

      expect(sseManager.getTotalConnectionCount()).toBe(3);
    });
  });

  describe('clearAll', () => {
    it('should remove all connections', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      sseManager.subscribe(42, mockRes1);
      sseManager.subscribe(99, mockRes2);

      sseManager.clearAll();

      expect(sseManager.getTotalConnectionCount()).toBe(0);
    });
  });
});
