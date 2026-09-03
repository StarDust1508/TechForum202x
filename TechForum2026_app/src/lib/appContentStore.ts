import { VERIFIED_RESEARCH_BENEFIT } from './researchEvidence';

export interface AppContent {
  name: string; tagline: string; description: string; dateLabel: string; dateDetail: string;
  city: string; venueName: string; address: string;
  dayOneTitle: string; dayOneDescription: string; dayTwoTitle: string; dayTwoDescription: string;
  email: string; organizerTelegram: string; telegramChannel: string;
  yandexMapUrl: string; twoGisUrl: string; venueHelp: string;
  researchIntro: string; researchConditions: string;
  researchLawyerTitle: string; researchLawyerDescription: string; researchLawyerMaterial: string; researchLawyerUrl: string;
  researchManagerTitle: string; researchManagerDescription: string; researchManagerMaterial: string; researchManagerUrl: string;
}

export const DEFAULT_APP_CONTENT: AppContent = {
  name: 'ТехнологИИ Права 2026', tagline: 'Два практических дня о том, как ИИ меняет юридическую работу и бизнес.',
  description: 'Первый день — AI, агентные системы, продукты, данные и регулирование. Второй — БФЛ, цифровые доказательства, LegalTech, управление практикой и проверяемые сценарии применения ИИ.',
  dateLabel: '25–26 сентября 2026', dateDetail: 'Пятница и суббота', city: 'Москва', venueName: 'БЦ «Красные Ворота»', address: 'Садовая-Спасская улица, 21/1, Москва',
  dayOneTitle: 'День 1 · AI и агенты', dayOneDescription: 'Агенты, продукты, данные, внедрение и регулирование', dayTwoTitle: 'День 2 · БФЛ и ИИ', dayTwoDescription: 'Суды, доказательства, сделки, LegalTech и рост практики',
  email: 'tickets@notify.tech-pravo.ru', organizerTelegram: 'CEO_WYRM1', telegramChannel: 'TechPravoAI',
  yandexMapUrl: 'https://yandex.ru/maps/?text=%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F-%D0%A1%D0%BF%D0%B0%D1%81%D1%81%D0%BA%D0%B0%D1%8F%2021%2F1',
  twoGisUrl: 'https://2gis.ru/moscow/search/%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F-%D0%A1%D0%BF%D0%B0%D1%81%D1%81%D0%BA%D0%B0%D1%8F%2C%2021%2F1', venueHelp: 'Точная схема этажей появится после подтверждения площадкой.',
  researchIntro: 'Выберите своё направление и расскажите, как вы используете ИИ в работе. Ответы войдут в отраслевой отчёт 2026 года, а после регистрации откроется профессиональный материал.',
  researchConditions: 'ФИО и контакты нужны только для отправки материала, сертификата и результатов исследования. В публичной аналитике ответы показываются без имён и контактных данных.',
  researchLawyerTitle: 'ИИ в юридической практике',
  researchLawyerDescription: 'Инструменты, частота использования, контроль результата, защита данных и барьеры внедрения в юридических командах.',
  researchLawyerMaterial: VERIFIED_RESEARCH_BENEFIT,
  researchLawyerUrl: 'https://tech-pravo.ru/opros2',
  researchManagerTitle: 'ИИ в работе арбитражного управляющего',
  researchManagerDescription: 'Документы, коммуникации, безопасность и задачи, которые можно автоматизировать в процедурах банкротства.',
  researchManagerMaterial: VERIFIED_RESEARCH_BENEFIT,
  researchManagerUrl: 'https://tech-pravo.ru/opros',
};

export const APP_CONTENT_CACHE_KEY = 'tp_app_content_v1';
const CONTENT_KEYS = Object.keys(DEFAULT_APP_CONTENT) as (keyof AppContent)[];

/** The public endpoint is flat. Never accept the private admin envelope or unsafe links. */
export function parseAppContent(value: unknown, previous = DEFAULT_APP_CONTENT): AppContent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const next = { ...previous };
  let found = false;
  for (const key of CONTENT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const item = raw[key];
    if (typeof item !== 'string' || item.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(item)) return null;
    const text = item.trim();
    if (!text) return null;
    if (key === 'email' && !/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(text)) return null;
    if (key === 'organizerTelegram' || key === 'telegramChannel') {
      const username = text.replace(/^@/, '');
      if (!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(username)) return null;
      next[key] = username;
    } else {
      if (key.endsWith('Url')) {
        try {
          const url = new URL(text);
          if (url.protocol !== 'https:' || url.username || url.password) return null;
          if (key.startsWith('research') && url.hostname !== 'tech-pravo.ru' && url.hostname !== 'www.tech-pravo.ru') return null;
        } catch { return null; }
      }
      next[key] = text;
    }
    found = true;
  }
  return found ? next : null;
}

interface ContentStoreOptions {
  load: () => Promise<unknown>;
  readCache?: () => string | null;
  writeCache?: (value: string) => void;
}

/** One snapshot for every screen. Failed requests never replace the last valid data. */
export function createAppContentStore({ load, readCache, writeCache }: ContentStoreOptions) {
  let snapshot: AppContent = DEFAULT_APP_CONTENT;
  try { snapshot = parseAppContent(JSON.parse(readCache?.() || 'null')) || snapshot; } catch { /* storage unavailable */ }
  const listeners = new Set<() => void>();
  let pending: Promise<void> | undefined;
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    refresh(): Promise<void> {
      if (pending) return pending;
      pending = Promise.resolve().then(load).then((data) => {
        const next = parseAppContent(data, snapshot);
        if (!next || CONTENT_KEYS.every((key) => next[key] === snapshot[key])) return;
        snapshot = next;
        try { writeCache?.(JSON.stringify(next)); } catch { /* keep working without storage */ }
        listeners.forEach((listener) => listener());
      }).catch(() => { /* retain last-known-good during network changes */ }).finally(() => { pending = undefined; });
      return pending;
    },
  };
}
