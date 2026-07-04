// FILE: src/data.ts
// VERSION: 2.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Источник истины для статичных доменных данных приложения TechForum 2026 —
//          треки, залы, дни программы, спикеры, сессии, новости. Используется
//          страницами Schedule, Speakers, Chat (AI-контекст), MyRecords.
// SCOPE: Чистые данные + типы. Никакой логики, побочных эффектов, async-вызовов.
// INPUT: Нет (статичный модуль).
// OUTPUT: Типы (Track, Hall, Day, Speaker, Session, NewsItem) + массивы-фикстуры.
// KEYWORDS: DOMAIN(9): ConferenceProgram; CONCEPT(8): StaticFixtures; TECH(5): TypeScript
// LINKS: USED_BY(9): pages/Schedule, pages/Speakers, pages/Chat, pages/MyRecords
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему данные в виде статичного TS-модуля, а не из API?
// A: Backend сейчас in-memory без persistence (см. server.ts) — программа всё равно
//    не приходит с сервера. Инлайн-данные позволяют (1) гарантировать наличие
//    программы в офлайне, (2) типизировать всё через TypeScript на этапе сборки,
//    (3) не блокировать UI на сетевом запросе при холодном старте.
//    Когда появится Postgres (Этап 2), эти данные станут seed-фикстурой для миграции.
// Q: Почему ID для треков/залов/дней, а не строки прямо в Session?
// A: Версия 1.0.0 хардкодила строки ('Зал A' Latin vs 'Зал А' Cyrillic) и фильтры
//    рассинхронизировались (см. Schedule.tsx halls vs data.ts location). ID +
//    отдельные таблицы убирают этот класс багов.
// END_RATIONALE
//
// START_INVARIANTS:
// - Каждый Session.trackId присутствует в TRACKS.
// - Каждый Session.hallId присутствует в HALLS либо равен null (для общих форматов: открытие, обед).
// - Каждый Session.dayId присутствует в DAYS.
// - Каждый Session.speakerIds[*] присутствует в SPEAKERS либо пустой массив (для пауз/обедов).
// - startTime/endTime — формат "HH:MM" (24h, без секунд).
// - SPEAKERS не содержат вымышленных тем — только публично известную экспертизу.
// END_INVARIANTS
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v3.0.0 - Синхронизация с реальной конференцией «ТехнологИИ Права»:
//                       Москва, БЦ «Красные Ворота», 25–26 сентября 2026; 7 потоков,
//                       6 залов, 24 сессии, 5 спикеров (Галкин/Сизов/Артин/Путин/Шабалин),
//                       INTERESTS/NEWS/PARTNERS переведены на юридическую тематику.]
// PREV_CHANGE_SUMMARY: [v2.0.0 - демо-программа Саратова (20-21 мая 2026), tech-спикеры]
// END_CHANGE_SUMMARY
//
// START_MODULE_MAP:
// CONST 9[Список треков с цветовой кодировкой] => TRACKS
// CONST 8[Список залов с ID] => HALLS
// CONST 8[Дни программы] => DAYS
// CONST 9[15 публичных РФ tech-спикеров] => SPEAKERS
// CONST 10[~30 сессий за 2 дня] => SESSIONS
// CONST 6[Лента новостей форума] => NEWS
// CONST 7[Партнёры форума] => PARTNERS
// CONST 8[Метаданные форума: имя, локация, организатор] => EVENT_META
// FUNC 7[Резолв трека по ID] => getTrackById
// FUNC 7[Резолв зала по ID] => getHallById
// FUNC 7[Резолв спикера по ID] => getSpeakerById
// END_MODULE_MAP

// ============================================================================
// SECTION: TYPES
// ============================================================================

export interface Track {
  id: string;
  name: string;
  /** Tailwind-совместимый акцентный цвет (hex). */
  color: string;
  /** Короткий префикс для бейджа (2-4 буквы). */
  shortLabel: string;
}

export interface Hall {
  id: string;
  name: string;
  /** Расчётная вместимость (для будущей фичи waitlist). */
  capacity: number;
}

export interface Day {
  id: string;
  /** Дата в формате ISO YYYY-MM-DD. */
  date: string;
  /** Лейбл для UI: "20 мая". */
  label: string;
  /** День недели для UI: "Среда". */
  weekday: string;
}

