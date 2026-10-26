'use strict';

/**
 * reports.pdf.js
 * Puppeteer-based Arabic PDF generation.
 * Replaces PDFKit — browser handles Arabic shaping, Bidi, and RTL natively.
 *
 * Usage:
 *   npm install puppeteer-core
 */

const puppeteer = require('puppeteer-core');

// ── Shared styles ──────────────────────────────────────────────────────────────

const BASE_CSS = `
  @page { size: A4; margin: 0; }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    direction: rtl;
    color: #1c2b3a;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    position: relative;
    display: flex;
    flex-direction: column;
    page-break-after: always;
  }

  /* ── Header ── */
  .header {
    background: linear-gradient(160deg, #0d2f47 0%, #1a4f72 55%, #22669a 100%);
    padding: 0;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute;
    top: -30px; left: -30px;
    width: 140px; height: 140px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -20px; right: -20px;
    width: 100px; height: 100px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
  }
  .header-gold-bar {
    height: 4px;
    background: linear-gradient(90deg, #c9a84c, #e8cc7a, #c9a84c);
  }
  .header-inner {
    padding: 18px 32px 20px;
    position: relative;
    z-index: 1;
  }
  .header-system-name {
    font-size: 9pt;
    color: rgba(255,255,255,0.65);
    text-align: center;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
  .header-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(201,168,76,0.7), transparent);
    margin: 0 40px 10px;
  }
  .header-title {
    font-size: 20pt;
    font-weight: 700;
    color: #ffffff;
    text-align: center;
    line-height: 1.3;
    margin-bottom: 10px;
  }
  .header-meta {
    font-size: 9pt;
    color: rgba(255,255,255,0.75);
    text-align: center;
    line-height: 1.8;
  }
  .header-bottom-bar {
    height: 5px;
    background: linear-gradient(90deg, #d4eaf7, #eaf4fb, #d4eaf7);
  }

  /* ── Stat cards ── */
  .stats-grid {
    display: flex;
    gap: 10px;
    padding: 16px 28px;
    background: #f4f8fc;
    border-bottom: 1px solid #d8e6f0;
  }
  .stat-card {
    flex: 1;
    background: #ffffff;
    border: 1px solid #ccdde8;
    border-radius: 6px;
    padding: 10px 14px 12px;
    border-top: 3px solid #1a4f72;
    text-align: right;
  }
  .stat-label {
    font-size: 7.5pt;
    color: #7a95a8;
    margin-bottom: 4px;
    font-weight: 600;
  }
  .stat-value {
    font-size: 14pt;
    font-weight: 700;
    color: #1a4f72;
    line-height: 1;
  }

  /* ── Table ── */
  .table-wrap {
    flex: 1;
    padding: 14px 28px 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
  }
  thead tr {
    background: #1a4f72;
  }
  thead th {
    color: #ffffff;
    font-weight: 700;
    padding: 8px 10px;
    text-align: right;
    font-size: 8.5pt;
    border-left: 1px solid rgba(255,255,255,0.15);
  }
  thead th:last-child { border-left: none; }
  thead tr td.gold-bar {
    height: 3px;
    background: linear-gradient(90deg, #c9a84c, #e8cc7a, #c9a84c);
    padding: 0;
  }
  tbody tr:nth-child(odd)  { background: #f7fafd; }
  tbody tr:nth-child(even) { background: #ffffff; }
  tbody tr:hover           { background: #eaf4fb; }
  tbody td {
    padding: 6px 10px;
    border-bottom: 1px solid #e8eef4;
    border-left: 1px solid #edf2f7;
    text-align: right;
    color: #1c2b3a;
    vertical-align: middle;
  }
  tbody td:last-child { border-left: none; }

  .total-row {
    background: #ddeefa !important;
    font-weight: 700;
    color: #0f3350 !important;
  }
  .total-row td {
    border-top: 2px solid #1a4f72;
    border-bottom: none;
    color: #0f3350;
    font-size: 9pt;
  }
  .total-row td:first-child {
    border-right: 4px solid #c9a84c;
  }

  /* ── Footer ── */
  .footer {
    background: #f4f8fc;
    border-top: 1px solid #d0e0ec;
    padding: 8px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 7.5pt;
    color: #7a95a8;
  }
  .footer-brand { font-weight: 600; color: #4a6278; }
  .footer-confidential { color: #aabece; font-size: 7pt; }

  /* ── Badge ── */
  .badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 10px;
    font-size: 7.5pt;
    font-weight: 600;
  }
  .badge-green  { background: #d1fae5; color: #065f46; }
  .badge-blue   { background: #dbeafe; color: #1e40af; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-red    { background: #fee2e2; color: #991b1b; }
  .badge-gray   { background: #f3f4f6; color: #6b7280; }

  .no-sponsor { color: #aabece; font-style: italic; }
  .amount-cell { font-variant-numeric: tabular-nums; direction: ltr; text-align: left; }
`;

