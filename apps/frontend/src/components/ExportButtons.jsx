'use client';

/**
 * ExportButtons.jsx
 * Reusable component for exporting data as PDF or Excel.
 *
 * Usage:
 *   <ExportButtons
 *     pdfUrl="/reports/disbursement/abc-123/pdf"
 *     excelUrl="/reports/disbursement/abc-123/excel"
 *     filename="كشف-صرف-مايو-2026"
 *   />
 *
 * Props:
 *   pdfUrl    {string}  API path (without /api prefix) for PDF export
 *   excelUrl  {string}  API path for Excel export
 *   filename  {string}  Base filename (without extension) for the download
 *   size      {string}  'sm' | 'md' (default 'md')
 *   variant   {string}  'buttons' | 'menu' (default 'buttons')
 */

import { useState } from 'react';
import api from '../lib/api';
import { saveBlobFile } from '../lib/saveFile';
import { Download, FileText, FileSpreadsheet, AlertTriangle, X } from 'lucide-react';

export default function ExportButtons({
  pdfUrl,
  excelUrl,
  filename = 'تصدير',
  size = 'md',
  variant = 'buttons',
}) {
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [error, setError]               = useState('');
  const [menuOpen, setMenuOpen]         = useState(false);

  const download = async (url, ext, setLoading) => {
    setLoading(true);
    setError('');
    setMenuOpen(false);
    try {
      const response = await api.get(url, { responseType: 'blob' });
      const blob     = new Blob([response.data], {
        type: ext === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await saveBlobFile(blob, `${filename}.${ext}`);
    } catch (err) {
      setError(err?.isOffline || !navigator.onLine
        ? 'التصدير يحتاج اتصالاً بالإنترنت'
        : err?.message?.includes('نسخة أحدث')
          ? err.message
          : `فشل تصدير ${ext === 'pdf' ? 'PDF' : 'Excel'} — حاول مجدداً`);
    } finally {
      setLoading(false);
    }
  };

  const isBusy = pdfLoading || excelLoading;

  const pad  = size === 'sm' ? '.35rem .8rem'  : '.55rem 1.1rem';
  const font = size === 'sm' ? '.75rem' : '.83rem';

  // ── Dropdown/menu variant ────────────────────────────────────────────────
  if (variant === 'menu') {
    return (
      <div style={{ position: 'relative', display: 'inline-block', fontFamily: 'Cairo,sans-serif' }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          disabled={isBusy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '.4rem',
            padding: pad, border: '1.5px solid #d1d5db', borderRadius: '.625rem',
            background: '#fff', color: '#374151', fontSize: font, fontWeight: 600,
            cursor: isBusy ? 'not-allowed' : 'pointer', fontFamily: 'Cairo,sans-serif',
            opacity: isBusy ? .65 : 1,
          }}
        >
          {isBusy ? <MiniSpinner /> : <Download size={15}/>}
          تصدير
          <span style={{ fontSize: '.65rem', color: '#9ca3af' }}>▼</span>
        </button>

        {menuOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 49 }}
              onClick={() => setMenuOpen(false)}
            />
            <div style={{
              position: 'absolute', top: 'calc(100% + .4rem)', left: 0,
              background: '#fff', border: '1.5px solid #e5eaf0', borderRadius: '.75rem',
              boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 50,
              minWidth: 180, overflow: 'hidden',
            }}>
              {pdfUrl && (
                <MenuRow
                  icon={<FileText size={18}/>}
                  label="تصدير PDF"
                  sub="ملف جاهز للطباعة"
                  loading={pdfLoading}
                  onClick={() => download(pdfUrl, 'pdf', setPdfLoading)}
                />
              )}
              {excelUrl && (
                <MenuRow
                  icon={<FileSpreadsheet size={18}/>}
                  label="تصدير Excel"
                  sub="جدول بيانات"
                  loading={excelLoading}
                  onClick={() => download(excelUrl, 'xlsx', setExcelLoading)}
                  last
                />
              )}
            </div>
          </>
        )}

        {error && <ErrorToast msg={error} onClose={() => setError('')} />}
      </div>
    );
  }

  // ── Side-by-side buttons variant (default) ───────────────────────────────
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontFamily: 'Cairo,sans-serif', position: 'relative' }}>
      {pdfUrl && (
        <button
          onClick={() => download(pdfUrl, 'pdf', setPdfLoading)}
          disabled={isBusy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '.35rem',
            padding: pad, border: '1.5px solid #fca5a5',
            borderRadius: '.625rem', background: pdfLoading ? '#fef2f2' : '#fff',
            color: '#dc2626', fontSize: font, fontWeight: 700,
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? .7 : 1, transition: 'all .15s', fontFamily: 'Cairo,sans-serif',
          }}
          title="تصدير PDF"
        >
          {pdfLoading ? <MiniSpinner color="#dc2626" /> : <FileText size={15}/>}
          {size !== 'sm' && (pdfLoading ? 'جارٍ التصدير…' : 'PDF')}
        </button>
      )}

      {excelUrl && (
        <button
          onClick={() => download(excelUrl, 'xlsx', setExcelLoading)}
          disabled={isBusy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '.35rem',
            padding: pad, border: '1.5px solid #86efac',
            borderRadius: '.625rem', background: excelLoading ? '#f0fdf4' : '#fff',
            color: '#16a34a', fontSize: font, fontWeight: 700,
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? .7 : 1, transition: 'all .15s', fontFamily: 'Cairo,sans-serif',
          }}
          title="تصدير Excel"
        >
          {excelLoading ? <MiniSpinner color="#16a34a" /> : <FileSpreadsheet size={15}/>}
          {size !== 'sm' && (excelLoading ? 'جارٍ التصدير…' : 'Excel')}
        </button>
      )}

      {error && <ErrorToast msg={error} onClose={() => setError('')} />}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MenuRow({ icon, label, sub, loading, onClick, last }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: '.75rem',
        width: '100%', padding: '.75rem 1rem', border: 'none',
        background: 'none', cursor: loading ? 'not-allowed' : 'pointer',
        borderBottom: last ? 'none' : '1px solid #f3f4f6',
        textAlign: 'right', fontFamily: 'Cairo,sans-serif',
        opacity: loading ? .65 : 1, transition: 'background .1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{ fontSize: '1.1rem', display:'flex' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '.83rem', fontWeight: 700, color: '#374151' }}>{label}</div>
        <div style={{ fontSize: '.7rem', color: '#9ca3af' }}>{sub}</div>
      </div>
    </button>
  );
}

function MiniSpinner({ color = '#fff' }) {
  return (
    <span style={{
      display: 'inline-block', width: 13, height: 13,
      border: `2px solid ${color}40`, borderTopColor: color,
      borderRadius: '50%', flexShrink: 0,
      animation: 'export-spin .7s linear infinite',
    }}>
      <style>{`@keyframes export-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function ErrorToast({ msg, onClose }) {
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + .5rem)', right: 0,
      background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
      borderRadius: '.625rem', padding: '.55rem .85rem', fontSize: '.78rem',
      fontWeight: 500, whiteSpace: 'nowrap', zIndex: 100,
      boxShadow: '0 4px 12px rgba(0,0,0,.1)',
      display: 'flex', alignItems: 'center', gap: '.5rem',
    }}>
      <AlertTriangle size={13}/> {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 700, padding: 0 }}><X size={16} /></button>
    </div>
  );
}