export interface Speaker {
  id: string;
  name: string;
  role: string;
  company: string;
  bio: string;
  avatarLetter: string;
  topic?: string;
  /** ID основного трека спикера (для бейджа в карточке). */
  trackId: string;
  /**
   * IDs интересов из INTERESTS, которыми покрывается экспертиза спикера.
   * Используется для ранжирования "Recommended" в Schedule (score =
   * пересечение с интересами пользователя).
   */
  interestIds: string[];
}

export interface Interest {
  id: string;
  label: string;
  /** Hex-цвет акцента pill. */
  color: string;
}

export interface Session {
  id: string;
  title: string;
  description: string;
  /** "HH:MM" 24h. */
  startTime: string;
  /** "HH:MM" 24h. */
  endTime: string;
  /** Тип формата для UI-различения. */
  format: 'keynote' | 'talk' | 'panel' | 'workshop' | 'break' | 'opening' | 'closing';
  /** ID зала из HALLS, либо null для общих форматов (открытие, обед, нетворкинг). */
  hallId: string | null;
  /** ID дня из DAYS. */
  dayId: string;
  /** ID трека из TRACKS, либо null для общих форматов. */
  trackId: string | null;
  /** ID спикеров из SPEAKERS. Пустой массив для общих форматов. */
  speakerIds: string[];
  status: 'Soon' | 'Live' | 'Ended' | 'Moved';

  // === Backwards-compat поля (читаются страницами v1) ===
  /** Имя зала (computed из hallId или 'Главный зал' для общих форматов). */
  location: string;
  /** Имя первого спикера (computed). */
  speakerName: string;
  /** Имя трека (computed из trackId). */
  track: string;
  /** Лейбл дня (computed из dayId). */
  day: string;
}

export interface NewsItem {
  id: string;
  type: string;
  title: string;
  /** Краткий текст — отображается в карточке ленты. */
  content: string;
  /** Длинный текст для страницы детали. */
  body?: string;
  /** Тег времени для UI: "сегодня 14:30", "вчера", "20 мая". */
  time: string;
  isCritical: boolean;
  category?: string;
  /** ID спикера-автора новости (если применимо). */
  speakerId?: string;
}

export interface Partner {
  id: string;
  name: string;
  /** Тип партнёрства для бейджа. */
  tier: 'Генеральный' | 'Платиновый' | 'Золотой' | 'Серебряный' | 'Технологический';
  url: string;
  /** Краткое описание для карточки. */
  description: string;
}

export interface EventMeta {
  /** Полное имя ивента. */
  name: string;
  /** Полное название локации. */
  location: string;
  /** Город. */
  city: string;
  /** Часовой пояс IANA для .ics экспорта. */
  timezone: string;
  /** Организатор. */
  organizer: string;
  /** Email организатора (для .ics ORGANIZER). */
  organizerEmail: string;
  /** Публичный URL ивента (если будет). */
  url: string;
}

// ============================================================================
// SECTION: META
// ============================================================================

export const EVENT_META: EventMeta = {
  name: 'ТехнологИИ Права 2026',
  location: 'БЦ «Красные Ворота», ул. Садовая-Спасская, 21/1',
  city: 'Москва',
  timezone: 'Europe/Moscow',
  organizer: 'Технологии права',
  organizerEmail: 'info@pravotech.pro',
  url: 'https://pravotech.pro',
};

// ============================================================================
// SECTION: TRACKS (потоки конференции)
// ============================================================================

export const TRACKS: Track[] = [
  { id: 'plenar', name: 'Пленарные',             color: '#00ffff', shortLabel: 'ПЛН'  },
  { id: 'bfl',    name: 'Банкротство физлиц',    color: '#a855f7', shortLabel: 'БФЛ'  },
  { id: 'ai',     name: 'ИИ в юрбизнесе',        color: '#ec4899', shortLabel: 'ИИ'   },
  { id: 'auto',   name: 'Автоматизация практики', color: '#3b82f6', shortLabel: 'АВТ' },
  { id: 'lt',     name: 'Legal Tech и сервисы',  color: '#10b981', shortLabel: 'LT'   },
  { id: 'growth', name: 'Рост и масштабирование', color: '#f59e0b', shortLabel: 'РОСТ' },
  { id: 'sec',    name: 'Данные и безопасность', color: '#ef4444', shortLabel: 'ДБ'   },
];

