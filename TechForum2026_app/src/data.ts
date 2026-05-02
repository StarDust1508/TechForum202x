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
// LAST_CHANGE: [v2.0.0 - Полная переработка: 6 треков, 3 зала, 2-дневная программа
//                       Саратова (20-21 мая 2026), 15 реальных публичных РФ-спикеров,
//                       8 партнёров, типы расширены ID-полями для устранения
//                       рассинхрона фильтров. Backwards-compatible поля
//                       (track, location, day) сохранены как computed.]
// PREV_CHANGE_SUMMARY: [v1.0.0 - 3 хардкодных сессии, рассинхрон Cyrillic/Latin в названиях залов]
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
  content: string;
  time: string;
  isCritical: boolean;
  category?: string;
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
  name: 'TechForum 2026',
  location: 'Технополис «Инновация»',
  city: 'Саратов',
  timezone: 'Europe/Saratov',
  organizer: 'Bubble Group',
  organizerEmail: 'info@techforum.ru',
  url: 'https://techforum.ru',
};

// ============================================================================
// SECTION: TRACKS — с цветовой кодировкой под бирюзовый фирменный стиль
// ============================================================================

export const TRACKS: Track[] = [
  { id: 'ai',       name: 'AI / ML',                color: '#a855f7', shortLabel: 'AI'   },
  { id: 'backend',  name: 'Backend & Architecture', color: '#3b82f6', shortLabel: 'BE'   },
  { id: 'frontend', name: 'Frontend & Mobile',      color: '#5eead4', shortLabel: 'FE'   },
  { id: 'devops',   name: 'DevOps & Cloud',         color: '#f59e0b', shortLabel: 'OPS'  },
  { id: 'data',     name: 'Data Engineering',       color: '#10b981', shortLabel: 'DATA' },
  { id: 'product',  name: 'Product & Career',       color: '#ec4899', shortLabel: 'PROD' },
];

// ============================================================================
// SECTION: HALLS
// ============================================================================

export const HALLS: Hall[] = [
  { id: 'main',  name: 'Главный зал', capacity: 600 },
  { id: 'alpha', name: 'Альфа',       capacity: 220 },
  { id: 'beta',  name: 'Бета',        capacity: 180 },
];

// ============================================================================
// SECTION: DAYS
// ============================================================================

export const DAYS: Day[] = [
  { id: 'd1', date: '2026-05-20', label: '20 мая', weekday: 'Среда'   },
  { id: 'd2', date: '2026-05-21', label: '21 мая', weekday: 'Четверг' },
];

// ============================================================================
// SECTION: SPEAKERS
// ============================================================================
// ПРИНЦИП: реальные публичные tech-figures РФ-сцены, реальные актуальные роли,
// темы из их публично известной экспертизы (без выдумок).
// ============================================================================

