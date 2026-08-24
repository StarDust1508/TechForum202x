import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppSettingsPlugin {
  openNotificationSettings(): Promise<void>;
}

const AppSettings = registerPlugin<AppSettingsPlugin>('AppSettings');

export async function openNotificationSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return false;
  try {
    await AppSettings.openNotificationSettings();
    return true;
  } catch {
    return false;
  }
}
