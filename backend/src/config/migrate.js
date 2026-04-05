require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('./database');

const migrations = [
  // 1. Roles
  `CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE CHECK (name IN ('admin','teacher','student')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 2. Users
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(80) NOT NULL,
    middle_name VARCHAR(80) NULL,
    last_name VARCHAR(80) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('admin','teacher','student')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Index for users
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,

  // 3. Sections
  `CREATE TABLE IF NOT EXISTS sections (
    id SERIAL PRIMARY KEY,
    section_name VARCHAR(60) NOT NULL,
    grade_level VARCHAR(20) NOT NULL CHECK (grade_level IN ('Grade 11','Grade 12')),
    strand VARCHAR(10) NOT NULL CHECK (strand IN ('STEM','HUMSS','ABM','TVL','GAS')),
    adviser_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
    school_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (section_name, grade_level)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_sections_grade ON sections(grade_level)`,

  // 4. Students
  `CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    lrn VARCHAR(20) NOT NULL UNIQUE,
    grade_level VARCHAR(20) NOT NULL CHECK (grade_level IN ('Grade 11','Grade 12')),
    section_id INT NULL REFERENCES sections(id) ON DELETE SET NULL,
    strand VARCHAR(10) NOT NULL CHECK (strand IN ('STEM','HUMSS','ABM','TVL','GAS')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','transferred','graduated')),
    phone VARCHAR(20),
    birthday DATE NULL,
    birthplace VARCHAR(120) NULL,
    address TEXT,
    guardian_name VARCHAR(120),
    guardian_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS idx_students_section ON students(section_id)`,
  `CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade_level)`,

  // 5. Teachers
  `CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(30) NOT NULL UNIQUE,
    department VARCHAR(80),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 6. Subjects
  `CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    grade_level VARCHAR(20) NOT NULL DEFAULT 'Both' CHECK (grade_level IN ('Grade 11','Grade 12','Both')),
    units INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 7. Schedules
  `CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    teacher_id INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    room VARCHAR(40) NOT NULL,
    day_of_week VARCHAR(15) NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    school_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS idx_schedules_teacher_day ON schedules(teacher_id, day_of_week)`,
  `CREATE INDEX IF NOT EXISTS idx_schedules_section ON schedules(section_id)`,

  // 8. Classes
  `CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    schedule_id INT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    class_date DATE NOT NULL,
    qr_token VARCHAR(255) NULL,
    qr_expires_at TIMESTAMP NULL,
    attendance_open BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS idx_classes_schedule_date ON classes(schedule_id, class_date)`,

  // 9. Attendance
  `CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    class_id INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL DEFAULT 'present' CHECK (status IN ('present','late','absent')),
    time_in TIMESTAMP NULL,
    scanned_via VARCHAR(10) NOT NULL DEFAULT 'qr' CHECK (scanned_via IN ('qr','manual')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (class_id, student_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id)`,

  // 10. Assignments
  `CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    schedule_id INT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    due_date TIMESTAMP NOT NULL,
    max_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    type VARCHAR(15) NOT NULL DEFAULT 'homework' CHECK (type IN ('quiz','activity','project','homework','exam')),
    file_url VARCHAR(500) NULL,
    created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 11. Submissions
  `CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    assignment_id INT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    file_url VARCHAR(500) NULL,
    text_answer TEXT NULL,
    score DECIMAL(5,2) NULL,
    feedback TEXT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','graded','late','missing')),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    graded_at TIMESTAMP NULL,
    graded_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (assignment_id, student_id)
  )`,

  // 12. Grades
  `CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    schedule_id INT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    quarter VARCHAR(5) NOT NULL CHECK (quarter IN ('Q1','Q2','Q3','Q4')),
    written_works DECIMAL(5,2),
    performance_tasks DECIMAL(5,2),
    quarterly_assessment DECIMAL(5,2),
    final_grade DECIMAL(5,2),
    remarks VARCHAR(15) DEFAULT NULL CHECK (remarks IN ('Passed','Failed','Incomplete')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, schedule_id, quarter)
  )`,

  // 13. Learning Materials
  `CREATE TABLE IF NOT EXISTS learning_materials (
    id SERIAL PRIMARY KEY,
    schedule_id INT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    file_url VARCHAR(500),
    file_type VARCHAR(20),
    uploaded_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 14. Announcements
  `CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    target_role VARCHAR(15) NOT NULL DEFAULT 'all' CHECK (target_role IN ('all','student','teacher')),
    section_id INT NULL REFERENCES sections(id) ON DELETE SET NULL,
    created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 15. Audit Logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50),
    entity_id INT,
    details JSONB,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)`,
];

async function migrate() {
  console.log('🔄 Running SSMLS PostgreSQL migrations...\n');
  const client = await pool.connect();
  try {
    for (let i = 0; i < migrations.length; i++) {
      await client.query(migrations[i]);
      const match = migrations[i].match(/CREATE (?:TABLE|INDEX)[^\s]* (?:IF NOT EXISTS )?(\w+)/);
      const name = match?.[1] || `Step ${i + 1}`;
      console.log(`  ✅ "${name}" ready`);
    }
    console.log('\n🎉 All migrations completed successfully!\n');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