// ============================================================================
// SECTION: HALLS
// ============================================================================

export const HALLS: Hall[] = [
  { id: 'a',      name: 'Зал А',       capacity: 600 },
  { id: 'b',      name: 'Зал Б',       capacity: 220 },
  { id: 'v',      name: 'Зал В',       capacity: 150 },
  { id: 'foyer',  name: 'Фойе',        capacity: 800 },
  { id: 'rest',   name: 'Ресторан',    capacity: 400 },
  { id: 'lounge', name: 'Лаунж-зона',  capacity: 300 },
];

// ============================================================================
// SECTION: DAYS
// ============================================================================

export const DAYS: Day[] = [
  { id: 'd1', date: '2026-09-25', label: '25 сентября', weekday: 'Пятница' },
  { id: 'd2', date: '2026-09-26', label: '26 сентября', weekday: 'Суббота' },
];

// ============================================================================
// SECTION: INTERESTS — справочник 22 направлений для onboarding
// ============================================================================
// Используется (1) при первом входе для выбора 3-10 направлений в Onboarding,
// (2) для ранжирования "Recommended" в Schedule.
// Цвета — hex для pill-акцентов (под dark-bg, ярко, но не кислотно).
// ============================================================================

export const INTERESTS: Interest[] = [
  { id: 'bfl',        label: 'Банкротство физлиц',   color: '#a855f7' },
  { id: 'ai',         label: 'ИИ в праве',           color: '#ec4899' },
  { id: 'automation', label: 'Автоматизация',        color: '#3b82f6' },
  { id: 'legaltech',  label: 'Legal Tech',           color: '#10b981' },
  { id: 'growth',     label: 'Масштабирование',      color: '#f59e0b' },
  { id: 'sales',      label: 'Продажи услуг',        color: '#22c55e' },
  { id: 'management', label: 'Управление практикой', color: '#6366f1' },
  { id: 'court',      label: 'Судебная практика',    color: '#0ea5e9' },
  { id: 'compliance', label: 'Данные и 152-ФЗ',      color: '#ef4444' },
  { id: 'docs',       label: 'Документооборот',      color: '#14b8a6' },
  { id: 'marketing',  label: 'Маркетинг',            color: '#d946ef' },
  { id: 'career',     label: 'Карьера юриста',       color: '#eab308' },
];

// ============================================================================
// SECTION: SPEAKERS
// ============================================================================
// ПРИНЦИП: реальные публичные tech-figures РФ-сцены, реальные актуальные роли,
// темы из их публично известной экспертизы (без выдумок).
// ============================================================================

export const SPEAKERS: Speaker[] = [
  {
    id: 'sp_galkin',
    name: 'Владислав Галкин',
    role: 'Управляющий партнёр',
    company: 'ЮК «Галкин и партнёры»',
    bio: 'Руководит одной из ведущих юридических компаний в сфере банкротства физических лиц. Специализация — масштабирование БФЛ-практики и управление командой.',
    avatarLetter: 'ВГ',
    topic: 'Масштабирование БФЛ-практики до федерального уровня',
    trackId: 'bfl',
    interestIds: ['bfl', 'growth', 'management'],
  },
  {
    id: 'sp_sizov',
    name: 'Дмитрий Сизов',
    role: 'CEO',
    company: 'LegalTech Solutions',
    bio: 'Развивает цифровые платформы и сервисы для юридического бизнеса. Эксперт по внедрению Legal Tech и LLM-ассистентов в юридическую практику.',
    avatarLetter: 'ДС',
    topic: 'Цифровые платформы и сервисы Legal Tech',
    trackId: 'lt',
    interestIds: ['legaltech', 'ai'],
  },
  {
    id: 'sp_artin',
    name: 'Василий Артин',
    role: 'Арбитражный управляющий',
    company: 'СРО «Дело»',
    bio: 'Практикующий арбитражный управляющий. Ведёт дела о банкротстве физических лиц, эксперт по судебной практике и оспариванию сделок.',
    avatarLetter: 'ВА',
    topic: 'Судебная практика и оспаривание сделок в БФЛ',
    trackId: 'bfl',
    interestIds: ['bfl', 'court'],
  },
  {
    id: 'sp_putin',
    name: 'Дмитрий Путин',
    role: 'CTO',
    company: 'NeuroPravo',
    bio: 'Отвечает за разработку ИИ-ассистентов и предиктивной аналитики для юридической практики. Тема — промышленное применение LLM в праве.',
    avatarLetter: 'ДП',
    topic: 'Предиктивная аналитика и ИИ-ассистенты для юрпрактики',
    trackId: 'ai',
    interestIds: ['ai', 'automation'],
  },
  {
    id: 'sp_shabalin',
    name: 'Егор Шабалин',
    role: 'Руководитель направления',
    company: 'ПравоТех',
    bio: 'Руководит направлением автоматизации в ПравоТех. Специализация — CRM и документооборот в юридической компании, защита персональных данных.',
    avatarLetter: 'ЕШ',
    topic: 'CRM и документооборот в юридической компании',
    trackId: 'auto',
    interestIds: ['automation', 'docs', 'compliance'],
  },
];

