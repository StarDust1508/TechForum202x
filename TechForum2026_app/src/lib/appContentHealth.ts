type Session = { id: string; title: string; dayId: string; hallId: string | null; trackId: string | null; startTime: string; endTime: string; format: string; isPublished: boolean };
type Speaker = { id: string; name: string; avatarUrl?: string | null };
type Link = { sessionId: string; speakerId: string };
export function contentIssues(data: { sessions: Session[]; speakers: Speaker[]; days: { id: string }[]; halls: { id: string }[]; tracks: { id: string }[]; links: Link[]; moderators: Link[] }): string[] {
  const issues: string[] = [];
  const ids = (values: { id: string }[]) => new Set(values.map(x => x.id));
  const days = ids(data.days), halls = ids(data.halls), tracks = ids(data.tracks), speakers = ids(data.speakers), sessions = ids(data.sessions);
  const validTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  for (const s of data.sessions) {
    if (!days.has(s.dayId)) issues.push(`Сессия «${s.title}»: день не найден.`);
    if (!s.hallId || !halls.has(s.hallId)) issues.push(`Сессия «${s.title}»: зал не выбран или не найден.`);
    const generalEvent = /перерыв|регистрац|открыти|закрыти/i.test(s.format);
    if ((s.trackId && !tracks.has(s.trackId)) || (!s.trackId && !generalEvent)) issues.push(`Сессия «${s.title}»: направление не выбрано или не найдено.`);
    if (!validTime(s.startTime) || !validTime(s.endTime) || s.startTime >= s.endTime) issues.push(`Сессия «${s.title}»: проверьте время начала и окончания.`);
    if (s.isPublished && /доклад|демо|дискусс|мастер|воркшоп|лекци/i.test(s.format) && !data.links.some(l => l.sessionId === s.id)) issues.push(`Опубликовано без спикера: «${s.title}».`);
  }
  for (const l of [...data.links, ...data.moderators]) if (!speakers.has(l.speakerId) || !sessions.has(l.sessionId)) issues.push(`Связь программы ${l.sessionId} → ${l.speakerId}: запись не найдена.`);
  for (const s of data.speakers) if (!s.avatarUrl?.trim()) issues.push(`Спикер «${s.name}»: фотография не указана.`);
  const publicSessions = data.sessions.filter(s => s.isPublished && validTime(s.startTime) && validTime(s.endTime));
  for (let i = 0; i < publicSessions.length; i++) for (let j = i + 1; j < publicSessions.length; j++) {
    const a = publicSessions[i], b = publicSessions[j];
    if (a.dayId === b.dayId && a.hallId && a.hallId === b.hallId && a.startTime < b.endTime && b.startTime < a.endTime) issues.push(`Пересечение в одном зале: «${a.title}» и «${b.title}».`);
  }
  return [...new Set(issues)];
}
