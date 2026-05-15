'use client';

import { useEffect, useRef } from 'react';
import { subscribeTopic } from '@/lib/websocket/stompClient';

/**
 * Subscribe to a STOMP topic for the lifetime of the component.
 *
 *   useStompTopic('/topic/tickets/TKT-2025-0001', (msg) => …, [ticketNumber])
 *
 * The destination can be `null` while you're waiting on data — the hook will
 * skip subscribing until it becomes truthy.
 */
export default function useStompTopic(destination, listener, deps = []) {
  // Hold the freshest listener in a ref — updated in an effect (never during
  // render, to keep React 19's purity rules happy) so consumers don't need
  // useCallback.
  const listenerRef = useRef(listener);
  useEffect(() => { listenerRef.current = listener; }, [listener]);

  useEffect(() => {
    if (!destination) return undefined;
    const unsubscribe = subscribeTopic(destination, (payload) => {
      listenerRef.current?.(payload);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, ...deps]);
}
