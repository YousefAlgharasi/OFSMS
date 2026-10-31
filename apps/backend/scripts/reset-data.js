/**
 * reset-data.js — clean the database before handing the system to the client.
 *
 * Deletes ALL working data (orphans, families, sponsors, sponsorships, documents, reports,
 * disbursements, receipts, ads, announcements, evaluations, programs, notifications, audit log)
 * and every user account except the staff accounts listed in KEEP_EMAILS.
 * Settings, reference lists, governorates, Quran thresholds, landing page content and
 * the educational / in-kind catalogs are kept.
 *
 * Runs ONCE: during deploy when RESET_DATA_TOKEN is set (any text, e.g. 2026-11-01).
 * The token is stored in `data_reset_log`; a token that was already used is skipped, so a
 * restart never wipes data again. Remove RESET_DATA_TOKEN from Render afterwards.
 *
 * Manual use:  RESET_DATA_TOKEN=xyz KEEP_EMAILS=a@x.com,b@x.com node scripts/reset-data.js
 */
require('dotenv').config();
const { pool } = require('../src/config/db');

const KEEP_EMAILS = (process.env.KEEP_EMAILS ||
  'gm@ofsms.local,supervisor@ofsms.local,finance@ofsms.local,agent@ofsms.local,agent2@ofsms.local')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
// The owner's own admin account (ADMIN_EMAIL on the server) is never deleted
if (process.env.ADMIN_EMAIL) KEEP_EMAILS.push(process.env.ADMIN_EMAIL.trim().toLowerCase());

const WIPE = [
  'ad_recipients', 'ads', 'agent_batch_confirmations', 'biometric_receipts', 'disbursement_items',
  'disbursement_lists', 'documents', 'stored_files', 'educational_participants', 'educational_programs',
  'families', 'in_kind_beneficiaries', 'in_kind_programs', 'notifications', 'orphan_documents',
  'orphans', 'periodic_evaluations', 'quran_reports', 'sponsorships', 'sponsors', 'announcements',
  'audit_logs', 'system_backups',
];

async function main() {
  const token = (process.env.RESET_DATA_TOKEN || '').trim();
  if (!token) { console.log('ℹ️  RESET_DATA_TOKEN not set — no data reset.'); return; }

  let client;
  try {
    client = await pool.connect();
    await client.query(`CREATE TABLE IF NOT EXISTS data_reset_log (
      token TEXT PRIMARY KEY, run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), details JSONB)`);
    const used = await client.query('SELECT 1 FROM data_reset_log WHERE token = $1', [token]);
    if (used.rowCount) { console.log(`ℹ️  Data reset "${token}" was already done — skipped.`); return; }

    const kept = await client.query('SELECT id, email FROM users WHERE lower(email) = ANY($1)', [KEEP_EMAILS]);
    if (kept.rowCount === 0) throw new Error('None of the KEEP_EMAILS accounts exist — refusing to reset.');
    console.log('Keeping accounts:', kept.rows.map((r) => r.email).join(', '));

    const existing = (await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)).rows.map((r) => r.table_name);
    const wipe = WIPE.filter((t) => existing.includes(t));

    const guard = ['governorates', 'system_settings', 'reference_lists', 'quran_thresholds', 'landing_content']
      .filter((t) => existing.includes(t));
    const count = async (t) => Number((await client.query(`SELECT COUNT(*) FROM ${t}`)).rows[0].count);
    const before = {};
    for (const t of guard) before[t] = await count(t);

    await client.query('BEGIN');
    await client.query(`TRUNCATE ${wipe.join(', ')} RESTART IDENTITY CASCADE`);
    const del = await client.query('DELETE FROM users WHERE NOT (lower(email) = ANY($1))', [KEEP_EMAILS]);
    for (const t of guard) {
      if ((await count(t)) !== before[t]) throw new Error(`Guard failed: ${t} changed — rolled back`);
    }
    await client.query('INSERT INTO data_reset_log (token, details) VALUES ($1, $2)',
      [token, JSON.stringify({ kept: kept.rows.map((r) => r.email), usersDeleted: del.rowCount, wiped: wipe })]);
    await client.query('COMMIT');
    console.log(`✅ Data reset done: ${wipe.length} tables cleared, ${del.rowCount} other users removed.`);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('❌ Data reset failed (nothing changed):', err.message);
    process.exitCode = 0; // never block the deploy
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}
main();
