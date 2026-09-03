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

// Пароль — минимум 6 (соответствует текущей политике в localAuth fallback).
const passwordSchema = z.string().min(6, 'Пароль должен быть не менее 6 символов').max(128);

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

export const authMePatchSchema = z.object({
  name: nameSchema.optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().trim().max(32).optional(),
  email: emailSchema.optional(),
});

export const meInterestsPutSchema = z.object({
  interestIds: z.array(z.string().min(1).max(64)).max(10, 'Максимум 10 направлений'),
});

export const postCreateSchema = z.object({
  type: z.string().max(32).optional().default('text'),
  url: z.string().max(2048).optional().default(''),
  text: z.string().max(2000).optional().default(''),
});

export const commentCreateSchema = z.object({
  text: z.string().trim().min(1, 'Комментарий пустой').max(1000),
});

export const statusCreateSchema = z.object({
  type: z.string().max(32).optional().default('text'),
  url: z.string().max(2048).optional().default(''),
  text: z.string().max(500).optional().default(''),
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

export const forgotPasswordStartSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordVerifySchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});

export const dmSendSchema = z.object({
  toUserId: z.string().min(1),
  text: z.string().max(4000).optional().default(''),
  mediaUrl: z.string().max(2048).optional(),
  mediaType: z.string().max(32).optional(),
  replyToId: z.string().optional(),
  forwardedFromUserId: z.string().optional(),
});

export const noteUpsertSchema = z.object({
  body: z.string().min(1).max(50000),
});

export const pushTokenRegisterSchema = z.object({
  token: z.string().min(1).max(512),
  platform: z.string().max(32).optional().default('unknown'),
  deviceLabel: z.string().max(128).optional().default(''),
});

export type ForgotPasswordStartBody = z.infer<typeof forgotPasswordStartSchema>;
export type ForgotPasswordVerifyBody = z.infer<typeof forgotPasswordVerifySchema>;
export type DmSendBody = z.infer<typeof dmSendSchema>;
export type NoteUpsertBody = z.infer<typeof noteUpsertSchema>;
export type PushTokenRegisterBody = z.infer<typeof pushTokenRegisterSchema>;
