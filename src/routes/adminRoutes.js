const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

/**
 * GET /api/admin/students
 * Haalt alle studenten op (alleen voor admins)
 */
router.get('/admin/students', async (req, res) => {
  try {
    const students = await adminController.getAllStudents();

    // Validatie: controleer of er studenten beschikbaar zijn
    if (students.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Geen studenten gevonden',
        error: null
      });
    }

    res.status(200).json({
      success: true,
      data: students,
      message: `${students.length} studenten gevonden`,
      error: null
    });
  } catch (error) {
    console.error('Fout bij ophalen studenten:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen studenten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;
