// FILE: src/lib/validation.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: zod-схемы для валидации тел запросов на mutating-endpoints.
//          Заменяет ad-hoc String(req.body?.x) парсинг на типизированную
//          контрактную валидацию с явными error-сообщениями.
// SCOPE: Только схемы. Express middleware для применения схем — в server.ts
//        (validateBody helper).
// INPUT: req.body (unknown).
// OUTPUT: Типизированный объект или ZodError.
// KEYWORDS: DOMAIN(8): InputValidation; CONCEPT(9): SchemaValidation; TECH(8): zod
// LINKS: USED_BY(10): server.ts (применение через middleware)
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему zod, а не yup/joi/typescript-классы?
// A: zod даёт типы из схемы одной строкой `z.infer<typeof schema>` — никаких
//    дублирующих interface'ов. Лёгкий (~12KB gzip), нулевые зависимости,
//    активная поддержка.
//
// Q: Почему не валидируем GET-запросы?
// A: GET с параметрами в URL — валидируется отдельно (req.params/req.query
//    уже строки, нужны только parseInt/range checks). Mutating endpoints
//    принимают JSON body — здесь риск инъекций и неконсистентных типов выше.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v1.0.0 — Первичные схемы для auth/register, auth/login,
//                       auth/me PATCH, /me/interests PUT, /posts POST,
//                       /posts/:id/comment, /statuses POST, /ai/chat POST.]
// END_CHANGE_SUMMARY

import { z } from 'zod';

// Email — нормализуем в lower case через .transform; .email() даёт RFC-валидацию.
const emailSchema = z.string().trim().toLowerCase().email('Некорректный email');

// Пароль — минимум 8 (повышено с 6 после red-team, который показал что
// 6-символьный пароль + per-IP rate-limit обходимый = брутфорс за минуту).
const passwordSchema = z.string().min(8, 'Пароль должен быть не менее 8 символов').max(128);

// Имя — 1..80 символов, .trim для удаления хвостовых пробелов.
const nameSchema = z.string().trim().min(1, 'Укажите имя').max(80);

export const authRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

export const authLoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// Phone — нормализуем к виду +<digits>. Принимаем любой формат
// '+7 (912) 345-67-89', '8-912-345-67-89', '+79123456789' и т.п.,
// убираем всё кроме цифр и ведущего +. Российские номера с ведущей 8
// нормализуем к +7. Пустая или неполная строка (<10 значимых цифр) → null
// — НЕ ошибка валидации, чтобы PATCH /auth/me с другим полем не падал.
const phoneSchema = z.string().trim().max(32)
  .transform((raw) => {
    if (!raw) return null;
    const onlyDigits = raw.replace(/\D/g, '');
    if (onlyDigits.length < 10) return null;
    let d = onlyDigits;
    if (d.startsWith('8') && d.length === 11) d = `7${d.slice(1)}`;
    if (d.length === 10) d = `7${d}`; // мобильные без кода страны
    return `+${d}`;
  })
  .refine((v) => v === null || /^\+\d{10,15}$/.test(v), {
    message: 'Некорректный номер телефона',
  });

export const authMePatchSchema = z.object({
  name: nameSchema.optional(),
  bio: z.string().max(500).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
});

// Бизнес-инвариант onboarding: 3..10 направлений. Раньше был только max(10)
// — через curl можно было записать 1 интерес, фронт-recommended ломался.
export const meInterestsPutSchema = z.object({
  interestIds: z.array(z.string().min(1).max(64))
    .min(3, 'Выбери минимум 3 направления')
    .max(10, 'Максимум 10 направлений'),
});

// type ограничиваем enum, чтобы фронт не получал произвольные строки.
export const postCreateSchema = z.object({
  type: z.enum(['text', 'photo', 'video']).optional().default('text'),
  url: z.string().max(2048).optional().default(''),
  text: z.string().max(2000).optional().default(''),
});

export const commentCreateSchema = z.object({
  text: z.string().trim().min(1, 'Комментарий пустой').max(1000),
});

export const statusCreateSchema = z.object({
  type: z.enum(['text', 'photo', 'video']).optional().default('text'),
  url: z.string().max(2048).optional().default(''),
  text: z.string().max(500).optional().default(''),
});

// Direct messages (Chat → Личные).
// Сообщение должно содержать text ИЛИ media (или оба). Чистая отправка
// «пустого» сообщения без вложения отвергается.
export const dmSendSchema = z.object({
  toUserId: z.string().min(1).max(64),
  text: z.string().trim().max(2000).optional().default(''),
  mediaUrl: z.string().max(512).optional(),
  mediaType: z.enum(['image', 'audio', 'video']).optional(),
}).refine((d) => (d.text && d.text.length > 0) || (d.mediaUrl && d.mediaType), {
  message: 'Сообщение пустое',
});

// Forgot-password (см. server.ts /auth/forgot-password/*).
export const forgotPasswordStartSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordVerifySchema = z.object({
  token: z.string().min(8).max(128),
  newPassword: passwordSchema,
});

export const aiChatSchema = z.object({
  message: z.string().trim().min(1, 'message_required').max(2000),
  context: z.string().max(20000).optional().default(''),
});

export type AuthRegisterBody = z.infer<typeof authRegisterSchema>;
export type AuthLoginBody = z.infer<typeof authLoginSchema>;
export type AuthMePatchBody = z.infer<typeof authMePatchSchema>;
export type MeInterestsPutBody = z.infer<typeof meInterestsPutSchema>;
export type PostCreateBody = z.infer<typeof postCreateSchema>;
export type CommentCreateBody = z.infer<typeof commentCreateSchema>;
export type StatusCreateBody = z.infer<typeof statusCreateSchema>;
export type AiChatBody = z.infer<typeof aiChatSchema>;
export type ForgotPasswordStartBody = z.infer<typeof forgotPasswordStartSchema>;
export type ForgotPasswordVerifyBody = z.infer<typeof forgotPasswordVerifySchema>;
export type DmSendBody = z.infer<typeof dmSendSchema>;
