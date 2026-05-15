'use client';

/**
 * STOMP-over-SockJS singleton client for the AES portal.
 *
 * Phase 13 (lines 1873-1927 of the spec) — one connection per browser tab,
 * all hooks share it. Reconnects automatically with exponential backoff.
 *
 * Topics exposed by the backend:
 *   /topic/tickets/{ticketNumber}            → status changes / escalations
 *   /topic/crm/inbox                         → new tickets for CRM agents
 *   /topic/escalation/dashboard              → admin escalation feed
 *   /topic/users/{userId}/notifications      → personal notification stream
 *
 * Usage:
 *   import { subscribeTopic } from '@/lib/websocket/stompClient';
 *   const unsubscribe = subscribeTopic('/topic/tickets/TKT-2025-0001', (msg) => …);
 *   …later: unsubscribe();
 */

import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8080/ws';
const TOKEN_KEY = 'aes_token';

let client = null;
let connectPromise = null;
const subscriptions = new Map(); // destination -> { count, sub, listeners:Set<fn> }

function readToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function ensureClient() {
  if (client) return client;
  if (typeof window === 'undefined') return null;

  client = new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    reconnectDelay: 4000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => {},
    connectHeaders: (() => {
      const token = readToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    })(),
    onConnect: () => {
      // Re-subscribe to all known destinations after reconnect
      subscriptions.forEach((entry, destination) => {
        entry.sub = client.subscribe(destination, (frame) => {
          let payload = frame.body;
          try { payload = JSON.parse(frame.body); } catch { /* keep as string */ }
          entry.listeners.forEach((fn) => {
            try { fn(payload); } catch (err) { console.error('[ws-listener]', err); }
          });
        });
      });
    },
    onStompError: (frame) => {
      console.warn('[ws] broker error:', frame.headers?.message || frame);
    },
  });
  return client;
}

function activate() {
  if (!client) return Promise.resolve();
  if (client.active) return Promise.resolve();
  if (connectPromise) return connectPromise;
  connectPromise = new Promise((resolve) => {
    const onConnect = client.onConnect;
    client.onConnect = (frame) => {
      onConnect?.(frame);
      resolve();
    };
    client.activate();
  }).finally(() => { connectPromise = null; });
  return connectPromise;
}

/**
 * Subscribe to a STOMP destination. Returns an unsubscribe fn.
 * Multiple listeners on the same destination share one underlying subscription.
 */
export function subscribeTopic(destination, listener) {
  if (typeof window === 'undefined' || typeof listener !== 'function') return () => {};
  ensureClient();

  let entry = subscriptions.get(destination);
  if (!entry) {
    entry = { count: 0, sub: null, listeners: new Set() };
    subscriptions.set(destination, entry);
  }
  entry.listeners.add(listener);
  entry.count += 1;

  const ensureSubscribed = async () => {
    await activate();
    if (entry.sub || !client?.connected) return;
    entry.sub = client.subscribe(destination, (frame) => {
      let payload = frame.body;
      try { payload = JSON.parse(frame.body); } catch { /* keep as string */ }
      entry.listeners.forEach((fn) => {
        try { fn(payload); } catch (err) { console.error('[ws-listener]', err); }
      });
    });
  };
  ensureSubscribed();

  return () => {
    const cur = subscriptions.get(destination);
    if (!cur) return;
    cur.listeners.delete(listener);
    cur.count = Math.max(0, cur.count - 1);
    if (cur.count === 0) {
      try { cur.sub?.unsubscribe(); } catch { /* ignore */ }
      subscriptions.delete(destination);
    }
  };
}

/**
 * Force a fresh connection — used after sign-in so the next subscribe
 * negotiates with the new JWT.
 */
export function reconnectStompClient() {
  if (!client) return;
  try { client.deactivate(); } catch { /* ignore */ }
  client = null;
  subscriptions.forEach((entry) => { entry.sub = null; });
}
