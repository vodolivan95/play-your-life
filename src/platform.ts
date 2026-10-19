import { Capacitor } from '@capacitor/core';

/**
 * Отличает установленное мобильное приложение (Capacitor/Android) от того же сайта,
 * открытого в браузере телефона. На сайте Capacitor не подключён как раннтайм —
 * isNativePlatform() в этом случае всегда false, поэтому веб-версия не меняется.
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
