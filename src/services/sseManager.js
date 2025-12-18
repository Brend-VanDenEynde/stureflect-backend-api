/**
 * SSE Manager - Manages Server-Sent Events connections for real-time notifications
 *
 * Used to notify students when new feedback is available for their submissions.
 */

// In-memory storage for active connections
// Map<submissionId, Set<response>>
const connections = new Map();

/**
 * Subscribe a client to SSE events for a submission
 * @param {number} submissionId - The submission ID to subscribe to
 * @param {object} res - Express response object
 */
function subscribe(submissionId, res) {
  if (!connections.has(submissionId)) {
    connections.set(submissionId, new Set());
  }

  connections.get(submissionId).add(res);
  console.log(`[SSE] ✅ Client subscribed to submission ${submissionId}. Active connections: ${connections.get(submissionId).size}`);

  // Set up cleanup on connection close
  res.on('close', () => {
    unsubscribe(submissionId, res);
  });
}

/**
 * Unsubscribe a client from SSE events for a submission
 * @param {number} submissionId - The submission ID to unsubscribe from
 * @param {object} res - Express response object
 */
function unsubscribe(submissionId, res) {
  const submissionConnections = connections.get(submissionId);
  if (submissionConnections) {
    submissionConnections.delete(res);

    // Clean up empty sets
    if (submissionConnections.size === 0) {
      connections.delete(submissionId);
    }
  }
}

/**
 * Broadcast an event to all clients subscribed to a submission
 * @param {number} submissionId - The submission ID to broadcast to
 * @param {string} eventType - The event type (e.g., 'feedback_updated')
 * @param {object} data - Optional data to include in the event
 */
function broadcast(submissionId, eventType, data = {}) {
  const submissionConnections = connections.get(submissionId);
  if (!submissionConnections || submissionConnections.size === 0) {
    console.log(`[SSE] ⚠️ No active connections for submission ${submissionId}, broadcast skipped`);
    return;
  }

  console.log(`[SSE] 📤 Broadcasting ${eventType} to ${submissionConnections.size} client(s) for submission ${submissionId}`);

  const eventData = {
    ...data,
    submissionId,
    timestamp: new Date().toISOString()
  };

  const message = formatSSEMessage(eventType, eventData);

  for (const res of submissionConnections) {
    try {
      res.write(message);
    } catch (error) {
      console.error(`[SSE] Error sending to client:`, error.message);
      // Remove failed connection
      unsubscribe(submissionId, res);
    }
  }
}

/**
 * Send a heartbeat to keep connection alive
 * @param {object} res - Express response object
 */
function sendHeartbeat(res) {
  const message = formatSSEMessage('heartbeat', {
    timestamp: new Date().toISOString()
  });

  try {
    res.write(message);
  } catch (error) {
    console.error(`[SSE] Error sending heartbeat:`, error.message);
  }
}

/**
 * Format a message as SSE
 * @param {string} eventType - The event type
 * @param {object} data - The data payload
 * @returns {string} Formatted SSE message
 */
function formatSSEMessage(eventType, data) {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Get the number of connections for a submission
 * @param {number} submissionId - The submission ID
 * @returns {number} Number of active connections
 */
function getConnectionCount(submissionId) {
  const submissionConnections = connections.get(submissionId);
  return submissionConnections ? submissionConnections.size : 0;
}

/**
 * Get the total number of connections across all submissions
 * @returns {number} Total number of active connections
 */
function getTotalConnectionCount() {
  let total = 0;
  for (const submissionConnections of connections.values()) {
    total += submissionConnections.size;
  }
  return total;
}

/**
 * Clear all connections (for testing)
 */
function clearAll() {
  connections.clear();
}

module.exports = {
  subscribe,
  unsubscribe,
  broadcast,
  sendHeartbeat,
  getConnectionCount,
  getTotalConnectionCount,
  clearAll
};