// ============================================================================
// SECTION: SESSIONS — 2-дневная программа
// ============================================================================

// START_BLOCK_BUILD_SESSIONS: построение массива сессий с инлайн-резолвом
// computed-полей (location, speakerName, track, day) для backwards-compat.

const trackById = (id: string | null): Track | undefined => TRACKS.find(t => t.id === id);
const hallById  = (id: string | null): Hall  | undefined => HALLS.find(h => h.id === id);
const dayById   = (id: string): Day  | undefined => DAYS.find(d => d.id === id);
const speakerById = (id: string): Speaker | undefined => SPEAKERS.find(s => s.id === id);

interface SessionInput {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  format: Session['format'];
  hallId: string | null;
  dayId: string;
  trackId: string | null;
  speakerIds: string[];
  status: Session['status'];
}

function buildSession(input: SessionInput): Session {
  const hall = hallById(input.hallId);
  const day = dayById(input.dayId);
  const track = trackById(input.trackId);
  const firstSpeaker = input.speakerIds[0] ? speakerById(input.speakerIds[0]) : undefined;

  return {
    ...input,
    location: hall?.name ?? 'Главный зал',
    speakerName: firstSpeaker?.name ?? '—',
    track: track?.name ?? 'Общее',
    day: day?.label ?? '—',
  };
}

// END_BLOCK_BUILD_SESSIONS