export const SPEAKERS: Speaker[] = [
  {
    id: 'sp_bunin',
    name: 'Олег Бунин',
    role: 'Основатель',
    company: 'Ontico (Highload++)',
    bio: 'Основатель компании Онтико, организатор главной российской конференции по высоконагруженным системам Highload++ с 2007 года.',
    avatarLetter: 'ОБ',
    topic: 'Архитектура высоконагруженных систем: уроки 15 лет Highload++',
    trackId: 'backend',
  },
  {
    id: 'sp_kraynov',
    name: 'Александр Крайнов',
    role: 'Директор по развитию AI',
    company: 'Яндекс',
    bio: 'Возглавляет направление AI в Яндексе, отвечает за внедрение генеративных моделей в продукты компании.',
    avatarLetter: 'АК',
    topic: 'Генеративные модели в продуктах массового сегмента',
    trackId: 'ai',
  },
  {
    id: 'sp_bilenko',
    name: 'Михаил Биленко',
    role: 'Руководитель',
    company: 'Yandex Research',
    bio: 'Руководит исследовательским подразделением Яндекса. Ранее — Microsoft Research, профессор машинного обучения.',
    avatarLetter: 'МБ',
    topic: 'Research-направления: куда движется индустрия AI',
    trackId: 'ai',
  },
  {
    id: 'sp_sebrant',
    name: 'Андрей Себрант',
    role: 'Директор по стратегическому маркетингу',
    company: 'Яндекс',
    bio: 'Один из самых цитируемых российских tech-евангелистов. Темы: цифровая трансформация, тренды индустрии.',
    avatarLetter: 'АС',
    topic: 'Стратегия tech-продуктов: уроки Яндекса',
    trackId: 'product',
  },
  {
    id: 'sp_shipilev',
    name: 'Алексей Шипилев',
    role: 'Performance Engineer',
    company: 'BellSoft',
    bio: 'Один из ведущих мировых экспертов по производительности JVM. Автор курса по микро-бенчмаркам и JIT-компиляции.',
    avatarLetter: 'АШ',
    topic: 'JIT-компиляция и performance JVM в 2026',
    trackId: 'backend',
  },
  {
    id: 'sp_soshnikov',
    name: 'Дмитрий Сошников',
    role: 'AI Lead, преподаватель',
    company: 'НИУ ВШЭ / Microsoft',
    bio: 'AI Lead, преподаватель машинного обучения в ВШЭ и МАИ. Эксперт по облачным AI-платформам.',
    avatarLetter: 'ДС',
    topic: 'AI Copilot-инструменты в инженерных командах',
    trackId: 'ai',
  },
  {
    id: 'sp_petrov',
    name: 'Григорий Петров',
    role: 'DevRel-эксперт, основатель Moscow Python',
    company: 'Independent',
    bio: 'Известный российский DevRel, основатель сообщества Moscow Python, автор десятков докладов по построению инженерных команд.',
    avatarLetter: 'ГП',
    topic: 'DevRel в технических командах',
    trackId: 'product',
  },
  {
    id: 'sp_prokopov',
    name: 'Никита Прокопов',
    role: 'Инженер, автор Tonsky.me',
    company: 'Independent',
    bio: 'Автор популярного блога Tonsky.me, разработчик инструментов для Clojure-сообщества.',
    avatarLetter: 'НП',
    topic: 'Инструменты разработчика: что меняется к 2026',
    trackId: 'frontend',
  },
  {
    id: 'sp_sitnik',
    name: 'Андрей Ситник',
    role: 'Frontend-инженер',
    company: 'Evil Martians',
    bio: 'Создатель PostCSS и Autoprefixer, входит в Evil Martians. Один из самых известных российских front-end open-source разработчиков.',
    avatarLetter: 'АС',
    topic: 'Современный фронтенд-tooling: PostCSS, Lightning CSS и далее',
    trackId: 'frontend',
  },
  {
    id: 'sp_burtsev',
    name: 'Михаил Бурцев',
    role: 'Руководитель направления',
    company: 'AIRI',
    bio: 'Создатель проекта DeepPavlov. Сейчас руководит направлением фундаментальных исследований AI в институте AIRI.',
    avatarLetter: 'МБ',
    topic: 'Open-source диалоговые системы и фундаментальные исследования AI',
    trackId: 'ai',
  },
  {
    id: 'sp_oseledets',
    name: 'Иван Оселедец',
    role: 'Профессор, директор',
    company: 'AIRI / Сколтех',
    bio: 'Один из ведущих российских специалистов по тензорным методам и численной линейной алгебре в ML.',
    avatarLetter: 'ИО',
    topic: 'Тензорные методы в современном ML',
    trackId: 'ai',
  },
  {
    id: 'sp_vetrov',
    name: 'Дмитрий Ветров',
    role: 'Профессор',
    company: 'Constructor University',
    bio: 'Профессор, лидер российской школы байесовского машинного обучения. Преподавал в ВШЭ, сейчас в Constructor University.',
    avatarLetter: 'ДВ',
    topic: 'Байесовский подход в современных нейросетях',
    trackId: 'ai',
  },
  {
    id: 'sp_illarionov',
    name: 'Олег Илларионов',
    role: 'Технический директор',
    company: 'VK Calls',
    bio: 'Один из создателей и сооснователей ВКонтакте, сейчас руководит технической частью VK Calls.',
    avatarLetter: 'ОИ',
    topic: 'WebRTC и инфраструктура VK Calls',
    trackId: 'backend',
  },
  {
    id: 'sp_kalinin',
    name: 'Александр Калинин',
    role: 'Архитектор платформы',
    company: 'Авито',
    bio: 'Отвечает за платформенную архитектуру в Авито — одном из крупнейших классифайдов мира.',
    avatarLetter: 'АК',
    topic: 'Распределённые системы: эволюция платформы Авито',
    trackId: 'data',
  },
  {
    id: 'sp_ivanov',
    name: 'Денис Иванов',
    role: 'Лид платформенных команд',
    company: 'Т-Банк',
    bio: 'Руководит платформенными командами в Т-Банке. Эксперт по построению инженерных платформ и developer experience.',
    avatarLetter: 'ДИ',
    topic: 'Платформенный подход и developer experience',
    trackId: 'devops',
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
  // ===== DAY 1: 20 мая (среда) =====
  buildSession({
    id: 's_d1_open',
    title: 'Открытие TechForum 2026',
    description: 'Вступительное слово организаторов и обзор программы двух дней.',
    startTime: '10:00', endTime: '10:30',
    format: 'opening', hallId: 'main', dayId: 'd1',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_keynote_bunin',
    title: 'Архитектура высоконагруженных систем',
    description: 'Открывающий keynote: уроки 15 лет проведения Highload++ — что изменилось в архитектуре highload-систем и куда движется индустрия.',
    startTime: '10:30', endTime: '11:30',
    format: 'keynote', hallId: 'main', dayId: 'd1',
    trackId: 'backend', speakerIds: ['sp_bunin'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_kraynov',
    title: 'Генеративные модели в продуктах массового сегмента',
    description: 'Как Яндекс встраивает LLM в Поиск, Алису и B2C-сервисы. Архитектурные паттерны и ограничения.',
    startTime: '11:45', endTime: '12:30',
    format: 'talk', hallId: 'main', dayId: 'd1',
    trackId: 'ai', speakerIds: ['sp_kraynov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_shipilev',
    title: 'JIT-компиляция и performance JVM в 2026',
    description: 'Глубокий разбор изменений в HotSpot JIT, влияние новых поколений GC и практические оптимизации для production.',
    startTime: '11:45', endTime: '12:30',
    format: 'talk', hallId: 'alpha', dayId: 'd1',
    trackId: 'backend', speakerIds: ['sp_shipilev'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_sitnik',
    title: 'Современный фронтенд-tooling',
    description: 'PostCSS, Lightning CSS, новая волна build-инструментов и куда движется фронтенд-инфраструктура.',
    startTime: '11:45', endTime: '12:30',
    format: 'talk', hallId: 'beta', dayId: 'd1',
    trackId: 'frontend', speakerIds: ['sp_sitnik'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_lunch',
    title: 'Обед',
    description: 'Кофе, обед и нетворкинг в фойе.',
    startTime: '12:30', endTime: '13:30',
    format: 'break', hallId: null, dayId: 'd1',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_bilenko',
    title: 'Research-направления: куда движется индустрия',
    description: 'Обзор актуальных направлений Yandex Research: что считается фронтиром в 2026.',
    startTime: '13:30', endTime: '14:15',
    format: 'talk', hallId: 'main', dayId: 'd1',
    trackId: 'ai', speakerIds: ['sp_bilenko'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_illarionov',
    title: 'WebRTC и инфраструктура VK Calls',
    description: 'Как устроена инфраструктура видеозвонков под нагрузкой миллионов одновременных сессий.',
    startTime: '13:30', endTime: '14:15',
    format: 'talk', hallId: 'alpha', dayId: 'd1',
    trackId: 'backend', speakerIds: ['sp_illarionov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_prokopov',
    title: 'Инструменты разработчика: что меняется к 2026',
    description: 'Эссе о том, какими становятся IDE, build-системы и dev-experience в эру AI-ассистентов.',
    startTime: '13:30', endTime: '14:15',
    format: 'talk', hallId: 'beta', dayId: 'd1',
    trackId: 'frontend', speakerIds: ['sp_prokopov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_soshnikov',
    title: 'AI Copilot-инструменты в инженерных командах',
    description: 'Опыт внедрения AI-ассистентов в реальных инженерных командах — что работает, что нет, как мерить эффект.',
    startTime: '14:30', endTime: '15:15',
    format: 'talk', hallId: 'main', dayId: 'd1',
    trackId: 'ai', speakerIds: ['sp_soshnikov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_kalinin',
    title: 'Распределённые системы Авито: эволюция платформы',
    description: 'Как развивалась платформа Авито от монолита к распределённой архитектуре — болезненные уроки и неочевидные решения.',
    startTime: '14:30', endTime: '15:15',
    format: 'talk', hallId: 'alpha', dayId: 'd1',
    trackId: 'data', speakerIds: ['sp_kalinin'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_petrov',
    title: 'DevRel в технических командах',
    description: 'Что такое DevRel, чем он отличается от маркетинга и как его вписать в инженерную организацию.',
    startTime: '14:30', endTime: '15:15',
    format: 'talk', hallId: 'beta', dayId: 'd1',
    trackId: 'product', speakerIds: ['sp_petrov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_burtsev_ws',
    title: 'Workshop: Open-source диалоговые системы',
    description: 'Практический воркшоп по построению open-source диалоговых систем на основе LLM и RAG.',
    startTime: '15:30', endTime: '16:30',
    format: 'workshop', hallId: 'alpha', dayId: 'd1',
    trackId: 'ai', speakerIds: ['sp_burtsev'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_ivanov_ws',
    title: 'Workshop: Платформенный подход в Т-Банк',
    description: 'Как устроены платформенные команды и developer experience в крупном финтехе.',
    startTime: '15:30', endTime: '16:30',
    format: 'workshop', hallId: 'beta', dayId: 'd1',
    trackId: 'devops', speakerIds: ['sp_ivanov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_panel',
    title: 'Panel: Будущее AI в индустрии',
    description: 'Открытая дискуссия с участием Яндекс, AIRI и независимых экспертов: hype vs production, регуляция, риски, тренды.',
    startTime: '16:45', endTime: '17:45',
    format: 'panel', hallId: 'main', dayId: 'd1',
    trackId: 'ai', speakerIds: ['sp_kraynov', 'sp_burtsev', 'sp_vetrov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d1_close',
    title: 'Networking первого дня',
    description: 'Афтепати в фойе. Лёгкие закуски, музыка, общение.',
    startTime: '17:45', endTime: '19:30',
    format: 'closing', hallId: null, dayId: 'd1',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),

  // ===== DAY 2: 21 мая (четверг) =====
  buildSession({
    id: 's_d2_oseledets',
    title: 'Тензорные методы в современном ML',
    description: 'Тензорные разложения как способ сжать большие модели и ускорить инференс — обзор современных подходов.',
    startTime: '10:00', endTime: '10:45',
    format: 'talk', hallId: 'main', dayId: 'd2',
    trackId: 'ai', speakerIds: ['sp_oseledets'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_sebrant',
    title: 'Стратегия tech-продуктов: уроки Яндекса',
    description: 'Как Яндекс выбирает направления продуктовых ставок и что из этого получается.',
    startTime: '10:00', endTime: '10:45',
    format: 'talk', hallId: 'alpha', dayId: 'd2',
    trackId: 'product', speakerIds: ['sp_sebrant'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_prokopov_ws',
    title: 'Workshop: Хорошие интерфейсы dev-инструментов',
    description: 'Разбор реальных кейсов: что отличает удобный dev-инструмент от неудобного.',
    startTime: '10:00', endTime: '10:45',
    format: 'workshop', hallId: 'beta', dayId: 'd2',
    trackId: 'frontend', speakerIds: ['sp_prokopov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_vetrov',
    title: 'Байесовский подход в современных нейросетях',
    description: 'Зачем сейчас байесовское ML и где оно реально нужно в production.',
    startTime: '11:00', endTime: '11:45',
    format: 'talk', hallId: 'main', dayId: 'd2',
    trackId: 'ai', speakerIds: ['sp_vetrov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_bunin_ws',
    title: 'Workshop: Архитектурные паттерны масштабирования',
    description: 'Практический разбор паттернов масштабирования: шардирование, кеширование, очереди.',
    startTime: '11:00', endTime: '11:45',
    format: 'workshop', hallId: 'alpha', dayId: 'd2',
    trackId: 'backend', speakerIds: ['sp_bunin'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_sitnik_ws',
    title: 'Workshop: Build-инфраструктура на Vite/Bun',
    description: 'Практическая настройка современной build-инфраструктуры для production-проектов.',
    startTime: '11:00', endTime: '11:45',
    format: 'workshop', hallId: 'beta', dayId: 'd2',
    trackId: 'frontend', speakerIds: ['sp_sitnik'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_kraynov_ai_agents',
    title: 'AI-агенты: где грань между hype и production',
    description: 'Что реально работает в production AI-агентов в 2026 году. Без хайпа.',
    startTime: '12:00', endTime: '12:45',
    format: 'talk', hallId: 'main', dayId: 'd2',
    trackId: 'ai', speakerIds: ['sp_kraynov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_lunch',
    title: 'Обед',
    description: 'Кофе, обед и нетворкинг.',
    startTime: '12:45', endTime: '13:45',
    format: 'break', hallId: null, dayId: 'd2',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_shipilev_ws',
    title: 'Workshop: Профилирование JVM',
    description: 'Глубокий практический воркшоп по профилированию и оптимизации JVM-приложений.',
    startTime: '13:45', endTime: '14:30',
    format: 'workshop', hallId: 'main', dayId: 'd2',
    trackId: 'backend', speakerIds: ['sp_shipilev'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_soshnikov_rag',
    title: 'Workshop: RAG и vector search',
    description: 'Практическое построение RAG-пайплайна с использованием актуальных vector-store решений.',
    startTime: '13:45', endTime: '14:30',
    format: 'workshop', hallId: 'alpha', dayId: 'd2',
    trackId: 'ai', speakerIds: ['sp_soshnikov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_petrov_ws',
    title: 'Workshop: Инженерные интервью',
    description: 'Как готовиться к техническим интервью с обеих сторон стола.',
    startTime: '13:45', endTime: '14:30',
    format: 'workshop', hallId: 'beta', dayId: 'd2',
    trackId: 'product', speakerIds: ['sp_petrov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_bilenko_ws',
    title: 'Workshop: Research-to-product',
    description: 'Как доводить research-результаты до production. Кейсы Yandex Research.',
    startTime: '14:45', endTime: '15:30',
    format: 'workshop', hallId: 'main', dayId: 'd2',
    trackId: 'ai', speakerIds: ['sp_bilenko'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_illarionov_ws',
    title: 'Workshop: WebRTC масштабирование',
    description: 'Технический воркшоп по масштабированию WebRTC-инфраструктуры на основе кейсов VK Calls.',
    startTime: '14:45', endTime: '15:30',
    format: 'workshop', hallId: 'alpha', dayId: 'd2',
    trackId: 'backend', speakerIds: ['sp_illarionov'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_kalinin_ws',
    title: 'Workshop: Event-driven архитектуры',
    description: 'Практический воркшоп по построению event-driven систем на примере опыта Авито.',
    startTime: '14:45', endTime: '15:30',
    format: 'workshop', hallId: 'beta', dayId: 'd2',
    trackId: 'data', speakerIds: ['sp_kalinin'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_closing',
    title: 'Closing keynote: Фундаментальные исследования AI в России',
    description: 'Закрывающий keynote AIRI о текущем состоянии и направлениях фундаментальных исследований AI.',
    startTime: '15:45', endTime: '16:30',
    format: 'keynote', hallId: 'main', dayId: 'd2',
    trackId: 'ai', speakerIds: ['sp_burtsev'],
    status: 'Soon',
  }),
  buildSession({
    id: 's_d2_close',
    title: 'Закрытие форума и Networking',
    description: 'Финальное слово организаторов, общая фотография, нетворкинг.',
    startTime: '16:30', endTime: '18:00',
    format: 'closing', hallId: null, dayId: 'd2',
    trackId: null, speakerIds: [],
    status: 'Soon',
  }),
];

// ============================================================================
// SECTION: PARTNERS
// ============================================================================

export const PARTNERS: Partner[] = [
  { id: 'p_yandex',  name: 'Яндекс',                                    tier: 'Генеральный',     url: 'https://yandex.ru',     description: 'Поиск, Облако, AI и десятки массовых сервисов.' },
  { id: 'p_vk',      name: 'VK',                                        tier: 'Платиновый',      url: 'https://vk.company',    description: 'Социальные платформы, медиа, коммуникации.' },
  { id: 'p_sber',    name: 'Сбер',                                      tier: 'Платиновый',      url: 'https://www.sber.ru',   description: 'Финансы, AI и экосистема цифровых сервисов.' },
  { id: 'p_tbank',   name: 'Т-Банк',                                    tier: 'Золотой',         url: 'https://www.tbank.ru',  description: 'Цифровой банк, лидер developer experience в финтехе.' },
  { id: 'p_cloudru', name: 'Cloud.ru',                                  tier: 'Золотой',         url: 'https://cloud.ru',      description: 'Облачная инфраструктура, GPU-вычисления, ML-сервисы.' },
  { id: 'p_airi',    name: 'AIRI',                                      tier: 'Технологический', url: 'https://airi.net',      description: 'Институт искусственного интеллекта.' },
  { id: 'p_skoltech',name: 'Сколтех',                                   tier: 'Технологический', url: 'https://www.skoltech.ru', description: 'Сколковский институт науки и технологий.' },
  { id: 'p_fasie',   name: 'Фонд содействия инновациям',                tier: 'Серебряный',      url: 'https://fasie.ru',      description: 'Государственная поддержка технологических стартапов.' },
];

// ============================================================================
// SECTION: NEWS
// ============================================================================

export const NEWS: NewsItem[] = [
  {
    id: 'n1',
    type: 'Важно',
    title: 'Регистрация открыта: более 2000 участников',
    content: 'Мы рады сообщить, что TechForum 2026 побил рекорд по числу зарегистрированных участников.',
    time: '17:05',
    isCritical: true,
    category: 'Форум',
  },
  {
    id: 'n2',
    type: 'Обновление',
    title: 'Подтверждён keynote Олега Бунина',
    content: 'Основатель Highload++ откроет первый день докладом об архитектуре высоконагруженных систем.',
    time: '16:40',
    isCritical: false,
    category: 'Спикеры',
  },
  {
    id: 'n3',
    type: 'Программа',
    title: 'Объявлены треки и расписание',
    content: '6 треков, 3 зала, 30 сессий за два дня. Воркшопы и keynote открыли регистрацию.',
    time: '15:20',
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
