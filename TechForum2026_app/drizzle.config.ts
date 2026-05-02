// FILE: drizzle.config.ts
// PURPOSE: Конфиг для drizzle-kit (генерация миграций, push, studio).
// Запускается из корня проекта: `npx drizzle-kit generate`, `npx drizzle-kit migrate`.

import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit generate читает только schema.ts и не требует подключения.
// drizzle-kit migrate / push — требует. Поэтому пустой DSN допустим,
// падать будем только на реальном подключении (src/db/index.ts).
const databaseUrl = String(process.env.DATABASE_URL || '').trim()
  || 'postgres://placeholder:placeholder@127.0.0.1:5432/placeholder';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  verbose: true,
  strict: true,
});
