/**
 * saveFile.js — save a downloaded file (PDF / Excel) on the user's device.
 *
 * In a normal browser it triggers a regular download. Inside the Android app
 * (a Capacitor WebView) `<a download>` on a blob does nothing, so the file is
 * written to the app cache with the native Filesystem plugin and then handed to
 * the system share sheet (open in a PDF viewer, save to Drive, send on WhatsApp…).
 */

const plugins = {};

const getCapacitor = () => (typeof window !== 'undefined' ? window.Capacitor : null);

export function isNativeApp() {
  const cap = getCapacitor();
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

// Native plugins are available on the injected bridge; look one up by name
function getPlugin(name) {
  const cap = getCapacitor();
  if (!cap) return null;
  if (plugins[name]) return plugins[name];
  const plugin = cap.Plugins?.[name] || (typeof cap.registerPlugin === 'function' ? cap.registerPlugin(name) : null);
  if (plugin) plugins[name] = plugin;
  return plugin || null;
}

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(blob);
  });

// File names go into a path: keep Arabic letters, drop path separators and reserved characters
const safeFileName = (name) => name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'ملف';

export async function saveBlobFile(blob, filename) {
  if (isNativeApp()) {
    const Filesystem = getPlugin('Filesystem');
    const Share = getPlugin('Share');
    if (!Filesystem || !Share) {
      throw new Error('تصدير الملفات يحتاج إلى نسخة أحدث من التطبيق. أعد بناء التطبيق ثم ثبّته من جديد.');
    }
    const name = safeFileName(filename);
    const data = await blobToBase64(blob);
    const { uri } = await Filesystem.writeFile({
      path: name,
      data,
      directory: 'CACHE',
      recursive: true,
    });
    await Share.share({ title: name, url: uri, dialogTitle: 'حفظ أو مشاركة الملف' });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
