/* @v2-fixed-imports */
const express = require('express')
const router  = express.Router()
const { pool } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth.middleware')

router.use(authenticate)
router.use(authorize('admin', 'teacher'))

router.get('/', async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.trim().length < 2)
      return res.json({ success: true, data: [] })

    const search = `%${q.trim()}%`
    const results = []

    // Students
    const [students] = await pool.execute(
      `SELECT s.id, u.first_name, u.middle_name, u.last_name, s.lrn,
         sec.section_name, sec.grade_level, s.strand
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE u.is_active = 1 AND s.status = 'active'
         AND (u.first_name LIKE ? OR u.last_name LIKE ?
              OR u.middle_name LIKE ? OR s.lrn LIKE ?)
       ORDER BY u.last_name LIMIT 8`,
      [search, search, search, search]
    )
    students.forEach(s => {
      const mi = s.middle_name ? ` ${s.middle_name[0]}.` : ''
      results.push({
        id:   s.id,
        type: 'student',
        name: `${s.last_name}, ${s.first_name}${mi}`,
        sub:  `LRN: ${s.lrn} · ${s.grade_level || ''} ${s.section_name || ''} ${s.strand || ''}`.trim(),
      })
    })

    // Teachers (admin only)
    if (req.user.role === 'admin') {
      const [teachers] = await pool.execute(
        `SELECT t.id, u.first_name, u.middle_name, u.last_name, t.employee_id, t.department
         FROM teachers t JOIN users u ON u.id = t.user_id
         WHERE u.is_active = 1
           AND (u.first_name LIKE ? OR u.last_name LIKE ?
                OR u.middle_name LIKE ? OR t.employee_id LIKE ?)
         ORDER BY u.last_name LIMIT 5`,
        [search, search, search, search]
      )
      teachers.forEach(t => {
        const mi = t.middle_name ? ` ${t.middle_name[0]}.` : ''
        results.push({
          id:   t.id,
          type: 'teacher',
          name: `${t.last_name}, ${t.first_name}${mi}`,
          sub:  `${t.employee_id || ''}${t.department ? ' · ' + t.department : ''}`,
        })
      })

      // Sections
      const [sections] = await pool.execute(
        `SELECT id, section_name, grade_level, strand, school_year
         FROM sections
         WHERE section_name LIKE ? OR strand LIKE ?
         ORDER BY grade_level, section_name LIMIT 5`,
        [search, search]
      )
      sections.forEach(s => results.push({
        id:   s.id,
        type: 'section',
        name: `${s.grade_level} — ${s.section_name}`,
        sub:  `${s.strand} · ${s.school_year}`,
      }))
    }

    // Subjects
    const [subjects] = await pool.execute(
      `SELECT id, name, code, grade_level FROM subjects
       WHERE name LIKE ? OR code LIKE ?
       ORDER BY name LIMIT 5`,
      [search, search]
    )
    subjects.forEach(s => results.push({
      id:   s.id,
      type: 'subject',
      name: s.name,
      sub:  `${s.code} · ${s.grade_level}`,
    }))

    res.json({ success: true, data: results })
  } catch (err) {
    console.error('Search error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
