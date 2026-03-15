require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('./database');

async function seed() {
  console.log('🌱 Seeding SSMLS database...\n');
  const conn = await pool.getConnection();

  try {

    // ── Step 1: Add UNIQUE constraint to sections if missing ──────────────────
    // This is the ROOT CAUSE of duplicates — without this constraint,
    // INSERT IGNORE can't detect duplicates and inserts every time.
    try {
      await conn.query(`
        ALTER TABLE sections
        ADD CONSTRAINT uq_section_grade
        UNIQUE (section_name, grade_level)
      `);
      console.log('✅ Unique constraint added to sections table');
    } catch (e) {
      if (e.message.includes('Duplicate key name') || e.message.includes('already exists')) {
        console.log('✅ Unique constraint already exists on sections');
      } else if (e.message.includes('Duplicate entry')) {
        // Has duplicates — clean them first, then add constraint
        console.log('⚠️  Duplicates exist — cleaning before adding constraint...');
        await conn.query(`
          DELETE s1 FROM sections s1
          INNER JOIN sections s2
          WHERE s1.id > s2.id
            AND s1.section_name = s2.section_name
            AND s1.grade_level  = s2.grade_level
        `);
        await conn.query(`
          ALTER TABLE sections
          ADD CONSTRAINT uq_section_grade
          UNIQUE (section_name, grade_level)
        `);
        console.log('✅ Duplicates removed and unique constraint added');
      } else {
        console.warn('⚠️  Section constraint warning:', e.message);
      }
    }

    // ── Step 2: Add UNIQUE constraint to subjects if missing ──────────────────
    try {
      await conn.query(`ALTER TABLE subjects ADD CONSTRAINT uq_subject_code UNIQUE (code)`);
    } catch (e) { /* already exists — fine */ }

    // ── Step 3: Seed admin ────────────────────────────────────────────────────
    const adminHash = await bcrypt.hash('Admin@2026', 12);
    await conn.execute(
      `INSERT IGNORE INTO users
         (first_name, last_name, email, password_hash, role, is_active, email_verified)
       VALUES (?, ?, ?, ?, 'admin', 1, 1)`,
      ['System', 'Administrator', 'admin@ssmls.edu.ph', adminHash]
    );

    // ── Step 4: Seed teachers ─────────────────────────────────────────────────
    const teacherHash = await bcrypt.hash('Teacher@2026', 12);
    for (const [fn, ln, em] of [
      ['Maria', 'Lourdes Cruz', 'mlcruz@ssmls.edu.ph'],
      ['Jose',  'Dela Vega',    'jdelavega@ssmls.edu.ph'],
      ['Anna',  'Reyes Santos', 'areyes@ssmls.edu.ph'],
    ]) {
      await conn.execute(
        `INSERT IGNORE INTO users
           (first_name, last_name, email, password_hash, role, is_active, email_verified)
         VALUES (?, ?, ?, ?, 'teacher', 1, 1)`,
        [fn, ln, em, teacherHash]
      );
    }

    const [teacherUsers] = await conn.execute(
      `SELECT id FROM users WHERE role='teacher' AND is_active=1 ORDER BY id LIMIT 3`
    );
    for (let i = 0; i < teacherUsers.length; i++) {
      await conn.execute(
        `INSERT IGNORE INTO teachers (user_id, employee_id, department) VALUES (?, ?, ?)`,
        [teacherUsers[i].id, `EMP-${1001 + i}`, 'Senior High School']
      );
    }

    // ── Step 5: Seed subjects (INSERT IGNORE works because code is UNIQUE) ────
    for (const [code, name, grade, units] of [
      ['MATH11',  'General Mathematics',         'Grade 11', 4],
      ['SCI11',   'Earth and Life Science',       'Grade 11', 4],
      ['ENG11',   'Oral Communication',           'Grade 11', 2],
      ['STAT12',  'Statistics and Probability',   'Grade 12', 4],
      ['PHILO12', 'Introduction to Philosophy',   'Grade 12', 2],
      ['STEM11',  'Pre-Calculus',                 'Grade 11', 4],
    ]) {
      await conn.execute(
        `INSERT IGNORE INTO subjects (code, name, grade_level, units) VALUES (?, ?, ?, ?)`,
        [code, name, grade, units]
      );
    }

    // ── Step 6: Seed sections (INSERT IGNORE now works with UNIQUE constraint) ─
    for (const [name, grade, strand] of [
      ['STEM-A',  'Grade 11', 'STEM'],
      ['STEM-B',  'Grade 11', 'STEM'],
      ['HUMSS-A', 'Grade 11', 'HUMSS'],
      ['ABM-A',   'Grade 11', 'ABM'],
      ['STEM-A',  'Grade 12', 'STEM'],
      ['HUMSS-A', 'Grade 12', 'HUMSS'],
    ]) {
      await conn.execute(
        `INSERT IGNORE INTO sections (section_name, grade_level, strand) VALUES (?, ?, ?)`,
        [name, grade, strand]
      );
    }

    // ── Step 7: Seed students ─────────────────────────────────────────────────
    const studentHash = await bcrypt.hash('Student@2026', 12);
    const [sectionRows] = await conn.execute(
      `SELECT id, section_name, grade_level FROM sections`
    );
    const sectionMap = {};
    sectionRows.forEach(s => {
      sectionMap[`${s.grade_level}-${s.section_name}`] = s.id;
    });

    for (const [fn, ln, lrn, grade, strand] of [
      ['Juan',     'Dela Cruz',        '11200001', 'Grade 11', 'STEM'],
      ['Maria',    'Santos Garcia',    '11200002', 'Grade 11', 'STEM'],
      ['Ana',      'Reyes Flores',     '11200003', 'Grade 11', 'HUMSS'],
      ['Carlo',    'Mendoza Bautista', '11200004', 'Grade 11', 'ABM'],
      ['Sofia',    'Garcia Lopez',     '11200005', 'Grade 11', 'STEM'],
      ['Miguel',   'Torres Rivera',    '11200006', 'Grade 12', 'STEM'],
      ['Isabella', 'Ramos Cruz',       '11200007', 'Grade 12', 'HUMSS'],
    ]) {
      const email = `${fn.toLowerCase()}.${ln.split(' ')[0].toLowerCase()}@student.ssmls.edu.ph`;
      const [existing] = await conn.execute(
        `SELECT id FROM users WHERE email = ?`, [email]
      );
      let userId;
      if (existing.length === 0) {
        const [res] = await conn.execute(
          `INSERT INTO users
             (first_name, last_name, email, password_hash, role, is_active, email_verified)
           VALUES (?, ?, ?, ?, 'student', 1, 1)`,
          [fn, ln, email, studentHash]
        );
        userId = res.insertId;
      } else {
        userId = existing[0].id;
      }
      const sectionId = sectionMap[`${grade}-STEM-A`] || sectionRows[0]?.id;
      await conn.execute(
        `INSERT IGNORE INTO students
           (user_id, lrn, grade_level, section_id, strand)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, lrn, grade, sectionId, strand]
      );
    }

    conn.release();
    console.log('✅ Admin:    admin@ssmls.edu.ph / Admin@2026');
    console.log('✅ Teachers: Teacher@2026');
    console.log('✅ Students: Student@2026');
    console.log('✅ Sections and Subjects seeded');
    console.log('\n🎉 Seeding completed!\n');
    process.exit(0);

  } catch (err) {
    conn.release();
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
