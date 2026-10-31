// Allowed registration status changes (orphans and families)
const ALLOWED = {
  under_review:      ['under_marketing', 'rejected'],
  rejected:          [],                       // the agent fixes it and resubmits (back to under_review)
  under_marketing:   ['under_sponsorship', 'rejected', 'inactive'],
  under_sponsorship: ['under_marketing', 'inactive'],
  inactive:          ['under_marketing'],
};

const LABEL = {
  under_review: 'قيد المراجعة', rejected: 'مرفوض', under_marketing: 'تحت التسويق',
  under_sponsorship: 'تحت الكفالة', inactive: 'غير نشط',
};

function assertTransition(from, to) {
  if (!from || (ALLOWED[from] || []).includes(to)) return;
  const e = new Error(
    from === to
      ? `الحالة الحالية بالفعل «${LABEL[from] || from}»`
      : `لا يمكن تغيير الحالة من «${LABEL[from] || from}» إلى «${LABEL[to] || to}»`
  );
  e.status = 409;
  e.statusCode = 409;
  throw e;
}

module.exports = { assertTransition };
