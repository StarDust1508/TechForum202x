import { normalizePublicSpeakers, type PublicSpeaker } from './publicSpeakers';
import { IVAN_BONDARENKO_SPEAKER_ID } from './publicSessions';

// Programme-only identity from conference-program-2026.json and
// conference-speaker-registry-v6.json. The registry explicitly records
// published=false and public_card_uuid=null until a real photo is verified,
// so this card uses initials and is not injected into the 33-card public list.
const PROGRAMME_ONLY_SPEAKERS = normalizePublicSpeakers([{
  id: IVAN_BONDARENKO_SPEAKER_ID,
  name: 'Иван Бондаренко',
  role: 'Исследователь и разработчик русскоязычных AI-моделей',
  company: 'НГУ / Dialoger',
  bio: '',
  avatarLetter: 'ИБ',
  avatarUrl: null,
  topic: 'Локальная модель + графовый RAG: проверяемый ИИ-контур без сверхмощной инфраструктуры',
  trackId: 't_ai',
  interestIds: [],
}]);

export function getCanonicalProgrammeSpeaker(speakerId: string): PublicSpeaker | undefined {
  return PROGRAMME_ONLY_SPEAKERS.find((speaker) => speaker.id === speakerId);
}

export function getCanonicalProgrammeSpeakers(): PublicSpeaker[] {
  return [...PROGRAMME_ONLY_SPEAKERS];
}
