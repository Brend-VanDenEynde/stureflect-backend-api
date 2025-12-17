const db = require('../config/db');

/**
 * Haalt alle studenten op uit de database
 * @returns {Promise<Array>} Array met studentgegevens
 */
async function getAllStudents() {
  const result = await db.query(
    `SELECT id, email, name, created_at, updated_at
     FROM "user"
     WHERE role = 'student'
     ORDER BY name ASC`
  );
  return result.rows;
}

/**
 * Haalt alle docenten op uit de database
 * @returns {Promise<Array>} Array met docentgegevens
 */
async function getAllTeachers() {
  const result = await db.query(
    `SELECT id, email, name, created_at, updated_at
     FROM "user"
     WHERE role = 'teacher'
     ORDER BY name ASC`
  );
  return result.rows;
}

/**
 * Haalt alle admins op uit de database
 * @returns {Promise<Array>} Array met admingegevens
 */
async function getAllAdmins() {
  const result = await db.query(
    `SELECT id, email, name, created_at, updated_at
     FROM "user"
     WHERE role = 'admin'
     ORDER BY name ASC`
  );
  return result.rows;
}

/**
 * Haalt alle vakken op van een specifieke docent
 * @param {number} teacherId - ID van de docent
 * @returns {Promise<Array>} Array met vakgegevens gekoppeld aan de docent
 */
async function getTeacherCourses(teacherId) {
  const result = await db.query(
    `SELECT 
       c.id,
       c.title,
       c.description,
       c.join_code,
       c.created_at,
       c.updated_at,
       ct.created_at as teacher_assigned_at,
       CAST(COUNT(DISTINCT e.user_id) AS INTEGER) as student_count,
       CAST(COUNT(DISTINCT a.id) AS INTEGER) as assignment_count
     FROM course_teacher ct
     JOIN course c ON ct.course_id = c.id
     LEFT JOIN enrollment e ON c.id = e.course_id
     LEFT JOIN assignment a ON c.id = a.course_id
     WHERE ct.user_id = $1
     GROUP BY c.id, c.title, c.description, c.join_code, c.created_at, c.updated_at, ct.created_at
     ORDER BY ct.created_at DESC`,
    [teacherId]
  );
  return result.rows;
}

/**
 * Controleert of een gebruiker admin is
 * @param {number} userId - ID van de gebruiker
 * @returns {Promise<boolean>} True als gebruiker admin is
 */
async function isUserAdmin(userId) {
  const result = await db.query(
    `SELECT id FROM "user" WHERE id = $1 AND role = 'admin'`,
    [userId]
  );
  return result.rows.length > 0;
}

/**
 * Controleert of een gebruiker bestaat
 * @param {number} userId - ID van de gebruiker
 * @returns {Promise<Object|null>} Gebruikersobject of null
 */
