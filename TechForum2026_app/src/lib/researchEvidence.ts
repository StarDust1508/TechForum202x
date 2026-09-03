export const RESEARCH_CONTENT_EVIDENCE = {
  verifiedAt: '2026-09-02T08:31:00Z',
  sources: ['https://tech-pravo.ru/opros', 'https://tech-pravo.ru/opros2'],
  questionCount: 12,
  estimatedMinutes: '5–7',
  participantBenefit: 'Профессиональный материал, сертификат на выбор и участие в розыгрыше после выполнения условий исследования.',
  // Evidence for bundled fallback copy; published descriptions are owned by the admin editor.
  remotelyManagedFields: ['researchLawyerMaterial', 'researchManagerMaterial'],
} as const;

export const VERIFIED_RESEARCH_BENEFIT = RESEARCH_CONTENT_EVIDENCE.participantBenefit;
