// @v2-fixed-imports
// Migration V2 — new feature tables
// Called from seed.js on startup via safeCreateTable

const NEW_TABLES = [

  // Notifications
  `CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('grade','attendance','assignment','announcement','alert','message') NOT NULL DEFAULT 'announcement',
    title VARCHAR(120) NOT NULL,
    body TEXT,
    link VARCHAR(200),
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_created (created_at)
  )`,

  // Messages (direct messaging)
  `CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    subject VARCHAR(150),
    body TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    parent_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id)   REFERENCES messages(id) ON DELETE SET NULL,
    INDEX idx_receiver (receiver_id, is_read),
    INDEX idx_sender (sender_id)
  )`,

  // School calendar events
  `CREATE TABLE IF NOT EXISTS calendar_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    end_date DATE NULL,
    type ENUM('exam','holiday','activity','deadline','other') NOT NULL DEFAULT 'other',
    target_role ENUM('all','admin','teacher','student') NOT NULL DEFAULT 'all',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_date (event_date)
  )`,

  // Grade appeals
  `CREATE TABLE IF NOT EXISTS grade_appeals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    grade_id INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending','reviewed','resolved','rejected') NOT NULL DEFAULT 'pending',
    teacher_response TEXT,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id)  REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (grade_id)    REFERENCES grades(id)   ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id)    ON DELETE SET NULL,
    INDEX idx_student (student_id),
    INDEX idx_status (status)
  )`,

  // School year config
  `CREATE TABLE IF NOT EXISTS school_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(60) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
  )`,

];

module.exports = { NEW_TABLES };
