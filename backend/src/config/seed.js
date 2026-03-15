require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('./database');

async function seed() {
  console.log('🌱 Seeding SSMLS database...\n');
  const conn = await pool.getConnection();

  try {
    // Remove duplicate sections (keep lowest id per name+grade combo)
    await conn.query(`
      DELETE s1 FROM sections s1
      INNER JOIN sections s2
      WHERE s1.id > s2.id
        AND s1.section_name = s2.section_name
        AND s1.grade_level  = s2.grade_level
    `);
    console.log('✅ Duplicate sections cleaned up');
    // Admin user
    const adminHash = await bcrypt.hash('Admin@2026', 12);
    await conn.execute(
      `INSERT IGNORE INTO users (first_name, last_name, email, password_hash, role, is_active, email_verified)
       VALUES (?, ?, ?, ?, 'admin', 1, 1)`,
      ['System', 'Administrator', 'admin@ssmls.edu.ph', adminHash]
    );

    // Teacher users
    const teacherHash = await bcrypt.hash('Teacher@2026', 12);
    const teachers = [
      ['Maria', 'Lourdes Cruz', 'mlcruz@ssmls.edu.ph'],
      ['Jose', 'Dela Vega', 'jdelavega@ssmls.edu.ph'],
      ['Anna', 'Reyes Santos', 'areyes@ssmls.edu.ph'],
    ];
    for (const [fn, ln, em] of teachers) {
      await conn.execute(
        `INSERT IGNORE INTO users (first_name, last_name, email, password_hash, role, is_active, email_verified)
         VALUES (?, ?, ?, ?, 'teacher', 1, 1)`,
        [fn, ln, em, teacherHash]
      );
    }

    // Get teacher user IDs
    const [teacherUsers] = await conn.execute(`SELECT id FROM users WHERE role='teacher' ORDER BY id LIMIT 3`);
    for (let i = 0; i < teacherUsers.length; i++) {
      await conn.execute(
        `INSERT IGNORE INTO teachers (user_id, employee_id, department) VALUES (?, ?, ?)`,
        [teacherUsers[i].id, `EMP-${1001 + i}`, 'Senior High School']
      );
    }

    // Subjects
    const subjects = [
      ['MATH11', 'General Mathematics', 'Grade 11', 4],
      ['SCI11', 'Earth and Life Science', 'Grade 11', 4],
      ['ENG11', 'Oral Communication', 'Grade 11', 2],
      ['STAT12', 'Statistics and Probability', 'Grade 12', 4],
      ['PHILO12', 'Introduction to Philosophy', 'Grade 12', 2],
      ['STEM11', 'Pre-Calculus', 'Grade 11', 4],
    ];
    for (const [code, name, grade, units] of subjects) {
      await conn.execute(
        `INSERT IGNORE INTO subjects (code, name, grade_level, units) VALUES (?, ?, ?, ?)`,
        [code, name, grade, units]
      );
    }

    // Sections
    const sections = [
      ['STEM-A', 'Grade 11', 'STEM'],
      ['STEM-B', 'Grade 11', 'STEM'],
      ['HUMSS-A', 'Grade 11', 'HUMSS'],
      ['ABM-A', 'Grade 11', 'ABM'],
      ['STEM-A', 'Grade 12', 'STEM'],
      ['HUMSS-A', 'Grade 12', 'HUMSS'],
    ];
    for (const [name, grade, strand] of sections) {
      await conn.execute(
        `INSERT IGNORE INTO sections (section_name, grade_level, strand) VALUES (?, ?, ?)`,
        [name, grade, strand]
      );
    }

    // Student users
    const studentHash = await bcrypt.hash('Student@2026', 12);
    const studentData = [
      ['Juan', 'Dela Cruz', '11200001', 'Grade 11', 'STEM'],
      ['Maria', 'Santos Garcia', '11200002', 'Grade 11', 'STEM'],
      ['Ana', 'Reyes Flores', '11200003', 'Grade 11', 'HUMSS'],
      ['Carlo', 'Mendoza Bautista', '11200004', 'Grade 11', 'ABM'],
      ['Sofia', 'Garcia Lopez', '11200005', 'Grade 11', 'STEM'],
      ['Miguel', 'Torres Rivera', '11200006', 'Grade 12', 'STEM'],
      ['Isabella', 'Ramos Cruz', '11200007', 'Grade 12', 'HUMSS'],
    ];

    const [sectionRows] = await conn.execute(`SELECT id, section_name, grade_level FROM sections`);
    const sectionMap = {};
    sectionRows.forEach(s => { sectionMap[`${s.grade_level}-${s.section_name}`] = s.id; });

    for (const [fn, ln, lrn, grade, strand] of studentData) {
      const email = `${fn.toLowerCase()}.${ln.split(' ')[0].toLowerCase()}@student.ssmls.edu.ph`;
      const [existing] = await conn.execute(`SELECT id FROM users WHERE email=?`, [email]);
      let userId;
      if (existing.length === 0) {
        const [res] = await conn.execute(
          `INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, email_verified) VALUES (?, ?, ?, ?, 'student', 1, 1)`,
          [fn, ln, email, studentHash]
        );
        userId = res.insertId;
      } else {
        userId = existing[0].id;
      }
      const sectionKey = `${grade}-STEM-A`;
      const sectionId = sectionMap[sectionKey] || sectionRows[0]?.id;
      await conn.execute(
        `INSERT IGNORE INTO students (user_id, lrn, grade_level, section_id, strand) VALUES (?, ?, ?, ?, ?)`,
        [userId, lrn, grade, sectionId, strand]
      );
    }

    conn.release();
    console.log('✅ Default admin: admin@ssmls.edu.ph / Admin@2026');
    console.log('✅ Teachers seeded (password: Teacher@2026)');
    console.log('✅ Students seeded (password: Student@2026)');
    console.log('✅ Sections, Subjects seeded\n');
    console.log('🎉 Seeding completed!\n');
    process.exit(0);
  } catch (err) {
    conn.release();
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
