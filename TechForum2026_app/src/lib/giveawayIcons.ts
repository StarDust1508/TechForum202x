// FILE: src/lib/giveawayIcons.ts
// Round 5: маппинг iconKey (string из БД) → LucideIcon компонент.
// БД хранит только имя иконки (iconKey: 'Laptop'), фронт мапит на компонент.

import {
  Laptop, Headphones, Watch, Smartphone, Camera, Plane, BookOpen,
  Mic2, Coffee, Backpack, Gift, Award, Sparkles,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Laptop, Headphones, Watch, Smartphone, Camera, Plane, BookOpen,
  Mic2, Coffee, Backpack, Gift, Award, Sparkles,
};

export function iconForKey(key: string | null | undefined): LucideIcon {
  if (!key) return Gift;
  return ICON_MAP[key] ?? Gift;
}

export interface GiveawayApi {
  id: string;
  category: string;
  item: string;
  iconKey: string;
  gradient: string;
  description: string;
  condition: string;
  endTime: string;
  featured: boolean;
}