export const SESSIONS: Session[] = [
  // ===== DAY 1: 25 сентября (пятница) =====
  buildSession({ id: 's_d1_reg', title: 'Регистрация участников, welcome-кофе', description: 'Регистрация, приветственный кофе и нетворкинг перед открытием.', startTime: '09:00', endTime: '10:00', format: 'break', hallId: 'foyer', dayId: 'd1', trackId: null, speakerIds: [], status: 'Soon' }),
  buildSession({ id: 's_d1_open', title: 'Торжественное открытие конференции', description: 'Вступительное слово организаторов, обзор программы двух дней.', startTime: '10:00', endTime: '10:30', format: 'opening', hallId: 'a', dayId: 'd1', trackId: 'plenar', speakerIds: ['sp_galkin'], status: 'Soon' }),
  buildSession({ id: 's_d1_market', title: 'Рынок банкротства физлиц 2026: тренды, цифры, прогнозы', description: 'Обзор рынка БФЛ: динамика, ключевые игроки, прогнозы на 2026 год.', startTime: '10:30', endTime: '11:30', format: 'keynote', hallId: 'a', dayId: 'd1', trackId: 'bfl', speakerIds: ['sp_artin'], status: 'Soon' }),
  buildSession({ id: 's_d1_coffee1', title: 'Кофе-брейк, нетворкинг', description: 'Перерыв и общение.', startTime: '11:30', endTime: '12:00', format: 'break', hallId: 'foyer', dayId: 'd1', trackId: null, speakerIds: [], status: 'Soon' }),
  buildSession({ id: 's_d1_court', title: 'Судебная практика и оспаривание сделок в БФЛ', description: 'Разбор актуальной судебной практики по оспариванию сделок должника.', startTime: '12:00', endTime: '13:00', format: 'talk', hallId: 'a', dayId: 'd1', trackId: 'bfl', speakerIds: ['sp_artin'], status: 'Soon' }),
  buildSession({ id: 's_d1_llm', title: 'LLM-ассистенты для юристов: возможности и риски', description: 'Как большие языковые модели меняют работу юриста — кейсы и ограничения.', startTime: '12:00', endTime: '13:00', format: 'talk', hallId: 'b', dayId: 'd1', trackId: 'ai', speakerIds: ['sp_sizov'], status: 'Soon' }),
  buildSession({ id: 's_d1_lunch', title: 'Обед', description: 'Перерыв на обед.', startTime: '13:00', endTime: '14:00', format: 'break', hallId: 'rest', dayId: 'd1', trackId: null, speakerIds: [], status: 'Soon' }),
  buildSession({ id: 's_d1_scale', title: 'Масштабирование БФЛ-практики до федерального уровня', description: 'Как вырастить банкротную практику до федерального масштаба.', startTime: '14:00', endTime: '15:00', format: 'talk', hallId: 'a', dayId: 'd1', trackId: 'bfl', speakerIds: ['sp_galkin'], status: 'Soon' }),
  buildSession({ id: 's_d1_crm', title: 'CRM и документооборот в юридической компании', description: 'Автоматизация клиентской работы и документооборота в юрбизнесе.', startTime: '14:00', endTime: '15:00', format: 'workshop', hallId: 'v', dayId: 'd1', trackId: 'auto', speakerIds: ['sp_shabalin'], status: 'Soon' }),
  buildSession({ id: 's_d1_coffee2', title: 'Кофе-брейк', description: 'Перерыв и общение.', startTime: '15:00', endTime: '15:30', format: 'break', hallId: 'foyer', dayId: 'd1', trackId: null, speakerIds: [], status: 'Soon' }),
  buildSession({ id: 's_d1_predict', title: 'Предиктивная аналитика судебных решений', description: 'Прогнозирование исхода дел на основе данных и ИИ.', startTime: '15:30', endTime: '16:30', format: 'talk', hallId: 'a', dayId: 'd1', trackId: 'ai', speakerIds: ['sp_putin'], status: 'Soon' }),
  buildSession({ id: 's_d1_platforms', title: 'Цифровые платформы и сервисы Legal Tech', description: 'Обзор платформ и сервисов, меняющих юридический рынок.', startTime: '15:30', endTime: '16:30', format: 'talk', hallId: 'b', dayId: 'd1', trackId: 'lt', speakerIds: ['sp_sizov'], status: 'Soon' }),
  buildSession({ id: 's_d1_panel', title: 'Панельная дискуссия: ИИ и будущее юридической профессии', description: 'Спикеры конференции обсуждают, как ИИ меняет профессию юриста.', startTime: '16:30', endTime: '17:30', format: 'panel', hallId: 'a', dayId: 'd1', trackId: 'plenar', speakerIds: ['sp_galkin', 'sp_sizov', 'sp_artin'], status: 'Soon' }),
  buildSession({ id: 's_d1_networking', title: 'Вечерний нетворкинг', description: 'Неформальное общение участников.', startTime: '17:30', endTime: '18:30', format: 'break', hallId: 'lounge', dayId: 'd1', trackId: null, speakerIds: [], status: 'Soon' }),

  // ===== DAY 2: 26 сентября (суббота) =====
  buildSession({ id: 's_d2_pd', title: 'Защита персональных данных и compliance (152-ФЗ)', description: 'Требования 152-ФЗ к юридическому бизнесу и как им соответствовать.', startTime: '10:00', endTime: '11:00', format: 'talk', hallId: 'a', dayId: 'd2', trackId: 'sec', speakerIds: ['sp_shabalin'], status: 'Soon' }),
  buildSession({ id: 's_d2_docs', title: 'Автоматизация подготовки документов БФЛ (мастер-класс)', description: 'Практический мастер-класс по автоматизации процессуальных документов.', startTime: '10:00', endTime: '11:00', format: 'workshop', hallId: 'v', dayId: 'd2', trackId: 'auto', speakerIds: ['sp_putin'], status: 'Soon' }),
  buildSession({ id: 's_d2_team', title: 'Управление командой, продажи и операционка практики', description: 'Как выстроить команду, продажи и операционные процессы в юрпрактике.', startTime: '11:00', endTime: '12:00', format: 'talk', hallId: 'b', dayId: 'd2', trackId: 'growth', speakerIds: ['sp_galkin'], status: 'Soon' }),
  buildSession({ id: 's_d2_coffee1', title: 'Кофе-брейк', description: 'Перерыв и общение.', startTime: '12:00', endTime: '12:30', format: 'break', hallId: 'foyer', dayId: 'd2', trackId: null, speakerIds: [], status: 'Soon' }),
  buildSession({ id: 's_d2_cases', title: 'Кейсы лидеров рынка Legal Tech', description: 'Разбор успешных кейсов внедрения Legal Tech на рынке.', startTime: '12:30', endTime: '13:30', format: 'talk', hallId: 'a', dayId: 'd2', trackId: 'lt', speakerIds: ['sp_sizov'], status: 'Soon' }),
  buildSession({ id: 's_d2_lunch', title: 'Обед', description: 'Перерыв на обед.', startTime: '13:30', endTime: '14:30', format: 'break', hallId: 'rest', dayId: 'd2', trackId: null, speakerIds: [], status: 'Soon' }),
  buildSession({ id: 's_d2_demo', title: 'Демо промышленных ИИ-ассистентов для юрпрактики', description: 'Живая демонстрация ИИ-ассистентов в реальных юридических задачах.', startTime: '14:30', endTime: '15:30', format: 'talk', hallId: 'a', dayId: 'd2', trackId: 'ai', speakerIds: ['sp_putin'], status: 'Soon' }),
  buildSession({ id: 's_d2_growth', title: 'Рост и масштабирование: от первого клиента до федерального масштаба', description: 'Путь юридической практики от старта до федерального масштаба.', startTime: '15:30', endTime: '16:30', format: 'talk', hallId: 'b', dayId: 'd2', trackId: 'growth', speakerIds: ['sp_shabalin'], status: 'Soon' }),
  buildSession({ id: 's_d2_close', title: 'Награждение БФЛ-практик года. Закрытие конференции', description: 'Награждение лучших практик года и торжественное закрытие.', startTime: '16:30', endTime: '17:00', format: 'closing', hallId: 'a', dayId: 'd2', trackId: 'plenar', speakerIds: [], status: 'Soon' }),
  buildSession({ id: 's_d2_afterparty', title: 'After-party', description: 'Неформальное завершение конференции.', startTime: '17:00', endTime: '18:00', format: 'break', hallId: 'lounge', dayId: 'd2', trackId: null, speakerIds: [], status: 'Soon' }),
];

