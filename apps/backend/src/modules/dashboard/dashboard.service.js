/**
 * dashboard.service.js — OFSMS Dashboard Business Logic Layer
 *
 * Orchestrates dashboard data by:
 *   - Calling dashboard.repository.js for raw DB rows
 *   - Shaping, parsing, and composing the final response objects
 *
 * No SQL lives here. No HTTP knowledge (no req/res/next).
 */

const repository = require('./dashboard.repository');

// ── Shared helper: compute next disbursement date (28th of current/next month) ─
const getNextDisbursementDate = () => {
  const now = new Date();
  const disbursementDay = 28;
  const next = new Date(now.getFullYear(), now.getMonth(), disbursementDay);
  if (now.getDate() > disbursementDay) next.setMonth(next.getMonth() + 1);
  return next.toISOString();
};

// ── GM Dashboard ───────────────────────────────────────────────────────────────
const getGmDashboard = async () => {
  const [totals, orphansPerGov, orphansPerSponsor, latestOrphans, pending, disbursement] =
    await Promise.all([
      repository.getGmTotals(),
      repository.getOrphansPerGovernorate(),
      repository.getOrphansPerSponsor(),
      repository.getLatestOrphans(),
      repository.getGmPendingCounts(),
      repository.getMonthlyDisbursementSummary(),
    ]);

  return {
    total_orphans: parseInt(totals.total_orphans),
    orphans_per_governorate: orphansPerGov.map(r => ({ ...r, count: parseInt(r.count) })),
    orphans_per_sponsor: orphansPerSponsor.map(r => ({ ...r, count: parseInt(r.count) })),
    latest_orphans: latestOrphans,
    pending_count: {
      registrations: parseInt(pending.registrations),
      quran_reports: parseInt(pending.quran_reports),
      disbursements: parseInt(pending.disbursements),
    },
    monthly_disbursement_summary: {
      total:    parseFloat(disbursement.total),
      released: parseFloat(disbursement.released),
      pending:  parseFloat(disbursement.pending),
    },
  };
};

// ── Agent Dashboard ────────────────────────────────────────────────────────────
const getAgentDashboard = async (agentId) => {
  const [myOrphans, pendingReports, rejectedSubmissions] = await Promise.all([
    repository.getAgentOrphans(agentId),
    repository.getAgentPendingReports(agentId),
    repository.getAgentRejectedSubmissions(agentId),
  ]);

  return {
    my_orphans: myOrphans,
    pending_reports: pendingReports,
    rejected_submissions: rejectedSubmissions,
  };
};

// ── Supervisor Dashboard ───────────────────────────────────────────────────────
const getSupervisorDashboard = async () => {
  const nextDisbursement = new Date(getNextDisbursementDate());
  const [counts, pendingOrphans, pendingFamilies, pendingQuranReports, currentList] = await Promise.all([
    repository.getSupervisorPendingCounts(),
    repository.getSupervisorPendingOrphans(),
    repository.getSupervisorPendingFamilies(),
    repository.getSupervisorPendingQuranReports(),
    // The list that belongs to the upcoming disbursement date, so the dashboard
    // can tell whether it still needs attention or is already approved
    repository.getDisbursementListForMonth(nextDisbursement.getMonth() + 1, nextDisbursement.getFullYear()),
  ]);

  return {
    pending_counts: {
      orphans:             parseInt(counts.pending_orphans),
      families:            parseInt(counts.pending_families),
      quran_reports:       parseInt(counts.pending_quran_reports),
      disbursements:       parseInt(counts.pending_disbursements),
      total_registrations: parseInt(counts.pending_orphans) + parseInt(counts.pending_families),
    },
    pending_orphans:       pendingOrphans,
    pending_families:      pendingFamilies,
    pending_quran_reports: pendingQuranReports,
    next_disbursement_date: getNextDisbursementDate(),
    current_disbursement:   currentList, // { id, status, month, year } | null
  };
};

// ── Finance Dashboard ──────────────────────────────────────────────────────────
const getFinanceDashboard = async () => {
  const [awaitingAuth, recentHistory, summary] = await Promise.all([
    repository.getFinanceAwaitingAuth(),
    repository.getFinanceRecentHistory(),
    repository.getFinanceMonthlySummary(),
  ]);

  return {
    awaiting_finance_auth: awaitingAuth.map(r => ({
      ...r,
      beneficiary_count: parseInt(r.beneficiary_count),
      total_amount: parseFloat(r.total_amount) || 0,
    })),
    recent_history: recentHistory.map(r => ({
      ...r,
      total_amount: parseFloat(r.total_amount) || 0,
    })),
    summary: {
      current_month_total:  parseFloat(summary.current_month_total)  || 0,
      released_this_month:  parseFloat(summary.released_this_month)  || 0,
      pending_this_month:   parseFloat(summary.pending_this_month)   || 0,
      current_month_count:  parseInt(summary.current_month_count)    || 0,
    },
    next_disbursement_date: getNextDisbursementDate(),
  };
};

module.exports = {
  getGmDashboard,
  getAgentDashboard,
  getSupervisorDashboard,
  getFinanceDashboard,
};