// ── Template helpers ───────────────────────────────────────────────────────────

const statusBadge = (statusAr) => {
  const map = {
    'تحت الكفالة':  'green',
    'تحت التسويق':  'blue',
    'قيد المراجعة': 'yellow',
    'مرفوض':        'red',
  };
  const color = map[statusAr] || 'gray';
  return `<span class="badge badge-${color}">${statusAr}</span>`;
};

const safeCell = (v) => (v == null || v === '') ? '<span style="color:#b0c0cc">—</span>' : String(v);

// ── Disbursement HTML ──────────────────────────────────────────────────────────

const disbursementHTML = ({ title, meta, stats, rows, totalAmount, totalCount }) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${BASE_CSS}</style>
</head>
<body>
<div class="page">

  <header class="header">
    <div class="header-gold-bar"></div>
    <div class="header-inner">
      <div class="header-system-name">نظام إدارة كفالة الأيتام والأسر — OFSMS</div>
      <div class="header-divider"></div>
      <div class="header-title">${title}</div>
      <div class="header-meta">${meta}</div>
    </div>
    <div class="header-bottom-bar"></div>
  </header>

  <div class="stats-grid">
    ${stats.map(s => `
      <div class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
      </div>
    `).join('')}
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:18%">المستفيد</th>
          <th style="width:13%">المحافظة</th>
          <th style="width:18%">الكافل</th>
          <th style="width:16%">المندوب</th>
          <th style="width:13%; direction:ltr; text-align:left;">المبلغ (ريال)</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${safeCell(r.beneficiary_name)}</td>
            <td>${safeCell(r.governorate_ar)}</td>
            <td>${r.sponsor_name ? safeCell(r.sponsor_name) : '<span class="no-sponsor">بدون كافل</span>'}</td>
            <td>${safeCell(r.agent_name)}</td>
            <td class="amount-cell">${parseFloat(r.amount).toLocaleString('en')}</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td>الإجمالي</td>
          <td>${totalCount} مستفيد</td>
          <td></td>
          <td></td>
          <td class="amount-cell">${totalAmount.toLocaleString('en')}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <footer class="footer">
    <span class="footer-brand">نظام OFSMS — نظام إدارة كفالة الأيتام والأسر</span>
    <span class="footer-confidential">سري — للاستخدام الداخلي فقط</span>
  </footer>

</div>
</body>
</html>
`;

// ── Receipt confirmation HTML (agent's own orphans for one released list) ─────

const receiptsHTML = ({ title, meta, stats, rows, totalAmount }) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${BASE_CSS}</style>
</head>
<body>
<div class="page">

  <header class="header">
    <div class="header-gold-bar"></div>
    <div class="header-inner">
      <div class="header-system-name">نظام إدارة كفالة الأيتام والأسر — OFSMS</div>
      <div class="header-divider"></div>
      <div class="header-title">${title}</div>
      <div class="header-meta">${meta}</div>
    </div>
    <div class="header-bottom-bar"></div>
  </header>

  <div class="stats-grid">
    ${stats.map(s => `
      <div class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
      </div>
    `).join('')}
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:24%">اليتيم</th>
          <th style="width:13%">المحافظة</th>
          <th style="width:21%">الكافل</th>
          <th style="width:14%; direction:ltr; text-align:left;">المبلغ (ريال)</th>
          <th style="width:18%">حالة الاستلام</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${safeCell(r.beneficiary_name)}</td>
            <td>${safeCell(r.governorate_ar)}</td>
            <td>${r.sponsor_name ? safeCell(r.sponsor_name) : '<span class="no-sponsor">بدون كافل</span>'}</td>
            <td class="amount-cell">${parseFloat(r.amount).toLocaleString('en')}</td>
            <td>${r.confirmed_at
              ? `<span class="badge badge-green">تم التأكيد ${r.confirmed_date}</span>`
              : '<span class="badge badge-yellow">لم يتم التأكيد</span>'}</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td>الإجمالي</td>
          <td>${rows.length} يتيم</td>
          <td></td>
          <td class="amount-cell">${totalAmount.toLocaleString('en')}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  <footer class="footer">
    <span class="footer-brand">نظام OFSMS — نظام إدارة كفالة الأيتام والأسر</span>
    <span class="footer-confidential">سري — للاستخدام الداخلي فقط</span>
  </footer>

</div>
</body>
</html>
`;

