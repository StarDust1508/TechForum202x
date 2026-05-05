// Тонкая обёртка над @capacitor/haptics с silent-fallback на web/без плагина.
// Отдельный модуль чтобы не тянуть импорт плагина в каждое место (включая в
// dev-server, где плагин не bundled). Все вызовы идут через dynamic import,
// который Vite ленив-загрузит только когда реально дёрнули.

let cachedNative: 'native' | 'web' | null = null;
function isNative(): boolean {
  if (cachedNative !== null) return cachedNative === 'native';
  const Capacitor: any = (window as any).Capacitor;
  const native = !!(Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
  cachedNative = native ? 'native' : 'web';
  return native;
}

export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: map[style] });
  } catch { /* plugin not installed yet */ }
}

export async function hapticSelection(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics } = await import('@capacitor/haptics');
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch { /* noop */ }
}

export async function hapticNotify(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error };
    await Haptics.notification({ type: map[type] });
  } catch { /* noop */ }
}
