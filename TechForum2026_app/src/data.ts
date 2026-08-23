// FILE: src/data.ts
// VERSION: 3.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Источник истины для статичных доменных данных приложения «ТехнологИИ Права 2026» —
//          треки, залы, дни программы, спикеры, сессии, новости. Служит seed-фикстурой
//          для Postgres (src/db/seed.ts) и in-memory снапшотом для .ics/AI-контекста в server.ts.
// SCOPE: Чистые данные + типы. Никакой логики, побочных эффектов, async-вызовов.
// INPUT: Нет (статичный модуль).
// OUTPUT: Типы (Track, Hall, Day, Speaker, Session, NewsItem) + массивы-фикстуры.
// KEYWORDS: DOMAIN(9): ConferenceProgram; CONCEPT(8): StaticFixtures; TECH(5): TypeScript
// LINKS: USED_BY(9): pages/Schedule, pages/Speakers, pages/Chat, pages/MyRecords; SEED(10): src/db/seed.ts
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему данные в виде статичного TS-модуля, а не из API?
// A: Модуль — единственный источник истины для seed'а БД (src/db/seed.ts). Программа
//    пользователю отдаётся уже из Postgres через /api/v1 (tracks/halls/days/speakers/
//    sessions), а этот файл — то, что засевается в БД. Правка программы = правка здесь
//    + re-seed прод-БД (npm run db:seed).
// Q: Почему ID для треков/залов/дней, а не строки прямо в Session?
// A: Ранние версии хардкодили строки ('Зал A' Latin vs 'Зал А' Cyrillic) и фильтры
//    рассинхронизировались. ID + отдельные таблицы убирают этот класс багов.
// END_RATIONALE
//
// START_INVARIANTS:
// - Каждый Session.trackId присутствует в TRACKS либо равен null (для общих форматов: открытие, обед, панель, нетворкинг).
// - Каждый Session.hallId присутствует в HALLS либо равен null.
// - Каждый Session.dayId присутствует в DAYS.
// - Каждый Session.speakerIds[*] присутствует в SPEAKERS либо пустой массив (для пауз/обедов).
// - startTime/endTime — формат "HH:MM" (24h, без секунд).
// - Программа — ПРЕДВАРИТЕЛЬНАЯ и повторяет деловую программу с tech-pravo.ru/conference.
//   ФИО спикеров условные (закреплены под роли/компании из программы); финальный состав
//   (35+) публикуется на tech-pravo.ru/conference. См. NEWS[0].
// END_INVARIANTS
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v3.0.0 - Программа переведена на конференцию «ТехнологИИ Права 2026»
//                       (25-26 сентября 2026, Москва, БЦ «Красные Ворота»): 6 юридических
//                       потоков, 6 залов (Зал А/Б/В + Фойе/Ресторан/Лаунж), 24 сессии
//                       (1:1 с деловой программой сайта), 5 спикеров по ролям из PDF,
//                       легальные партнёры и новости. Бренд/организатор → «Технологии права».
//                       Данные предварительные, ФИО условные.]
// PREV_CHANGE_SUMMARY: [v2.0.0 - демо-программа TechForum (AI/ML), 6 tech-треков, 3 зала, 15 РФ tech-спикеров]
// END_CHANGE_SUMMARY
//
// START_MODULE_MAP:
// CONST 9[Список треков с цветовой кодировкой] => TRACKS
// CONST 8[Список залов с ID] => HALLS
// CONST 8[Дни программы] => DAYS
// CONST 9[Спикеры конференции (условные ФИО по ролям из программы)] => SPEAKERS
// CONST 10[24 сессии за 2 дня] => SESSIONS
// CONST 6[Лента новостей конференции] => NEWS
// CONST 7[Партнёры конференции] => PARTNERS
// CONST 8[Метаданные ивента: имя, локация, организатор] => EVENT_META
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
  /** Лейбл для UI: "25 сентября". */
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
  /** Имя зала (computed из hallId или 'Зал А' для общих форматов). */
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
  /** Тег времени для UI: "сегодня 14:30", "вчера", "25 сентября". */
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
  location: 'БЦ «Красные Ворота», Садовая-Спасская 21/1',
  city: 'Москва',
  timezone: 'Europe/Moscow',
  organizer: 'Технологии права',
  organizerEmail: 'tickets@notify.tech-pravo.ru',
  url: 'https://tech-pravo.ru',
};