// ============================================================================
// SECTION: PARTNERS
// ============================================================================

export const PARTNERS: Partner[] = [
  {
    id: 'p_legalhunter',
    name: 'LegalHunter',
    tier: 'Генеральный',
    url: 'https://legalhunter.pro',
    description: 'Платформа для автоматизации юридической практики и работы с БФЛ.',
  },
  {
    id: 'p_ailegal',
    name: 'AI Legal',
    tier: 'Технологический',
    url: 'https://expertum.pro',
    description: 'ИИ-инструменты и обучение для юристов.',
  },
  {
    id: 'p_xhunter',
    name: 'X Hunter',
    tier: 'Технологический',
    url: 'https://x-hunter.expert',
    description: 'Аналитика и поиск данных для юридического бизнеса.',
  },
  {
    id: 'p_neuropravo',
    name: 'NeuroPravo',
    tier: 'Золотой',
    url: 'https://t.me/NeuroPravo_Bot',
    description: 'Telegram-бот с материалами и чек-листами для юристов.',
  },
];

// ============================================================================
// SECTION: NEWS
// ============================================================================

export const NEWS: NewsItem[] = [
  {
    id: 'n_program',
    type: 'Программа',
    title: 'Опубликована программа: 7 потоков, 24 сессии',
    content: 'Два дня, 25–26 сентября — банкротство физлиц, ИИ в юрбизнесе, автоматизация практики, Legal Tech, рост и масштабирование, данные и безопасность.',
    body: 'Полная программа конференции доступна в разделе «Расписание». Вы можете отметить интересные сессии и выгрузить свою программу в календарь.',
    time: 'сегодня',
    isCritical: true,
    category: 'Программа',
  },
  {
    id: 'n_venue',
    type: 'Организация',
    title: 'Площадка — БЦ «Красные Ворота», Москва',
    content: 'Конференция пройдёт в бизнес-центре «Красные Ворота», ул. Садовая-Спасская, 21/1.',
    time: 'сегодня',
    isCritical: false,
    category: 'Организация',
  },
  {
    id: 'n_open',
    type: 'Расписание',
    title: 'Открытие — 25 сентября в 10:00',
    content: 'Торжественное открытие в Зале А. Регистрация и welcome-кофе с 09:00.',
    time: 'вчера',
    isCritical: false,
    category: 'Программа',
    speakerId: 'sp_galkin',
  },
  {
    id: 'n_panel',
    type: 'Анонс',
    title: 'Панельная дискуссия: ИИ и будущее профессии',
    content: '25 сентября, 16:30 — спикеры конференции обсудят, как ИИ меняет работу юриста.',
    time: 'вчера',
    isCritical: false,
    category: 'Программа',
    speakerId: 'sp_sizov',
  },
  {
    id: 'n_pd',
    type: 'Анонс',
    title: '152-ФЗ и compliance — во второй день',
    content: '26 сентября — отдельный блок по защите персональных данных и требованиям 152-ФЗ для юридического бизнеса.',
    time: '2 дня назад',
    isCritical: false,
    category: 'Программа',
    speakerId: 'sp_shabalin',
  },
  {
    id: 'n_award',
    type: 'Итоги',
    title: 'Награждение БФЛ-практик года',
    content: '26 сентября в 16:30 — награждение лучших практик года и закрытие конференции.',
    time: '2 дня назад',
    isCritical: false,
    category: 'Программа',
  },
];

