'use client';

import { io, Socket } from 'socket.io-client';
import { useEffect, useState, useCallback, useRef } from 'react';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type EventCallback = (data: unknown) => void;

class WebSocketManager {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WS] Connection error:', error);
      this.reconnectAttempts++;
    });

    // Re-emit all events to registered listeners
    this.socket.onAny((event, data) => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach((cb) => cb(data));
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  off(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data?: unknown) {
    this.socket?.emit(event, data);
  }

  get connected() {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

// React hook for WebSocket connection
export function useWebSocket() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    wsManager.connect();

    const unsubConnect = wsManager.on('connect', () => setConnected(true));
    const unsubDisconnect = wsManager.on('disconnect', () => setConnected(false));

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, []);

  return { connected, wsManager };
}

// Hook for specific event subscriptions
export function useWSEvent<T>(event: string, callback: (data: T) => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = (data: unknown) => {
      callbackRef.current(data as T);
    };

    const unsub = wsManager.on(event, handler);
    return unsub;
  }, [event]);
}

// Hook for portfolio updates
export function usePortfolioUpdates(onUpdate: (portfolio: unknown) => void) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    const handler = (data: unknown) => {
      callbackRef.current(data);
    };

    const unsub = wsManager.on('portfolio:update', handler);
    return unsub;
  }, []);
}

// Hook for trade executions
export function useTradeUpdates(onTrade: (trade: unknown) => void) {
  const callbackRef = useRef(onTrade);
  callbackRef.current = onTrade;

  useEffect(() => {
    const handler = (data: unknown) => {
      callbackRef.current(data);
    };

    const unsub = wsManager.on('trade:executed', handler);
    return unsub;
  }, []);
}

// Hook for analysis completions
export function useAnalysisUpdates(onAnalysis: (analysis: unknown) => void) {
  const callbackRef = useRef(onAnalysis);
  callbackRef.current = onAnalysis;

  useEffect(() => {
    const handler = (data: unknown) => {
      callbackRef.current(data);
    };

    const unsub = wsManager.on('analysis:complete', handler);
    return unsub;
  }, []);
}

// Hook for bot status
export function useBotStatus(onStatus: (status: unknown) => void) {
  const callbackRef = useRef(onStatus);
  callbackRef.current = onStatus;

  useEffect(() => {
    const handler = (data: unknown) => {
      callbackRef.current(data);
    };

    const unsub = wsManager.on('bot:status', handler);
    return unsub;
  }, []);
}

// === NEW EVENT SUBSCRIPTIONS FOR FRONTEND DATA INTEGRITY ===

// Hook for regime changes
export function useRegimeUpdates(onRegime: (data: { regime: string; timestamp: number }) => void) {
  const callbackRef = useRef(onRegime);
  callbackRef.current = onRegime;

  useEffect(() => {
    const handler = (data: unknown) => {
      callbackRef.current(data as { regime: string; timestamp: number });
    };

    const unsub = wsManager.on('regime:change', handler);
    return unsub;
  }, []);
}

// Hook for learning updates
export function useLearningUpdates(onLearning: (data: unknown) => void) {
  const callbackRef = useRef(onLearning);
  callbackRef.current = onLearning;

  useEffect(() => {
    const handler = (data: unknown) => {
      callbackRef.current(data);
    };

    const unsub = wsManager.on('learning:update', handler);
    return unsub;
  }, []);
}

// Hook for CEO decisions
export function useCeoDecisions(onDecision: (data: unknown) => void) {
  const callbackRef = useRef(onDecision);
  callbackRef.current = onDecision;

  useEffect(() => {
    const handler = (data: unknown) => {
      callbackRef.current(data);
    };

    const unsub = wsManager.on('ceo:decision', handler);
    return unsub;
  }, []);
}

// Hook for agent messages
export function useAgentMessages(onMessage: (data: unknown) => void) {
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    const handler = (data: unknown) => {
      callbackRef.current(data);
    };

    const unsub = wsManager.on('agent:message', handler);
    return unsub;
  }, []);
}

// Hook for allocation updates
export function useAllocationUpdates(onAllocation: (data: unknown) => void) {
  const callbackRef = useRef(onAllocation);
  callbackRef.current = onAllocation;

  useEffect(() => {
    const handler = (data: unknown) => {
      callbackRef.current(data);
    };

    const unsub = wsManager.on('allocation:update', handler);
    return unsub;
  }, []);
}

// === SSE STREAMING HOOKS ===

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useMarketStream(onUpdate: (data: unknown) => void) {
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/api/stream/market`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onUpdate(parsed);
      } catch {}
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);
}

export function usePortfolioStream(onUpdate: (data: unknown) => void) {
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/api/stream/portfolio`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onUpdate(parsed);
      } catch {}
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);
}

export function useAgentStream(onUpdate: (data: unknown) => void) {
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/api/stream/agents`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onUpdate(parsed);
      } catch {}
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);
}

export function useBoardroomMessages(onMessage: (data: unknown) => void) {
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    const handler = (data: unknown) => {
      callbackRef.current(data);
    };

    const unsub = wsManager.on('boardroom:message', handler);
    return unsub;
  }, []);
}