// ============================================================================
// SECTION: TRACKS — 6 юридических потоков (как на tech-pravo.ru/conference)
// ============================================================================

export const TRACKS: Track[] = [
  { id: 't_bfl',        name: 'Банкротство физлиц',    color: '#ec4899', shortLabel: 'БФЛ'  },
  { id: 't_ai',         name: 'ИИ в юрбизнесе',        color: '#a855f7', shortLabel: 'ИИ'   },
  { id: 't_automation', name: 'Автоматизация практики', color: '#f59e0b', shortLabel: 'АВТО' },
  { id: 't_legaltech',  name: 'Legal Tech и сервисы',  color: '#00ffff', shortLabel: 'LT'   },
  { id: 't_growth',     name: 'Рост и масштабирование', color: '#10b981', shortLabel: 'РОСТ' },
  { id: 't_data',       name: 'Данные и безопасность', color: '#ef4444', shortLabel: 'ПДн'  },
];

// ============================================================================
// SECTION: HALLS — БЦ «Красные Ворота» (Зал А/Б/В + общие зоны)
// ============================================================================

export const HALLS: Hall[] = [
  { id: 'zal_a',      name: 'Зал А',       capacity: 300 },
  { id: 'zal_b',      name: 'Зал Б',       capacity: 200 },
  { id: 'zal_v',      name: 'Зал В',       capacity: 150 },
  { id: 'foyer',      name: 'Фойе',        capacity: 500 },
  { id: 'restaurant', name: 'Ресторан',    capacity: 300 },
  { id: 'lounge',     name: 'Лаунж-зона',  capacity: 200 },
];

// ============================================================================
// SECTION: DAYS
// ============================================================================

export const DAYS: Day[] = [
  { id: 'd1', date: '2026-09-25', label: '25 сентября', weekday: 'Пятница' },
  { id: 'd2', date: '2026-09-26', label: '26 сентября', weekday: 'Суббота' },
];

// ============================================================================
// SECTION: INTERESTS — справочник направлений для onboarding
// ============================================================================
// Используется (1) при первом входе для выбора направлений в Onboarding,
// (2) для ранжирования "Recommended" в Schedule.
// Цвета — hex для pill-акцентов (под dark-bg, ярко, но не кислотно).
// ============================================================================

export const INTERESTS: Interest[] = [
  { id: 'bfl',        label: 'Банкротство физлиц',    color: '#ec4899' },
  { id: 'arbitrage',  label: 'Арбитраж',              color: '#f472b6' },
  { id: 'courts',     label: 'Судебная практика',     color: '#a855f7' },
  { id: 'ai_law',     label: 'ИИ для юристов',        color: '#8b5cf6' },
  { id: 'llm',        label: 'LLM-ассистенты',        color: '#a78bfa' },
  { id: 'analytics',  label: 'Предиктивная аналитика', color: '#6366f1' },
  { id: 'automation', label: 'Автоматизация',         color: '#f59e0b' },
  { id: 'docs',       label: 'Документооборот',       color: '#fbbf24' },
  { id: 'crm',        label: 'CRM для юристов',        color: '#eab308' },
  { id: 'legaltech',  label: 'Legal Tech',            color: '#00ffff' },
  { id: 'platforms',  label: 'Цифровые платформы',    color: '#06b6d4' },
  { id: 'compliance', label: 'Compliance / 152-ФЗ',   color: '#ef4444' },
  { id: 'pdn',        label: 'Защита ПДн',            color: '#f87171' },
  { id: 'security',   label: 'Данные и безопасность', color: '#dc2626' },
  { id: 'growth',     label: 'Рост практики',         color: '#10b981' },
  { id: 'scaling',    label: 'Масштабирование',       color: '#22c55e' },
  { id: 'management', label: 'Управление практикой',  color: '#14b8a6' },
  { id: 'sales',      label: 'Продажи юруслуг',       color: '#34d399' },
  { id: 'marketing',  label: 'Юрмаркетинг',           color: '#d946ef' },
  { id: 'contracts',  label: 'Договорная работа',     color: '#0ea5e9' },
  { id: 'corporate',  label: 'Корпоративное право',   color: '#3b82f6' },
  { id: 'education',  label: 'Обучение юристов',      color: '#818cf8' },
];