// ── Governorate HTML ───────────────────────────────────────────────────────────

const governorateHTML = ({ title, meta, stats, rows }) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>${BASE_CSS}
    .gifted-star { color: #c9a84c; font-size: 10pt; }
  </style>
</head>
<body>
<div class="page">

  <header class="header">
    <div class="header-gold-bar"></div>
    <div class="header-inner">
      <div class="header-system-name">نظام إدارة كفالة الأيتام والأسر — OFSMS</div>
      <div class="header-divider"></div>
      <div class="header-title">${title}</div>
      <div class="header-meta">${meta}</div>
    </div>
    <div class="header-bottom-bar"></div>
  </header>

  <div class="stats-grid">
    ${stats.map(s => `
      <div class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
      </div>
    `).join('')}
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:22%">الاسم الكامل</th>
          <th style="width:7%">العمر</th>
          <th style="width:14%">الحالة</th>
          <th style="width:18%">الكافل</th>
          <th style="width:16%">المندوب</th>
          <th style="width:13%">تاريخ التسجيل</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>
              ${safeCell(r.full_name)}
              ${r.is_gifted ? '<span class="gifted-star" title="موهوب">★</span>' : ''}
            </td>
            <td>${r.age}</td>
            <td>${statusBadge(r.statusAr)}</td>
            <td>${r.sponsor_name ? safeCell(r.sponsor_name) : '<span class="no-sponsor">بدون كافل</span>'}</td>
            <td>${safeCell(r.agent_name)}</td>
            <td style="font-size:7.5pt; color:#4a6278;">${r.registered}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <footer class="footer">
    <span class="footer-brand">نظام OFSMS — نظام إدارة كفالة الأيتام والأسر</span>
    <span class="footer-confidential">سري — للاستخدام الداخلي فقط</span>
  </footer>

</div>
</body>
</html>
`;

const orphanProfileHTML = ({ orphan, profileRows, stats, issueDate }) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>${BASE_CSS}
    .profile-wrap { padding: 18px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .profile-card { border: 1px solid #d8e6f0; border-radius: 8px; padding: 12px 14px; background: #fff; }
    .profile-card.full { grid-column: 1 / -1; }
    .profile-label { font-size: 7.5pt; color: #7a95a8; font-weight: 700; margin-bottom: 4px; }
    .profile-value { font-size: 10pt; color: #0f3350; font-weight: 700; line-height: 1.7; white-space: pre-line; }
    .request-box { margin: 14px 32px 0; padding: 14px 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-right: 4px solid #0f766e; border-radius: 8px; }
    .request-title { font-size: 14pt; color: #065f46; font-weight: 800; margin-bottom: 4px; }
    .request-sub { font-size: 9pt; color: #047857; line-height: 1.7; }
  </style>
</head>
<body>
<div class="page">
  <header class="header">
    <div class="header-gold-bar"></div>
    <div class="header-inner">
      <div class="header-system-name">نظام إدارة كفالة الأيتام والأسر — OFSMS</div>
      <div class="header-divider"></div>
      <div class="header-title">ملف يتيم للكفالة — ${safeCell(orphan.full_name)}</div>
      <div class="header-meta">تاريخ الإصدار: ${issueDate} &nbsp;|&nbsp; المحافظة: ${safeCell(orphan.governorate_ar)}</div>
    </div>
    <div class="header-bottom-bar"></div>
  </header>

  <div class="request-box">
    <div class="request-title">من سيكفل هذا الطفل؟</div>
    <div class="request-sub">هذا الملف مخصص للمشاركة مع الكفلاء الخارجيين للتعريف بالحالة وبياناتها الأساسية.</div>
  </div>

  <div class="stats-grid">
    ${stats.map(s => `
      <div class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
      </div>
    `).join('')}
  </div>

  <div class="profile-wrap">
    ${profileRows.map(r => `
      <div class="profile-card ${r.full ? 'full' : ''}">
        <div class="profile-label">${r.label}</div>
        <div class="profile-value">${safeCell(r.value)}</div>
      </div>
    `).join('')}
  </div>

  <footer class="footer">
    <span class="footer-brand">نظام OFSMS — نظام إدارة كفالة الأيتام والأسر</span>
    <span class="footer-confidential">للمشاركة مع الكفلاء</span>
  </footer>
</div>
</body>
</html>
`;

const familyProfileHTML = ({ family, profileRows, stats, issueDate }) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>${BASE_CSS}
    .profile-wrap { padding: 18px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .profile-card { border: 1px solid #d8e6f0; border-radius: 8px; padding: 12px 14px; background: #fff; }
    .profile-card.full { grid-column: 1 / -1; }
    .profile-label { font-size: 7.5pt; color: #7a95a8; font-weight: 700; margin-bottom: 4px; }
    .profile-value { font-size: 10pt; color: #0f3350; font-weight: 700; line-height: 1.7; white-space: pre-line; }
    .request-box { margin: 14px 32px 0; padding: 14px 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-right: 4px solid #0f766e; border-radius: 8px; }
    .request-title { font-size: 14pt; color: #065f46; font-weight: 800; margin-bottom: 4px; }
    .request-sub { font-size: 9pt; color: #047857; line-height: 1.7; }
  </style>
</head>
<body>
<div class="page">
  <header class="header">
    <div class="header-gold-bar"></div>
    <div class="header-inner">
      <div class="header-system-name">نظام إدارة كفالة الأيتام والأسر — OFSMS</div>
      <div class="header-divider"></div>
      <div class="header-title">ملف أسرة للكفالة — ${safeCell(family.family_name)}</div>
      <div class="header-meta">تاريخ الإصدار: ${issueDate} &nbsp;|&nbsp; المحافظة: ${safeCell(family.governorate_ar)}</div>
    </div>
    <div class="header-bottom-bar"></div>
  </header>

  <div class="request-box">
    <div class="request-title">من سيكفل هذه الأسرة؟</div>
    <div class="request-sub">هذا الملف مخصص للمشاركة مع الكفلاء الخارجيين للتعريف بالحالة وبياناتها الأساسية.</div>
  </div>

  <div class="stats-grid">
    ${stats.map(s => `
      <div class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
      </div>
    `).join('')}
  </div>

  <div class="profile-wrap">
    ${profileRows.map(r => `
      <div class="profile-card ${r.full ? 'full' : ''}">
        <div class="profile-label">${r.label}</div>
        <div class="profile-value">${safeCell(r.value)}</div>
      </div>
    `).join('')}
  </div>

  <footer class="footer">
    <span class="footer-brand">نظام OFSMS — نظام إدارة كفالة الأيتام والأسر</span>
    <span class="footer-confidential">للمشاركة مع الكفلاء</span>
  </footer>
</div>
</body>
</html>
`;

// ── Puppeteer renderer ─────────────────────────────────────────────────────────

const fs = require('fs');

const getExecutablePath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
};

let _browser = null;

const getBrowser = async () => {
  if (!_browser || !_browser.connected) {
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    };
    const execPath = getExecutablePath();
    if (execPath) {
      launchOptions.executablePath = execPath;
    }
    _browser = await puppeteer.launch(launchOptions);
  }
  return _browser;
};

const htmlToPDF = async (html) => {
  const browser = await getBrowser();
  const page    = await browser.newPage();

  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdf = await page.pdf({
    format:               'A4',
    printBackground:      true,
    displayHeaderFooter:  true,
    headerTemplate:       '<div></div>',
    footerTemplate: `
      <div style="
        font-family: Tahoma, Arial, sans-serif;
        direction: rtl;
        width: 100%;
        font-size: 8pt;
        color: #7a95a8;
        padding: 4px 32px;
        display: flex;
        justify-content: space-between;
        border-top: 1px solid #d0e0ec;
        background: #f4f8fc;
      ">
        <span style="font-size:7pt; color:#aabece;">سري — للاستخدام الداخلي فقط</span>
        <span>صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></span>
      </div>`,
    margin: { top: '0mm', right: '0mm', bottom: '14mm', left: '0mm' },
  });

  await page.close();
  return pdf;
};

module.exports = { disbursementHTML, receiptsHTML, governorateHTML, orphanProfileHTML, familyProfileHTML, htmlToPDF };
