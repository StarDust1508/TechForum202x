// Нормализация и валидация российских номеров телефона.
// Источник истины для frontend; на бэке — отдельная zod-schema.
// Для чужих стран потребуется отдельный pipeline; сейчас приложение
// targeting RU-only event (Саратов).

/**
 * Возвращает только цифры из ввода с нормализацией начальной 8 → 7.
 * Никаких спецсимволов, без +, без скобок. Длина не проверяется.
 */
export function digitsOnly(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d.length > 0 && !d.startsWith('7')) d = '7' + d;
  return d.slice(0, 11);
}

/**
 * Форматирует под маску «+7 (XXX) XXX-XX-XX». Если цифр меньше 11 —
 * выводит частичный фрагмент маски.
 */
export function formatPhone(input: string): string {
  const d = digitsOnly(input);
  if (d.length === 0) return '';
  const rest = d.slice(1);
  let out = '+7';
  if (rest.length > 0) out += ' (' + rest.slice(0, 3);
  if (rest.length >= 3) out += ')';
  if (rest.length > 3) out += ' ' + rest.slice(3, 6);
  if (rest.length > 6) out += '-' + rest.slice(6, 8);
  if (rest.length > 8) out += '-' + rest.slice(8, 10);
  return out;
}

/**
 * Строгая проверка: ровно 11 цифр, начинается на 7, второй знак — мобильный
 * код 9 (исключаем заглушки вроде +7 999 999 99 99 — кодовый номер 999 не
 * существует у российских операторов, но визуально не отличим; см. аудит #19).
 *
 * Если в будущем понадобятся стационарные (495, 812 и т.п.) — расширить
 * массив VALID_PREFIXES_3.
 */
const VALID_OPERATOR_FIRST_DIGIT = ['9']; // мобильные начинаются с +79xx
export function isValidPhone(input: string): boolean {
  const d = digitsOnly(input);
  if (d.length !== 11) return false;
  if (d[0] !== '7') return false;
  if (!VALID_OPERATOR_FIRST_DIGIT.includes(d[1])) return false;
  // отсекаем явные мусорные коды: «999», «000»
  const code = d.slice(1, 4);
  if (code === '999' || code === '000') return false;
  return true;
}

export function getValidationMessage(input: string): string | null {
  if (!input.trim()) return null;
  const d = digitsOnly(input);
  if (d.length === 0) return 'Введите номер';
  if (d.length < 11) return `Не хватает цифр (${d.length}/11)`;
  if (d[1] !== '9') return 'Только мобильные номера +7 9XX…';
  const code = d.slice(1, 4);
  if (code === '999' || code === '000') return 'Несуществующий код';
  return null;
}
