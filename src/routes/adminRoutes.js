const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

/**
 * GET /api/admin/students
 * Haalt alle studenten op (alleen voor admins)
 */
router.get('/admin/students', async (req, res) => {
  try {
    // Development: query param fallback, Productie: alleen req.user.id
    const adminId = req.user?.id || parseInt(req.query.adminId);

    // Autorisatie: controleer of gebruiker admin is
    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

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
