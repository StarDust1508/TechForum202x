import { useEffect, useState } from 'react';
import { fetchWithTimeout, resolveApiUrl } from './runtimeEndpoint';

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
  researchIntro: 'Ответы используются в агрегированной аналитике. После короткой регистрации профессиональный материал открывается сразу; прохождение сохраняется и продолжается с того же места.',
  researchConditions: 'Материал доступен после регистрации на выбранном лендинге. Условия сертификатов и проверяемого розыгрыша опубликованы там же; приложение не подменяет их отдельным описанием.',
  researchLawyerTitle: 'ИИ в работе юристов',
  researchLawyerDescription: '12 практических вопросов о сценариях применения ИИ, барьерах, инструментах и защите данных.',
  researchLawyerMaterial: 'Профессиональный PDF: мировые практики, российский рынок и прикладные инструменты 2026.',
  researchLawyerUrl: 'https://tech-pravo.ru/opros2',
  researchManagerTitle: 'Практика и защита управляющего',
  researchManagerDescription: 'Исследование рабочих процессов, рисков, судебных позиций и направлений автоматизации.',
  researchManagerMaterial: 'Практический PDF: защита арбитражного управляющего, судебные позиции и рабочие ориентиры.',
  researchManagerUrl: 'https://tech-pravo.ru/opros',
};

const CACHE_KEY = 'tp_app_content_v1';
function cached(): AppContent {
  try { return { ...DEFAULT_APP_CONTENT, ...JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') }; }
  catch { return DEFAULT_APP_CONTENT; }
}

export function useAppContent(): AppContent {
  const [content, setContent] = useState<AppContent>(cached);
  useEffect(() => {
    const controller = new AbortController();
    fetchWithTimeout(resolveApiUrl('/app-content'), { signal: controller.signal })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((data) => { const next = { ...DEFAULT_APP_CONTENT, ...data }; setContent(next); try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* noop */ } })
      .catch(() => { /* last-known-good remains visible */ });
    return () => controller.abort();
  }, []);
  return content;
}
