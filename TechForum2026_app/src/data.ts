export interface Speaker {
  id: string;
  name: string;
  role: string;
  company: string;
  bio: string;
  avatarLetter: string;
  topic?: string;
}

export interface Session {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  speakerName: string;
  track: string;
  status: 'Soon' | 'Live' | 'Ended' | 'Moved';
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

export const SPEAKERS: Speaker[] = [
  {
    id: 'sp1',
    name: 'Дмитрий Волков',
    role: 'Директор по ИИ',
    company: 'TechCorp Russia',
    bio: 'Экспертер в области корпоративного ИИ и масштабирования нейросетевых решений.',
    avatarLetter: 'ДВ',
    topic: 'Будущее ИИ в бизнесе',
  },
  {
    id: 'sp2',
    name: 'Анна Сорокина',
    role: 'Директор по информбезопасности',
    company: 'CyberDefend',
    bio: 'Специалист по квантовой криптографии и защите критической инфраструктуры.',
    avatarLetter: 'АС',
    topic: 'Квантовая защита данных',
  },
  {
    id: 'sp3',
    name: 'Иван Черных',
    role: 'Генеральный директор и соучредитель',
    company: 'ProductStack',
    bio: 'Создатель продуктов с оценкой более $1B.',
    avatarLetter: 'ИЧ',
    topic: 'Рост через продукт',
  },
];

export const SESSIONS: Session[] = [
  {
    id: 's1',
    title: 'ИИ как новая операционная система бизнеса',
    description: 'Как искусственный интеллект трансформирует корпоративные процессы и создает новые модели ценности.',
    startTime: '10:00',
    endTime: '11:00',
    location: 'Главная сцена',
    speakerName: 'Дмитрий Волков',
    track: 'Искусственный интеллект',
    status: 'Soon',
    day: '15 мая',
  },
  {
    id: 's2',
    title: 'Кибербезопасность в эпоху квантовых угроз',
    description: 'Квантовые компьютеры изменят ландшафт угроз. Как готовить защиту уже сейчас.',
    startTime: '11:30',
    endTime: '12:30',
    location: 'Зал А',
    speakerName: 'Анна Сорокина',
    track: 'Безопасность',
    status: 'Soon',
    day: '15 мая',
  },
  {
    id: 's3',
    title: 'Product-led growth: от идеи до $1B ARR',
    description: 'История роста двух единорогов через продуктовое мышление.',
    startTime: '14:00',
    endTime: '15:00',
    location: 'Зал Б',
    speakerName: 'Иван Черных',
    track: 'Продуктовый менеджмент',
    status: 'Live',
    day: '16 мая',
  },
];

export const NEWS: NewsItem[] = [
  {
    id: 'n1',
    type: 'Важно',
    title: 'Регистрация открыта: более 2000 участников',
    content: 'Мы рады сообщить, что ТехФорум 2026 побил рекорд по числу зарегистрированных участников.',
    time: '17:05',
    isCritical: true,
    category: 'Форум',
  },
  {
    id: 'n2',
    type: 'Обновление',
    title: 'Новый спикер: Михаил Орлов из AI Lab',
    content: 'Подтверждаем участие Research Director компании AI Lab Moscow.',
    time: '16:40',
    isCritical: false,
    category: 'Спикеры',
  }
];
