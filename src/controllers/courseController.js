const pool = require('../config/db');

const getAllCourses = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, join_code, created_at FROM course'
    );
    console.log(`[DEBUG] GET /api/courses - Fetched ${result.rows.length} courses`);
    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het ophalen van de cursussen'
    });
  }
};

module.exports = { getAllCourses };
