// @v2-fixed-imports
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('./database');

async function seed() {
  console.log('🌱 Seeding SSMLS database...\n');
  const client = await pool.connect();

  try {
    // ── Step 1: Seed first admin (only if it does not exist yet) ────────────
    // Credentials come from .env (ADMIN_EMAIL / ADMIN_PASSWORD) with a fallback.
    // An existing admin is never modified, so password changes survive restarts.
    const ADMIN_EMAIL    = (process.env.ADMIN_EMAIL || 'admin01@ssmls.edu.ph').toLowerCase();
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1203';

    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const adminRes = await client.query(`
      INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, email_verified)
      VALUES ('System', 'Administrator', $1, $2, 'admin', true, true)
      ON CONFLICT (email) DO NOTHING
    `, [ADMIN_EMAIL, adminHash]);
    console.log(adminRes.rowCount
      ? '✅ Admin created: ' + ADMIN_EMAIL + ' / ' + ADMIN_PASSWORD
      : 'ℹ️  Admin already exists: ' + ADMIN_EMAIL);

    // Teachers and students are NOT seeded — add them from the admin pages
    // (Teachers / Students / Import Students).

    // Subjects and sections are NOT seeded — the admin adds them from the
    // Subjects and Sections pages (Add Subject / Add Section).

    // ── Default school config ──────────────────────────────────────
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
