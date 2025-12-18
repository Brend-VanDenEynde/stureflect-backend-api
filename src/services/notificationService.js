const EventEmitter = require('events');

/**
 * Notification Service for Real-time Course Statistics Updates
 * 
 * This service manages SSE connections and emits events when course-related
 * data changes (submissions, enrollments, feedback, etc.)
 */
class NotificationService extends EventEmitter {
  constructor() {
    super();
    // Registry of SSE connections per course
    // Structure: { courseId: Set<responseObject> }
    this.courseConnections = new Map();
    
    // Track last event per course for debugging
    this.lastEvents = new Map();
    
    console.log('📡 Notification Service initialized');
  }

  /**
   * Register an SSE connection for a specific course
   * @param {number} courseId - The course ID
   * @param {object} res - Express response object
   * @returns {Function} Cleanup function to call on disconnect
   */
  registerConnection(courseId, res) {
    if (!this.courseConnections.has(courseId)) {
      this.courseConnections.set(courseId, new Set());
    }
    
    this.courseConnections.get(courseId).add(res);
    
    console.log(`✅ SSE connection registered for course ${courseId}. Total: ${this.courseConnections.get(courseId).size}`);
    
    // Return cleanup function
    return () => {
      this.unregisterConnection(courseId, res);
    };
  }

  /**
   * Unregister an SSE connection
   * @param {number} courseId - The course ID
   * @param {object} res - Express response object
   */
  unregisterConnection(courseId, res) {
    const connections = this.courseConnections.get(courseId);
    if (connections) {
      connections.delete(res);
      
      console.log(`🔌 SSE connection closed for course ${courseId}. Remaining: ${connections.size}`);
      
      // Clean up empty sets
      if (connections.size === 0) {
        this.courseConnections.delete(courseId);
      }
    }
  }

  /**
   * Get active connection count for a course
   * @param {number} courseId - The course ID
   * @returns {number} Number of active connections
   */
  getConnectionCount(courseId) {
    const connections = this.courseConnections.get(courseId);
    return connections ? connections.size : 0;
  }

  /**
   * Send event to all SSE clients connected to a course
   * @param {number} courseId - The course ID
   * @param {object} eventData - Event data to send
   */
  sendEventToCourse(courseId, eventData) {
    const connections = this.courseConnections.get(courseId);
    
    if (!connections || connections.size === 0) {
      console.log(`⏭️  No active SSE connections for course ${courseId}, skipping event`);
      return;
    }

    const eventString = `data: ${JSON.stringify(eventData)}\n\n`;
    const deadConnections = new Set();

    // Send to all connected clients
    connections.forEach(res => {
      try {
        res.write(eventString);
      } catch (error) {
        console.error(`❌ Failed to send event to client:`, error.message);
        deadConnections.add(res);
      }
    });

    // Clean up dead connections
    deadConnections.forEach(res => {
      this.unregisterConnection(courseId, res);
    });

    console.log(`📤 Sent event to ${connections.size} SSE client(s) for course ${courseId}:`, eventData.type);
    
    // Store last event for debugging
    this.lastEvents.set(courseId, {
      ...eventData,
      sentAt: new Date().toISOString()
    });
  }

  /**
   * Emit a submission status change event
   * @param {number} courseId - The course ID
   * @param {object} data - Submission data
   */
  emitSubmissionStatusChange(courseId, data) {
    const eventData = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      courseId: parseInt(courseId),
      type: 'submission:status',
      data: {
        submissionId: data.submissionId,
        studentId: data.studentId,
        assignmentId: data.assignmentId,
        status: data.status,
        previousStatus: data.previousStatus || null
      }
    };

    this.sendEventToCourse(courseId, eventData);
    this.emit('submission:status', eventData);
  }

  /**
   * Emit a submission analyzed event (with score)
   * @param {number} courseId - The course ID
   * @param {object} data - Submission data with score
   */
  emitSubmissionAnalyzed(courseId, data) {
    const eventData = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      courseId: parseInt(courseId),
      type: 'submission:analyzed',
      data: {
        submissionId: data.submissionId,
        studentId: data.studentId,
        assignmentId: data.assignmentId,
        aiScore: data.aiScore,
        status: 'analyzed'
      }
    };

    this.sendEventToCourse(courseId, eventData);
    this.emit('submission:analyzed', eventData);
  }

  /**
   * Emit a feedback added event
   * @param {number} courseId - The course ID
   * @param {object} data - Feedback data
   */
  emitFeedbackAdded(courseId, data) {
    const eventData = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      courseId: parseInt(courseId),
      type: 'feedback:added',
      data: {
        submissionId: data.submissionId,
        studentId: data.studentId,
        assignmentId: data.assignmentId,
        feedbackCount: data.feedbackCount || null,
        avgSeverity: data.avgSeverity || null
      }
    };

    this.sendEventToCourse(courseId, eventData);
    this.emit('feedback:added', eventData);
  }

  /**
   * Emit a student enrollment change event
   * @param {number} courseId - The course ID
   * @param {object} data - Enrollment data
   */
  emitEnrollmentChange(courseId, data) {
    const eventData = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      courseId: parseInt(courseId),
      type: data.action === 'added' ? 'enrollment:added' : 'enrollment:removed',
      data: {
        studentId: data.studentId,
        studentName: data.studentName || null,
        studentEmail: data.studentEmail || null
      }
    };

    this.sendEventToCourse(courseId, eventData);
    this.emit('enrollment:change', eventData);
  }

  /**
   * Generic method to emit course statistics update
   * @param {number} courseId - The course ID
   * @param {string} eventType - Type of event
   * @param {object} data - Event-specific data
   */
  emitCourseStatisticsUpdate(courseId, eventType, data) {
    const eventData = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      courseId: parseInt(courseId),
      type: eventType,
      data
    };

    this.sendEventToCourse(courseId, eventData);
    this.emit('statistics:update', eventData);
  }

  /**
   * Send heartbeat/keepalive to all connections
   */
  sendHeartbeat() {
    let totalConnections = 0;
    
    this.courseConnections.forEach((connections, courseId) => {
      const heartbeat = `:heartbeat\n\n`;
      const deadConnections = new Set();

      connections.forEach(res => {
        try {
          res.write(heartbeat);
          totalConnections++;
        } catch (error) {
          deadConnections.add(res);
        }
      });

      deadConnections.forEach(res => {
        this.unregisterConnection(courseId, res);
      });
    });

    if (totalConnections > 0) {
      console.log(`💓 Heartbeat sent to ${totalConnections} SSE connection(s)`);
    }
  }

  /**
   * Get statistics about active connections
   * @returns {object} Connection statistics
   */
  getStats() {
    const stats = {
      totalCourses: this.courseConnections.size,
      totalConnections: 0,
      courseBreakdown: {}
    };

    this.courseConnections.forEach((connections, courseId) => {
      stats.totalConnections += connections.size;
      stats.courseBreakdown[courseId] = connections.size;
    });

    return stats;
  }

  /**
   * Get last event for a course (for debugging)
   * @param {number} courseId - The course ID
   * @returns {object|null} Last event or null
   */
  getLastEvent(courseId) {
    return this.lastEvents.get(courseId) || null;
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Start heartbeat interval (every 30 seconds)
setInterval(() => {
  notificationService.sendHeartbeat();
}, 30000);

module.exports = notificationService;
