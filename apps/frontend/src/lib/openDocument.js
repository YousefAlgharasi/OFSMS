import api from './api';
import { isNativeApp, saveBlobFile } from './saveFile';

/**
 * Open an attached document. Documents need the signed-in session, so they are
 * fetched through the API client and shown from a temporary blob address.
 */
export async function openDocument(doc) {
  const popup = isNativeApp() ? null : window.open('', '_blank');
  try {
    const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
    const blob = res.data;
    if (isNativeApp()) {
      await saveBlobFile(blob, doc.original_name || 'document');
      return;
    }
    const url = URL.createObjectURL(blob);
    if (popup && !popup.closed) {
      popup.location.href = url;
    } else {
      // Pop-up blocked (common on phones): open the file in this tab instead
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (err) {
    if (popup) popup.close();
    let msg = 'تعذّر فتح المستند';
    const status = err.response?.status;
    if (status === 404) msg = 'الملف غير متوفر على الخادم (قد يكون رُفع قبل تفعيل التخزين الدائم). يرجى إعادة رفعه.';
    else if (status === 403) msg = 'غير مصرح لك بعرض هذا المستند';
    else if (status === 401) msg = 'انتهت الجلسة، يرجى تسجيل الدخول من جديد';
    try {
      const data = err.response?.data;
      const text = data instanceof Blob ? await data.text() : null;
      msg = (text && JSON.parse(text).error) || msg;
    } catch { /* keep default */ }
    alert(msg);
  }
}
