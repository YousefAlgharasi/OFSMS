'use client';

/**
 * OfflineReadyChip.jsx — small status pill while the app saves itself for offline use
 * (see lib/offlineWarmup.js). Shown only while saving, and briefly when done.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, CloudOff, Loader2 } from 'lucide-react';
import { getWarmStatus, subscribeWarmStatus } from '../lib/offlineWarmup';

export default function OfflineReadyChip() {
  const status = useSyncExternalStore(subscribeWarmStatus, getWarmStatus, getWarmStatus);
  const [visible, setVisible] = useState(false);
  const prev = useRef(status.state);

  useEffect(() => {
    const before = prev.current;
    prev.current = status.state;

    if (status.state === 'running') {
      setVisible(true);
      return undefined;
    }
    // "ready" on its own (nothing needed saving again) stays hidden; the end of a real save is announced
    const announce = (status.state === 'ready' && before === 'running') || status.state === 'unsupported' || status.state === 'error';
    if (!announce) {
      setVisible(false);
      return undefined;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), status.state === 'ready' ? 4000 : 9000);
    return () => clearTimeout(timer);
  }, [status.state]);

  if (!visible) return null;

  const pct = status.total > 0 ? Math.min(100, Math.round((status.done / status.total) * 100)) : 0;
  const tone =
    status.state === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : status.state === 'running' ? 'border-blue-200 bg-blue-50 text-blue-800'
        : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-40 flex justify-center sm:inset-x-auto sm:left-4 sm:justify-start" dir="rtl" role="status">
      <div className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold shadow-lg ${tone}`}>
        {status.state === 'running' && <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ حفظ التطبيق للعمل دون اتصال… {pct}%</>}
        {status.state === 'ready' && <><CheckCircle2 className="h-4 w-4" /> التطبيق جاهز للعمل دون اتصال</>}
        {(status.state === 'unsupported' || status.state === 'error') && (
          <><CloudOff className="h-4 w-4" /> العمل دون اتصال غير مفعّل على هذا الجهاز</>
        )}
      </div>
    </div>
  );
}