async function getUserById(userId) {
  const result = await db.query(
    `SELECT id, email, name, role FROM "user" WHERE id = $1`,
    [userId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Wijzigt de rol van een gebruiker
 * @param {number} userId - ID van de gebruiker
 * @param {string} newRole - Nieuwe rol ('student', 'teacher', 'admin')
 * @returns {Promise<Object>} Bijgewerkte gebruikersgegevens
 */
async function changeUserRole(userId, newRole) {
  const result = await db.query(
    `UPDATE "user" 
     SET role = $1, updated_at = NOW() 
     WHERE id = $2 
     RETURNING id, email, name, role, updated_at`,
    [newRole, userId]
  );
  return result.rows[0];
}

/**
 * Haalt alle vakken op uit de database
 * @returns {Promise<Array>} Array met vakgegevens
 */
async function getAllCourses() {
  const result = await db.query(
    `SELECT c.id, c.title, c.description, c.join_code, c.created_at, c.updated_at,
            CAST(COUNT(DISTINCT e.user_id) AS INTEGER) as student_count,
            CAST(COUNT(DISTINCT ct.user_id) AS INTEGER) as teacher_count
     FROM course c
     LEFT JOIN enrollment e ON c.id = e.course_id
     LEFT JOIN course_teacher ct ON c.id = ct.course_id
     GROUP BY c.id, c.title, c.description, c.join_code, c.created_at, c.updated_at
     ORDER BY c.created_at DESC`
  );
  return result.rows;
}

/**
 * Haalt gedetailleerde informatie op van een specifiek vak inclusief eigenaren
 * @param {number} courseId - ID van het vak
 * @returns {Promise<Object>} Object met vakinfo en eigenaren
 */
async function getCourseDetails(courseId) {
  // Haal basisinformatie van het vak op
  const courseResult = await db.query(
    `SELECT id, title, description, join_code, created_at, updated_at
     FROM course
     WHERE id = $1`,
    [courseId]
  );

  if (courseResult.rows.length === 0) {
    return null;
  }

  const course = courseResult.rows[0];

  // Haal alle eigenaren (teachers) van het vak op
  const ownersResult = await db.query(
    `SELECT u.id, u.email, u.name, u.role, ct.created_at as assigned_at
     FROM course_teacher ct
     JOIN "user" u ON ct.user_id = u.id
     WHERE ct.course_id = $1
     ORDER BY ct.created_at ASC`,
    [courseId]
  );

  // Haal aantal studenten op
  const enrollmentResult = await db.query(
    `SELECT COUNT(*) as student_count
     FROM enrollment
     WHERE course_id = $1`,
    [courseId]
  );

  // Haal aantal assignments op
  const assignmentResult = await db.query(
    `SELECT COUNT(*) as assignment_count
     FROM assignment
     WHERE course_id = $1`,
    [courseId]
  );

  return {
    ...course,
    owners: ownersResult.rows,
    student_count: parseInt(enrollmentResult.rows[0].student_count),
    assignment_count: parseInt(assignmentResult.rows[0].assignment_count)
  };
}

/**
 * Verwijdert een vak uit de database
 * @param {number} courseId - ID van het vak
 * @returns {Promise<Object>} Verwijderd vakobject
 */
async function deleteCourse(courseId) {
  const result = await db.query(
    `DELETE FROM course
     WHERE id = $1
     RETURNING id, title, description, join_code`,
    [courseId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Werkt vakgegevens bij
 * @param {number} courseId - ID van het vak
 * @param {Object} updateData - Object met te updaten velden (title, description, join_code)
 * @returns {Promise<Object>} Bijgewerkt vakobject
 */
async function updateCourse(courseId, updateData) {
  const { title, description, join_code } = updateData;
  
  // Build dynamic query based on provided fields
  const updates = [];
  const values = [];
  let paramCount = 1;

  if (title !== undefined) {
    updates.push(`title = $${paramCount}`);
    values.push(title);
    paramCount++;
  }

  if (description !== undefined) {
    updates.push(`description = $${paramCount}`);
    values.push(description);
    paramCount++;
  }

  if (join_code !== undefined) {
    updates.push(`join_code = $${paramCount}`);
    values.push(join_code);
    paramCount++;
  }

  if (updates.length === 0) {
    return null; // No updates provided
  }

  updates.push(`updated_at = NOW()`);
  values.push(courseId);

  const query = `
    UPDATE course
    SET ${updates.join(', ')}
    WHERE id = $${paramCount}
    RETURNING id, title, description, join_code, created_at, updated_at
  `;

  const result = await db.query(query, values);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Verwijdert een docent van een vak
 * @param {number} courseId - ID van het vak
 * @param {number} teacherId - ID van de docent
 * @returns {Promise<Object>} Object met verwijderde relatie info
 */
async function removeTeacherFromCourse(courseId, teacherId) {
  // Controleer eerst of de docent aan het vak gekoppeld is
  const checkResult = await db.query(
    `SELECT ct.id, u.name, u.email, c.title as course_title
     FROM course_teacher ct
     JOIN "user" u ON ct.user_id = u.id
     JOIN course c ON ct.course_id = c.id
     WHERE ct.course_id = $1 AND ct.user_id = $2`,
    [courseId, teacherId]
  );

  if (checkResult.rows.length === 0) {
    return null; // Relatie bestaat niet
  }

  const relationInfo = checkResult.rows[0];

  // Verwijder de relatie
  await db.query(
    `DELETE FROM course_teacher
     WHERE course_id = $1 AND user_id = $2`,
    [courseId, teacherId]
  );

  return relationInfo;
}

/**
 * Maakt een nieuw vak aan
 * @param {Object} courseData - Object met vakgegevens (title, description, join_code)
 * @returns {Promise<Object>} Nieuw aangemaakt vak
 */
async function createCourse(courseData) {
  const { title, description, join_code } = courseData;
  
  const result = await db.query(
    `INSERT INTO course (title, description, join_code, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING id, title, description, join_code, created_at, updated_at`,
    [title, description || null, join_code || null]
  );
  
  return result.rows[0];
}

/**
 * Voegt een docent toe aan een vak
 * @param {number} courseId - ID van het vak
 * @param {number} teacherId - ID van de docent
 * @returns {Promise<Object>} Object met toegevoegde relatie info
 */
async function addTeacherToCourse(courseId, teacherId) {
  // Controleer of de relatie al bestaat
  const checkResult = await db.query(
    `SELECT id FROM course_teacher
     WHERE course_id = $1 AND user_id = $2`,
    [courseId, teacherId]
  );

  if (checkResult.rows.length > 0) {
    return { exists: true }; // Relatie bestaat al
  }

  // Voeg de relatie toe
  await db.query(
    `INSERT INTO course_teacher (course_id, user_id, created_at)
     VALUES ($1, $2, NOW())`,
    [courseId, teacherId]
  );

  // Haal de docent en vak info op voor de response
  const infoResult = await db.query(
    `SELECT u.id, u.name, u.email, c.title as course_title, c.id as course_id
     FROM "user" u, course c
     WHERE u.id = $1 AND c.id = $2`,
    [teacherId, courseId]
  );

  return { exists: false, ...infoResult.rows[0] };
}

/**
 * Haalt alle studenten op die ingeschreven zijn voor een vak
 * @param {number} courseId - ID van het vak
 * @returns {Promise<Array>} Array met studentgegevens
 */
async function getCourseStudents(courseId) {
  const result = await db.query(
    `SELECT u.id, u.email, u.name, e.created_at as enrolled_at
     FROM enrollment e
     JOIN "user" u ON e.user_id = u.id
     WHERE e.course_id = $1
     ORDER BY u.name ASC`,
    [courseId]
  );
  return result.rows;
}

/**
 * Schrijft een student in voor een vak
 * @param {number} courseId - ID van het vak
 * @param {number} studentId - ID van de student
 * @returns {Promise<Object>} Object met enrollment info
 */
async function enrollStudent(courseId, studentId) {
  // Controleer of enrollment al bestaat
  const checkResult = await db.query(
    `SELECT id FROM enrollment
     WHERE course_id = $1 AND user_id = $2`,
    [courseId, studentId]
  );

  if (checkResult.rows.length > 0) {
    return { exists: true }; // Al ingeschreven
  }

  // Schrijf student in
  await db.query(
    `INSERT INTO enrollment (course_id, user_id, created_at)
     VALUES ($1, $2, NOW())`,
    [courseId, studentId]
  );

  // Haal student en vak info op
  const infoResult = await db.query(
    `SELECT u.id, u.name, u.email, c.title as course_title, c.id as course_id
     FROM "user" u, course c
     WHERE u.id = $1 AND c.id = $2`,
    [studentId, courseId]
  );

  return { exists: false, ...infoResult.rows[0] };
}

/**
 * Schrijft een student uit van een vak
 * @param {number} courseId - ID van het vak
 * @param {number} studentId - ID van de student
 * @returns {Promise<Object>} Object met uitgeschreven enrollment info
 */
async function unenrollStudent(courseId, studentId) {
  // Controleer of enrollment bestaat
  const checkResult = await db.query(
    `SELECT e.id, u.name, u.email, c.title as course_title
     FROM enrollment e
     JOIN "user" u ON e.user_id = u.id
     JOIN course c ON e.course_id = c.id
     WHERE e.course_id = $1 AND e.user_id = $2`,
    [courseId, studentId]
  );

  if (checkResult.rows.length === 0) {
    return null; // Niet ingeschreven
  }

  const enrollmentInfo = checkResult.rows[0];

  // Verwijder enrollment
  await db.query(
    `DELETE FROM enrollment
     WHERE course_id = $1 AND user_id = $2`,
    [courseId, studentId]
  );

  return enrollmentInfo;
}

/**
 * Haalt alle assignments op van een vak
 * @param {number} courseId - ID van het vak
 * @returns {Promise<Array>} Array met assignment gegevens
 */
async function getCourseAssignments(courseId) {
  const result = await db.query(
    `SELECT a.id, a.title, a.description, a.due_date, a.created_at, a.updated_at,
            COUNT(DISTINCT s.id) as submission_count
     FROM assignment a
     LEFT JOIN submission s ON a.id = s.assignment_id
     WHERE a.course_id = $1
     GROUP BY a.id, a.title, a.description, a.due_date, a.created_at, a.updated_at
     ORDER BY a.due_date DESC NULLS LAST, a.created_at DESC`,
    [courseId]
  );
  return result.rows;
}

/**
 * Verwijdert een assignment
 * @param {number} assignmentId - ID van het assignment
 * @returns {Promise<Object>} Verwijderd assignment object
 */
async function deleteAssignment(assignmentId) {
  const result = await db.query(
    `DELETE FROM assignment
     WHERE id = $1
     RETURNING id, title, description, course_id, due_date`,
    [assignmentId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Haalt een specifieke student op uit de database
 * @param {number} studentId - ID van de student
 * @returns {Promise<Object|null>} Studentgegevens of null als niet gevonden
 */
async function getStudentById(studentId) {
  const result = await db.query(
    `SELECT u.id, u.email, u.name, u.github_id, u.role, u.created_at, u.updated_at,
            COUNT(DISTINCT e.course_id) as enrolled_courses_count,
            COUNT(DISTINCT s.id) as submissions_count
     FROM "user" u
     LEFT JOIN enrollment e ON u.id = e.user_id
     LEFT JOIN submission s ON u.id = s.user_id
     WHERE u.id = $1 AND u.role = 'student'
     GROUP BY u.id, u.email, u.name, u.github_id, u.role, u.created_at, u.updated_at`,
    [studentId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Werkt studentgegevens bij
 * @param {number} studentId - ID van de student
 * @param {Object} updateData - Object met te updaten velden (email, name, github_id)
 * @returns {Promise<Object|null>} Bijgewerkte studentgegevens of null als niet gevonden
 */
async function updateStudent(studentId, updateData) {
  const { email, name, github_id } = updateData;
  
  // Build dynamic query based on provided fields
  const updates = [];
  const values = [];
  let paramCount = 1;

  if (email !== undefined && email !== null) {
    updates.push(`email = $${paramCount}`);
    values.push(email);
    paramCount++;
  }

  if (name !== undefined && name !== null) {
    updates.push(`name = $${paramCount}`);
    values.push(name);
    paramCount++;
  }

  if (github_id !== undefined) {
    updates.push(`github_id = $${paramCount}`);
    values.push(github_id);
    paramCount++;
  }

  // Always update the updated_at timestamp
  updates.push(`updated_at = NOW()`);

  // If no fields to update, return null
  if (updates.length === 1) {
    return null;
  }

  values.push(studentId);

  const query = `
    UPDATE "user"
    SET ${updates.join(', ')}
    WHERE id = $${paramCount} AND role = 'student'
    RETURNING id, email, name, github_id, role, created_at, updated_at
  `;

  const result = await db.query(query, values);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Verwijdert een student uit de database
 * @param {number} studentId - ID van de student
 * @returns {Promise<Object|null>} Verwijderde studentgegevens of null als niet gevonden
 */
async function deleteStudent(studentId) {
  const result = await db.query(
    `DELETE FROM "user"
     WHERE id = $1 AND role = 'student'
     RETURNING id, email, name, github_id, role, created_at`,
    [studentId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Haalt alle vakken op waarin een student is ingeschreven
 * @param {number} studentId - ID van de student
 * @returns {Promise<Array>} Array met vakinformatie
 */
async function getStudentEnrollments(studentId) {
  const result = await db.query(
    `SELECT 
      c.id,
      c.title,
      c.description,
      c.join_code,
      e.created_at as enrolled_at,
      COUNT(DISTINCT a.id) as assignment_count,
      COUNT(DISTINCT s.id) as submission_count,
      COALESCE(AVG(s.ai_score), 0) as avg_ai_score,
      COALESCE(AVG(s.manual_score), 0) as avg_manual_score
     FROM enrollment e
     JOIN course c ON e.course_id = c.id
     LEFT JOIN assignment a ON c.id = a.course_id
     LEFT JOIN submission s ON a.id = s.assignment_id AND s.user_id = e.user_id
     WHERE e.user_id = $1
     GROUP BY c.id, c.title, c.description, c.join_code, e.created_at
     ORDER BY e.created_at DESC`,
    [studentId]
  );
  return result.rows;
}

/**
 * Haalt alle submissions van een student op
 * @param {number} studentId - ID van de student
 * @returns {Promise<Array>} Array met submission informatie
 */
async function getStudentSubmissions(studentId) {
  const result = await db.query(
    `SELECT 
      s.id,
      s.github_url,
      s.commit_sha,
      s.status,
      s.ai_score,
      s.manual_score,
      s.created_at,
      s.updated_at,
      a.id as assignment_id,
      a.title as assignment_title,
      a.description as assignment_description,
      a.due_date as assignment_due_date,
      c.id as course_id,
      c.title as course_title,
      COUNT(DISTINCT f.id) as feedback_count
     FROM submission s
     JOIN assignment a ON s.assignment_id = a.id
     JOIN course c ON a.course_id = c.id
     LEFT JOIN feedback f ON s.id = f.submission_id
     WHERE s.user_id = $1
     GROUP BY s.id, s.github_url, s.commit_sha, s.status, s.ai_score, s.manual_score, 
              s.created_at, s.updated_at, a.id, a.title, a.description, a.due_date,
              c.id, c.title
     ORDER BY s.created_at DESC`,
    [studentId]
  );
  return result.rows;
}

/**
 * Haalt de instellingen van een vak op
 * @param {number} courseId - ID van het vak
 * @returns {Promise<Object|null>} Object met instellingen of null als niet gevonden
 */
async function getCourseSettings(courseId) {
  const result = await db.query(
    `SELECT cs.id, cs.course_id, cs.rubric, cs.ai_guidelines, cs.created_at, cs.updated_at
     FROM course_settings cs
     WHERE cs.course_id = $1`,
    [courseId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Werkt de instellingen van een vak bij
 * @param {number} courseId - ID van het vak
 * @param {Object} settingsData - Object met te updaten velden (rubric, ai_guidelines)
 * @returns {Promise<Object>} Bijgewerkte instellingen
 */
async function updateCourseSettings(courseId, settingsData) {
  const { rubric, ai_guidelines } = settingsData;

  // Controleer eerst of het vak bestaat
  const courseCheck = await db.query(
    `SELECT id FROM course WHERE id = $1`,
    [courseId]
  );

  if (courseCheck.rows.length === 0) {
    throw new Error('COURSE_NOT_FOUND');
  }

  // Controleer of er al instellingen bestaan voor dit vak
  const existingSettings = await getCourseSettings(courseId);

  if (existingSettings) {
    // Update bestaande instellingen
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (rubric !== undefined) {
      updates.push(`rubric = $${paramCount}`);
      values.push(rubric);
      paramCount++;
    }

    if (ai_guidelines !== undefined) {
      updates.push(`ai_guidelines = $${paramCount}`);
      values.push(ai_guidelines);
      paramCount++;
    }

    if (updates.length === 0) {
      // Geen wijzigingen, return bestaande instellingen
      return existingSettings;
    }

    updates.push(`updated_at = NOW()`);
    values.push(courseId);

    const query = `
      UPDATE course_settings
      SET ${updates.join(', ')}
      WHERE course_id = $${paramCount}
      RETURNING id, course_id, rubric, ai_guidelines, created_at, updated_at
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  } else {
    // Maak nieuwe instellingen aan
    const result = await db.query(
      `INSERT INTO course_settings (course_id, rubric, ai_guidelines)
       VALUES ($1, $2, $3)
       RETURNING id, course_id, rubric, ai_guidelines, created_at, updated_at`,
      [courseId, rubric || null, ai_guidelines || null]
    );
    return result.rows[0];
  }
}

/**
 * Verwijdert de instellingen van een vak (reset naar defaults)
 * @param {number} courseId - ID van het vak
 * @returns {Promise<Object|null>} Verwijderde instellingen of null als niet gevonden
 */
async function deleteCourseSettings(courseId) {
  // Controleer eerst of het vak bestaat
  const courseCheck = await db.query(
    `SELECT id FROM course WHERE id = $1`,
    [courseId]
  );

  if (courseCheck.rows.length === 0) {
    throw new Error('COURSE_NOT_FOUND');
  }

  // Verwijder de instellingen als ze bestaan
  const result = await db.query(
    `DELETE FROM course_settings
     WHERE course_id = $1
     RETURNING id, course_id, rubric, ai_guidelines, created_at, updated_at`,
    [courseId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Kopieert instellingen van een vak naar een ander vak
 * @param {number} targetCourseId - ID van het vak waar naartoe gekopieerd wordt
 * @param {number} sourceCourseId - ID van het vak waarvan gekopieerd wordt
 * @returns {Promise<Object>} Gekopieerde instellingen
 */
async function copyCourseSettings(targetCourseId, sourceCourseId) {
  // Controleer of beide vakken bestaan
  const coursesCheck = await db.query(
    `SELECT id FROM course WHERE id IN ($1, $2)`,
    [targetCourseId, sourceCourseId]
  );

  if (coursesCheck.rows.length !== 2) {
    throw new Error('COURSE_NOT_FOUND');
  }

  // Haal bron instellingen op
  const sourceSettings = await getCourseSettings(sourceCourseId);
  
  if (!sourceSettings) {
    throw new Error('SOURCE_SETTINGS_NOT_FOUND');
  }

  // Kopieer naar target vak
  const copiedSettings = await updateCourseSettings(targetCourseId, {
    rubric: sourceSettings.rubric,
    ai_guidelines: sourceSettings.ai_guidelines
  });

  return copiedSettings;
}

/**
 * Haalt alle vakinstellingen op (bulk)
 * @returns {Promise<Array>} Array met alle vakinstellingen
 */
async function getAllCourseSettings() {
  const result = await db.query(
    `SELECT 
       c.id as course_id,
       c.title as course_title,
       cs.id as settings_id,
       cs.rubric,
       cs.ai_guidelines,
       cs.created_at as settings_created_at,
       cs.updated_at as settings_updated_at,
       CASE WHEN cs.id IS NOT NULL THEN true ELSE false END as has_settings
     FROM course c
     LEFT JOIN course_settings cs ON c.id = cs.course_id
     ORDER BY c.title ASC`
  );
  return result.rows;
}

module.exports = {
  getAllStudents,
  getAllTeachers,
  getAllAdmins,
  getTeacherCourses,
  isUserAdmin,
  getUserById,
  changeUserRole,
  getAllCourses,
  getCourseDetails,
  deleteCourse,
  updateCourse,
  removeTeacherFromCourse,
  createCourse,
  addTeacherToCourse,
  getCourseStudents,
  enrollStudent,
  unenrollStudent,
  getCourseAssignments,
  deleteAssignment,
  getStudentById,
  updateStudent,
  deleteStudent,
  getStudentEnrollments,
  getStudentSubmissions,
  getCourseSettings,
  updateCourseSettings,
  deleteCourseSettings,
  copyCourseSettings,
  getAllCourseSettings
};