// ============================================================================
// SECTION: SPEAKERS
// ============================================================================
// ПРЕДВАРИТЕЛЬНЫЙ состав. ФИО условные и закреплены под роли/компании из деловой
// программы (tech-pravo.ru/conference). Финальный состав (35+) и тайм-слоты
// публикуются и обновляются на странице конференции.
// ============================================================================

// Реальные спикеры — 1:1 с опубликованными на сайте (pravo.speakers, is_published).
// ID сохранены прежними, чтобы не порвать 18 связей session_speakers; данные
// (имя/роль/компания/био/тема/трек) обновлены под реальных людей + добавлен
// хедлайнер Шрайбман. Синхронизация — разовый снимок; при новых одобренных
// спикерах на сайте прогнать ETL повторно.
export const SPEAKERS: Speaker[] = [
  {
    id: 'sp_shraibman',
    name: 'Шрайбман Михаил Борисович',
    role: 'Генеральный директор',
    company: 'OSMI IT',
    bio: 'Самый молодой член правления РУССОФТ и участник АЛРИИ. Предприниматель и визионер в области искусственного интеллекта, Web3 и цифровой трансформации бизнеса. Запускал технологические продукты для корпоративных заказчиков. Выпускник МФТИ по специальности «Технологическое предпринимательство».',
    avatarLetter: 'ШМ',
    topic: 'От пилота к рабочему контуру: как ИИ-агенты автоматизируют операционные и юридические процессы бизнеса',
    trackId: 't_ai',
    interestIds: ['ai_law', 'llm', 'automation'],
  },
  {
    id: 'sp_sokolov',
    name: 'Сизов Дмитрий Александрович',
    role: 'CEO',
    company: 'LegalTech Solutions',
    bio: 'Специалист по автоматизации юридических процессов и AI-инструментам.',
    avatarLetter: 'СД',
    topic: 'ИИ-ассистент юриста: от теории к практике',
    trackId: 't_legaltech',
    interestIds: ['legaltech', 'ai_law', 'llm'],
  },
  {
    id: 'sp_sizov',
    name: 'Артин Василий Алексеевич',
    role: 'Арбитражный управляющий',
    company: 'СРО «Дело»',
    bio: 'Практикующий арбитражный управляющий, автор методических материалов по банкротству.',
    avatarLetter: 'АВ',
    topic: 'Цифровая трансформация работы арбитражного управляющего',
    trackId: 't_automation',
    interestIds: ['bfl', 'arbitrage', 'automation'],
  },
  {
    id: 'sp_lebedeva',
    name: 'Путин Дмитрий Алексеевич',
    role: 'Руководитель направления',
    company: 'ПравоТех',
    bio: 'Эксперт по масштабированию юридических практик и маркетингу.',
    avatarLetter: 'ПД',
    topic: 'Как вырастить юридическую практику с 0 до 100 дел в месяц',
    trackId: 't_growth',
    interestIds: ['growth', 'scaling', 'sales'],
  },
  {
    id: 'sp_artemev',
    name: 'Шабалин Егор Александрович',
    role: 'CTO',
    company: 'NeuroPravo',
    bio: 'Разработчик AI-решений для юридической отрасли.',
    avatarLetter: 'ШЕ',
    topic: 'NeuroPravo Bot: архитектура юридического AI-ассистента',
    trackId: 't_ai',
    interestIds: ['ai_law', 'llm', 'automation'],
  },
];

// ============================================================================
// SECTION: SESSIONS — 2-дневная программа (1:1 с деловой программой сайта)
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
    location: hall?.name ?? 'Зал А',
    speakerName: firstSpeaker?.name ?? '—',
    track: track?.name ?? 'Общее',
    day: day?.label ?? '—',
  };
}

// END_BLOCK_BUILD_SESSIONS

