require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('./database');

const migrations = [
  // 1. Roles
  `CREATE TABLE IF NOT EXISTS roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name ENUM('admin','teacher','student') NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 2. Users
  `CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','teacher','student') NOT NULL DEFAULT 'student',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    email_verified TINYINT(1) NOT NULL DEFAULT 0,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
  )`,

  // 3. Sections
  `CREATE TABLE IF NOT EXISTS sections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    section_name VARCHAR(60) NOT NULL,
    grade_level ENUM('Grade 11','Grade 12') NOT NULL,
    strand ENUM('STEM','HUMSS','ABM','TVL','GAS') NOT NULL,
    adviser_id INT NULL,
    school_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_section_grade (section_name, grade_level),
    FOREIGN KEY (adviser_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_grade (grade_level)
  )`,

  // 4. Students
  `CREATE TABLE IF NOT EXISTS students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    lrn VARCHAR(20) NOT NULL UNIQUE,
    grade_level ENUM('Grade 11','Grade 12') NOT NULL,
    section_id INT NULL,
    strand ENUM('STEM','HUMSS','ABM','TVL','GAS') NOT NULL,
    status ENUM('active','inactive','transferred','graduated') NOT NULL DEFAULT 'active',
    phone VARCHAR(20),
    address TEXT,
    guardian_name VARCHAR(120),
    guardian_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
    INDEX idx_section (section_id),
    INDEX idx_grade (grade_level)
  )`,

  // 5. Teachers
  `CREATE TABLE IF NOT EXISTS teachers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    employee_id VARCHAR(30) NOT NULL UNIQUE,
    department VARCHAR(80),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // 6. Subjects
  `CREATE TABLE IF NOT EXISTS subjects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    grade_level ENUM('Grade 11','Grade 12','Both') NOT NULL DEFAULT 'Both',
    units INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 7. Schedules
  `CREATE TABLE IF NOT EXISTS schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL,
    subject_id INT NOT NULL,
    section_id INT NOT NULL,
    room VARCHAR(40) NOT NULL,
    day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    school_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    INDEX idx_teacher_day (teacher_id, day_of_week),
    INDEX idx_section (section_id)
  )`,

  // 8. Classes (instances of schedule per day)
  `CREATE TABLE IF NOT EXISTS classes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    schedule_id INT NOT NULL,
    class_date DATE NOT NULL,
    qr_token VARCHAR(255) NULL,
    qr_expires_at TIMESTAMP NULL,
    attendance_open TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    INDEX idx_schedule_date (schedule_id, class_date)
  )`,

  // 9. Attendance
  `CREATE TABLE IF NOT EXISTS attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    status ENUM('present','late','absent') NOT NULL DEFAULT 'present',
    time_in TIMESTAMP NULL,
    scanned_via ENUM('qr','manual') NOT NULL DEFAULT 'qr',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_class_student (class_id, student_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    INDEX idx_student (student_id),
    INDEX idx_class (class_id)
  )`,

  // 10. Assignments
  `CREATE TABLE IF NOT EXISTS assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    schedule_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    due_date DATETIME NOT NULL,
    max_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    type ENUM('quiz','activity','project','homework','exam') NOT NULL DEFAULT 'homework',
    file_url VARCHAR(500) NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // 11. Submissions
  `CREATE TABLE IF NOT EXISTS submissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    assignment_id INT NOT NULL,
    student_id INT NOT NULL,
    file_url VARCHAR(500) NULL,
    text_answer TEXT NULL,
    score DECIMAL(5,2) NULL,
    feedback TEXT NULL,
    status ENUM('submitted','graded','late','missing') NOT NULL DEFAULT 'submitted',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    graded_at TIMESTAMP NULL,
    graded_by INT NULL,
    UNIQUE KEY uniq_assign_student (assignment_id, student_id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL
  )`,

  // 12. Grades
  `CREATE TABLE IF NOT EXISTS grades (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    schedule_id INT NOT NULL,
    quarter ENUM('Q1','Q2','Q3','Q4') NOT NULL,
    written_works DECIMAL(5,2),
    performance_tasks DECIMAL(5,2),
    quarterly_assessment DECIMAL(5,2),
    final_grade DECIMAL(5,2),
    remarks ENUM('Passed','Failed','Incomplete') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_student_sched_quarter (student_id, schedule_id, quarter),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
  )`,

  // 13. Learning Materials
  `CREATE TABLE IF NOT EXISTS learning_materials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    schedule_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    file_url VARCHAR(500),
    file_type VARCHAR(20),
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // 14. Announcements
  `CREATE TABLE IF NOT EXISTS announcements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    target_role ENUM('all','student','teacher') NOT NULL DEFAULT 'all',
    section_id INT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // 15. Audit Logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50),
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_timestamp (timestamp)
  )`,
];

async function migrate() {
  console.log('🔄 Running SSMLS database migrations...\n');
  try {
    const conn = await pool.getConnection();
    // Use query() not execute() for DDL commands (CREATE DATABASE, USE)
    // execute() uses prepared statements which don't support DDL
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
    await conn.query(`USE \`${process.env.DB_NAME}\``);

    for (let i = 0; i < migrations.length; i++) {
      await conn.query(migrations[i]);
      const tableName = migrations[i].match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || `Migration ${i+1}`;
      console.log(`  ✅ Table "${tableName}" ready`);
    }
    conn.release();
    console.log('\n🎉 All migrations completed successfully!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
