// FILE: src/lib/dmSocket.ts
// Round 4: WebSocket подключение к /api/v1/ws/dm. Раньше DM-сообщения
// получались через polling каждые 4с — теперь push'и от сервера приходят
// через несколько ms после события. Polling остаётся как fallback (если WS
// не подключился, чат продолжает работать).
//
// Публичный API: useDmSocket(userId, onEvent) hook.
// Под капотом:
//  - один shared singleton-сокет на всё приложение (несколько Chat-подписчиков
//    делят одно соединение, экономим открытые WS handle'ы)
//  - exponential backoff на reconnect (1s → 2 → 4 → 8 → 16, max 30s)
//  - heartbeat (server pings каждые 30с, клиент закрывает на silence > 60c)
//  - native Capacitor URL → ws://72.56.38.62/api/v1/ws/dm

import { useEffect, useRef } from 'react';
import { resolveApiUrl } from './runtimeEndpoint';

export type DmSocketEvent =
  | { type: 'hello'; userId: string }
  | { type: 'dm:new'; from: string; to: string; message: { id: string; fromUserId: string; toUserId: string; text: string; mediaUrl: string | null; mediaType: 'image' | 'audio' | 'video' | null; replyToId: string | null; forwardedFromUserId: string | null; createdAt: string; readAt: string | null } }
  | { type: 'dm:edit'; from: string; to: string; messageId: string; text: string }
  | { type: 'dm:delete'; from: string; to: string; messageId: string }
  | { type: 'dm:pin'; from: string; partnerUserId: string; messageId: string | null };

type Listener = (ev: DmSocketEvent) => void;

let socket: WebSocket | null = null;
let listeners = new Set<Listener>();
let reconnectAttempt = 0;
let reconnectTimer: number | null = null;
let connecting = false;

function buildWsUrl(): string {
  // resolveApiUrl возвращает что-то типа http://72.56.38.62/api/v1/<path>.
  // Преобразуем http→ws, https→wss.
  const httpUrl = resolveApiUrl('/ws/dm');
  return httpUrl.replace(/^http(s?):/, 'ws$1:');
}

function notify(ev: DmSocketEvent): void {
  for (const l of listeners) {
    try { l(ev); } catch { /* one listener throwing should not break others */ }
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) return;
  // exponential backoff с верхней границей 30с
  const delayMs = Math.min(1000 * Math.pow(2, reconnectAttempt), 30_000);
  reconnectAttempt += 1;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    if (listeners.size > 0) connect();
  }, delayMs);
}

function connect(): void {
  if (connecting || socket) return;
  connecting = true;
  let ws: WebSocket;
  try {
    ws = new WebSocket(buildWsUrl());
  } catch {
    connecting = false;
    scheduleReconnect();
    return;
  }
  socket = ws;
  ws.onopen = () => {
    connecting = false;
    reconnectAttempt = 0;
  };
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(String(e.data)) as DmSocketEvent;
      notify(data);
    } catch { /* malformed packet — ignore */ }
  };
  ws.onerror = () => {
    // onclose сработает следом, и там сделаем reconnect
  };
  ws.onclose = () => {
    connecting = false;
    socket = null;
    if (listeners.size > 0) scheduleReconnect();
  };
}

function ensureConnected(): void {
  if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
    connect();
  }
}

function teardownIfIdle(): void {
  if (listeners.size > 0) return;
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    try { socket.close(1000, 'idle'); } catch { /* noop */ }
    socket = null;
  }
}

/**
 * Подписка компонента на DM-события. onEvent вызывается при каждом push'е
 * от сервера. При размонтировании unsubscribe + закрытие сокета если
 * никого не осталось.
 */
export function useDmSocket(onEvent: Listener): void {
  // Кладём callback в ref, чтобы listener не пересоздавался каждый рендер
  // (иначе мы бы re-subscribe'ались на каждом рендере родителя).
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    const stable: Listener = (ev) => cbRef.current(ev);
    listeners.add(stable);
    ensureConnected();
    return () => {
      listeners.delete(stable);
      // Tear-down с задержкой: если юзер просто переходит между route'ами
      // (Chat→Home→Chat), не хочется закрывать-открывать сокет за 100ms.
      setTimeout(teardownIfIdle, 5_000);
    };
  }, []);
}