export const SESSIONS: Session[] = [
  // ===== DAY 1: 25 сентября (пятница) =====
  buildSession({
    id: 's_d1_reg',
    title: 'Регистрация участников, welcome-кофе',
    description: 'Регистрация, выдача бейджей и приветственный кофе в фойе.',
    startTime: '09:00', endTime: '10:00',
    format: 'break', hallId: 'foyer', dayId: 'd1',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_open',
    title: 'Торжественное открытие конференции',
    description: 'Приветственное слово организаторов и обзор деловой программы двух дней.',
    startTime: '10:00', endTime: '10:30',
    format: 'opening', hallId: 'zal_a', dayId: 'd1',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_bfl_market',
    title: 'Рынок банкротства физлиц 2026: тренды, цифры, прогнозы',
    description: 'Обзорный keynote по рынку БФЛ: динамика процедур, ключевые цифры года и прогнозы на 2026.',
    startTime: '10:30', endTime: '11:30',
    format: 'keynote', hallId: 'zal_a', dayId: 'd1',
    trackId: 't_bfl', speakerIds: ['sp_sizov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_coffee1',
    title: 'Кофе-брейк, нетворкинг',
    description: 'Перерыв, кофе и общение в фойе.',
    startTime: '11:30', endTime: '12:00',
    format: 'break', hallId: 'foyer', dayId: 'd1',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_bfl_practice',
    title: 'Судебная практика и оспаривание сделок в БФЛ',
    description: 'Свежая судебная практика по банкротству физлиц, разбор кейсов оспаривания сделок.',
    startTime: '12:00', endTime: '13:00',
    format: 'talk', hallId: 'zal_a', dayId: 'd1',
    trackId: 't_bfl', speakerIds: ['sp_sizov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_llm',
    title: 'LLM-ассистенты для юристов: возможности и риски',
    description: 'Где большие языковые модели реально помогают юристу, а где несут риски. Практические примеры и ограничения.',
    startTime: '12:00', endTime: '13:00',
    format: 'talk', hallId: 'zal_b', dayId: 'd1',
    trackId: 't_ai', speakerIds: ['sp_sokolov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_lunch',
    title: 'Обед',
    description: 'Обед в ресторане БЦ «Красные Ворота».',
    startTime: '13:00', endTime: '14:00',
    format: 'break', hallId: 'restaurant', dayId: 'd1',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_bfl_scale',
    title: 'Масштабирование БФЛ-практики до федерального уровня',
    description: 'Как вырастить практику банкротства физлиц из локальной в федеральную: юниты, франшиза, регионы.',
    startTime: '14:00', endTime: '15:00',
    format: 'talk', hallId: 'zal_a', dayId: 'd1',
    trackId: 't_bfl', speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_crm',
    title: 'CRM и документооборот в юридической компании',
    description: 'Как выстроить CRM и электронный документооборот в юркомпании: процессы, инструменты, метрики.',
    startTime: '14:00', endTime: '15:00',
    format: 'talk', hallId: 'zal_v', dayId: 'd1',
    trackId: 't_automation', speakerIds: ['sp_lebedeva'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_coffee2',
    title: 'Кофе-брейк',
    description: 'Перерыв и кофе в фойе.',
    startTime: '15:00', endTime: '15:30',
    format: 'break', hallId: 'foyer', dayId: 'd1',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_predictive',
    title: 'Предиктивная аналитика судебных решений',
    description: 'ИИ-модели предсказания исхода дел: как это работает, где применимо и каким данным можно доверять.',
    startTime: '15:30', endTime: '16:30',
    format: 'talk', hallId: 'zal_a', dayId: 'd1',
    trackId: 't_ai', speakerIds: ['sp_artemev'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_legaltech',
    title: 'Цифровые платформы и сервисы Legal Tech',
    description: 'Обзор цифровых платформ и сервисов Legal Tech для юрбизнеса: что уже работает на рынке.',
    startTime: '15:30', endTime: '16:30',
    format: 'talk', hallId: 'zal_b', dayId: 'd1',
    trackId: 't_legaltech', speakerIds: ['sp_sokolov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_panel',
    title: 'Панельная дискуссия: ИИ и будущее юридической профессии',
    description: 'Открытая дискуссия спикеров конференции: как ИИ меняет работу юриста, риски, регуляция и тренды.',
    startTime: '16:30', endTime: '17:30',
    format: 'panel', hallId: 'zal_a', dayId: 'd1',
    trackId: null, speakerIds: ['sp_sokolov', 'sp_artemev'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_networking',
    title: 'Вечерний нетворкинг',
    description: 'Неформальное общение участников в лаунж-зоне по итогам первого дня.',
    startTime: '17:30', endTime: '18:30',
    format: 'closing', hallId: 'lounge', dayId: 'd1',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),

  // ===== DAY 2: 26 сентября (суббота) =====
  buildSession({
    id: 's_d2_pdn',
    title: 'Защита персональных данных и compliance (152-ФЗ)',
    description: 'Практика соблюдения 152-ФЗ в юркомпании: обработка ПДн, согласия, риски и проверки РКН.',
    startTime: '10:00', endTime: '11:00',
    format: 'talk', hallId: 'zal_a', dayId: 'd2',
    trackId: 't_data', speakerIds: ['sp_lebedeva'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_docs_ws',
    title: 'Автоматизация подготовки документов БФЛ (мастер-класс)',
    description: 'Практический мастер-класс: сборка и автогенерация пакета документов для процедуры БФЛ.',
    startTime: '10:00', endTime: '11:00',
    format: 'workshop', hallId: 'zal_v', dayId: 'd2',
    trackId: 't_automation', speakerIds: ['sp_artemev'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_management',
    title: 'Управление командой, продажи и операционка практики',
    description: 'Как устроить операционку юрпрактики: найм и управление командой, продажи услуг, метрики.',
    startTime: '11:00', endTime: '12:00',
    format: 'talk', hallId: 'zal_b', dayId: 'd2',
    trackId: 't_growth', speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_coffee1',
    title: 'Кофе-брейк',
    description: 'Перерыв и кофе в фойе.',
    startTime: '12:00', endTime: '12:30',
    format: 'break', hallId: 'foyer', dayId: 'd2',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_legaltech_cases',
    title: 'Кейсы лидеров рынка Legal Tech',
    description: 'Разбор реальных кейсов внедрения Legal Tech у лидеров рынка: что сработало, а что нет.',
    startTime: '12:30', endTime: '13:30',
    format: 'talk', hallId: 'zal_a', dayId: 'd2',
    trackId: 't_legaltech', speakerIds: ['sp_sokolov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_lunch',
    title: 'Обед',
    description: 'Обед в ресторане БЦ «Красные Ворота».',
    startTime: '13:30', endTime: '14:30',
    format: 'break', hallId: 'restaurant', dayId: 'd2',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_ai_demo',
    title: 'Демо промышленных ИИ-ассистентов для юрпрактики',
    description: 'Живое демо промышленных ИИ-ассистентов для юристов: сценарии, интеграции, эффект.',
    startTime: '14:30', endTime: '15:30',
    format: 'talk', hallId: 'zal_a', dayId: 'd2',
    trackId: 't_ai', speakerIds: ['sp_artemev'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_growth',
    title: 'Рост и масштабирование: от первого клиента до федерального масштаба',
    description: 'Путь юрпрактики от первого клиента до федеральной сети: этапы, ошибки, точки роста.',
    startTime: '15:30', endTime: '16:30',
    format: 'talk', hallId: 'zal_b', dayId: 'd2',
    trackId: 't_growth', speakerIds: ['sp_lebedeva'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_close',
    title: 'Награждение БФЛ-практик года. Закрытие конференции',
    description: 'Награждение лучших БФЛ-практик года, финальное слово организаторов и общая фотография.',
    startTime: '16:30', endTime: '17:00',
    format: 'closing', hallId: 'zal_a', dayId: 'd2',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_afterparty',
    title: 'After-party',
    description: 'Неформальное завершение конференции в лаунж-зоне.',
    startTime: '17:00', endTime: '18:00',
    format: 'closing', hallId: 'lounge', dayId: 'd2',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
];

// ============================================================================
// SECTION: PARTNERS
// ============================================================================

export const PARTNERS: Partner[] = [];


// ============================================================================
// SECTION: NEWS
// ============================================================================

export const NEWS: NewsItem[] = [];


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
