// @v2-fixed-imports
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('./database');

async function seed() {
  console.log('🌱 Seeding SSMLS database...\n');
  const client = await pool.connect();

  try {
    // ── Step 1: Seed admin ──────────────────────────────────────────────────
    const adminHash = await bcrypt.hash('Hizaki1203', 12);
    await client.query(`
      INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, email_verified)
      VALUES ('System', 'Administrator', 'aporia1203@gmail.com', $1, 'admin', true, true)
      ON CONFLICT (email) DO NOTHING
    `, [adminHash]);
    console.log('✅ Admin seeded: aporia1203@gmail.com / Hizaki1203');

    // ── Step 2: Seed teachers ───────────────────────────────────────────────
    const teacherHash = await bcrypt.hash('Teacher@2026', 12);
    const teachers = [
      ['Joana', 'Dela Cruz', 'joana@ssmls.edu.ph'],
      ['Jose',  'Dela Vega',    'jdelavega@ssmls.edu.ph'],
      ['Anna',  'Reyes Santos', 'areyes@ssmls.edu.ph'],
    ];
    for (const [fn, ln, em] of teachers) {
      await client.query(`
        INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, email_verified)
        VALUES ($1, $2, $3, $4, 'teacher', true, true)
        ON CONFLICT (email) DO NOTHING
      `, [fn, ln, em, teacherHash]);
    }

    // Link teachers to teachers table
    const { rows: teacherUsers } = await client.query(`
      SELECT id FROM users WHERE role = 'teacher' AND is_active = true ORDER BY id LIMIT 3
    `);
    for (let i = 0; i < teacherUsers.length; i++) {
      await client.query(`
        INSERT INTO teachers (user_id, employee_id, department)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO NOTHING
      `, [teacherUsers[i].id, `EMP-${1001 + i}`, 'Senior High School']);
    }
    console.log('✅ Teachers seeded: Teacher@2026');

    // ── Step 3: Seed subjects ───────────────────────────────────────────────
    const subjects = [
      ['MATH11',  'General Mathematics',        'Grade 11', 4],
      ['SCI11',   'Earth and Life Science',      'Grade 11', 4],
      ['ENG11',   'Oral Communication',          'Grade 11', 2],
      ['STAT12',  'Statistics and Probability',  'Grade 12', 4],
      ['PHILO12', 'Introduction to Philosophy',  'Grade 12', 2],
      ['STEM11',  'Pre-Calculus',                'Grade 11', 4],
    ];
    for (const [code, name, grade, units] of subjects) {
      await client.query(`
        INSERT INTO subjects (code, name, grade_level, units)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (code) DO NOTHING
      `, [code, name, grade, units]);
    }
    console.log('✅ Subjects seeded');

    // ── Step 4: Seed sections ───────────────────────────────────────────────
    const sections = [
      ['STEM-A',  'Grade 11', 'STEM'],
      ['STEM-B',  'Grade 11', 'STEM'],
      ['HUMSS-A', 'Grade 11', 'HUMSS'],
      ['ABM-A',   'Grade 11', 'ABM'],
      ['STEM-A',  'Grade 12', 'STEM'],
      ['HUMSS-A', 'Grade 12', 'HUMSS'],
    ];
    for (const [name, grade, strand] of sections) {
      await client.query(`
        INSERT INTO sections (section_name, grade_level, strand)
        VALUES ($1, $2, $3)
        ON CONFLICT (section_name, grade_level) DO NOTHING
      `, [name, grade, strand]);
    }
    console.log('✅ Sections seeded');

    // ── Step 5: Seed students ───────────────────────────────────────────────
    const studentHash = await bcrypt.hash('Student@2026', 12);
    const { rows: sectionRows } = await client.query(
      `SELECT id, section_name, grade_level FROM sections`
    );
    const sectionMap = {};
    sectionRows.forEach(s => {
      sectionMap[`${s.grade_level}-${s.section_name}`] = s.id;
    });

    const students = [
      ['Juan',     'Dela Cruz',        '11200001', 'Grade 11', 'STEM'],
      ['Maria',    'Santos Garcia',    '11200002', 'Grade 11', 'STEM'],
      ['Ana',      'Reyes Flores',     '11200003', 'Grade 11', 'HUMSS'],
      ['Carlo',    'Mendoza Bautista', '11200004', 'Grade 11', 'ABM'],
      ['Sofia',    'Garcia Lopez',     '11200005', 'Grade 11', 'STEM'],
      ['Miguel',   'Torres Rivera',    '11200006', 'Grade 12', 'STEM'],
      ['Isabella', 'Ramos Cruz',       '11200007', 'Grade 12', 'HUMSS'],
    ];

    for (const [fn, ln, lrn, grade, strand] of students) {
      const email = `${fn.toLowerCase()}.${ln.split(' ')[0].toLowerCase()}@student.ssmls.edu.ph`;

      // Insert user
      const { rows: existing } = await client.query(
        `SELECT id FROM users WHERE email = $1`, [email]
      );

      let userId;
      if (existing.length === 0) {
        const { rows: inserted } = await client.query(`
          INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, email_verified)
          VALUES ($1, $2, $3, $4, 'student', true, true)
          RETURNING id
        `, [fn, ln, email, studentHash]);
        userId = inserted[0].id;
      } else {
        userId = existing[0].id;
      }

      const sectionId = sectionMap[`${grade}-STEM-A`] || sectionRows[0]?.id;
      await client.query(`
        INSERT INTO students (user_id, lrn, grade_level, section_id, strand)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO NOTHING
      `, [userId, lrn, grade, sectionId, strand]);
    }
    console.log('✅ Students seeded: Student@2026');

    // ── Step 6: Default school config ──────────────────────────────────────
    const configs = [
      ['school_year',          '2025-2026'],
      ['semester',             '1st Semester'],
      ['school_name',          'Senior High School'],
      ['school_address',       'Philippines'],
      ['attendance_threshold', '3'],
      ['grade_passing',        '75'],
      ['dark_mode_default',    'false'],
    ];
    for (const [k, v] of configs) {
      await client.query(`
        INSERT INTO school_config (config_key, config_value)
        VALUES ($1, $2)
        ON CONFLICT (config_key) DO NOTHING
      `, [k, v]);
    }
    console.log('✅ School config seeded');

    console.log('\n🎉 Seeding completed!\n');
    console.log('  Admin:    admin@ssmls.edu.ph  / Admin@2026');
    console.log('  Teachers: Teacher@2026');
    console.log('  Students: Student@2026\n');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { seed };

// Run directly if called as script
if (require.main === module) {
  seed().then(() => process.exit(0)).catch(() => process.exit(1));
}