// ============================================================================
// SECTION: HELPERS — публичные резолверы для использования в страницах
// ============================================================================

// START_FUNCTION_getTrackById
// START_CONTRACT:
// PURPOSE: Резолвит трек по ID, возвращает undefined если не найден.
// INPUTS: id => string | null | undefined
// OUTPUTS: Track | undefined
// COMPLEXITY_SCORE: 1
// END_CONTRACT
export function getTrackById(id: string | null | undefined): Track | undefined {
  if (!id) return undefined;
  return TRACKS.find(t => t.id === id);
}
// END_FUNCTION_getTrackById

// START_FUNCTION_getHallById
// START_CONTRACT:
// PURPOSE: Резолвит зал по ID, возвращает undefined если не найден.
// INPUTS: id => string | null | undefined
// OUTPUTS: Hall | undefined
// COMPLEXITY_SCORE: 1
// END_CONTRACT
export function getHallById(id: string | null | undefined): Hall | undefined {
  if (!id) return undefined;
  return HALLS.find(h => h.id === id);
}
// END_FUNCTION_getHallById

// START_FUNCTION_getSpeakerById
// START_CONTRACT:
// PURPOSE: Резолвит спикера по ID, возвращает undefined если не найден.
// INPUTS: id => string | null | undefined
// OUTPUTS: Speaker | undefined
// COMPLEXITY_SCORE: 1
// END_CONTRACT
export function getSpeakerById(id: string | null | undefined): Speaker | undefined {
  if (!id) return undefined;
  return SPEAKERS.find(s => s.id === id);
}
// END_FUNCTION_getSpeakerById

// START_FUNCTION_getDayById
// START_CONTRACT:
// PURPOSE: Резолвит день программы по ID, возвращает undefined если не найден.
// INPUTS: id => string | null | undefined
// OUTPUTS: Day | undefined
// COMPLEXITY_SCORE: 1
// END_CONTRACT
export function getDayById(id: string | null | undefined): Day | undefined {
  if (!id) return undefined;
  return DAYS.find(d => d.id === id);
}
// END_FUNCTION_getDayById
