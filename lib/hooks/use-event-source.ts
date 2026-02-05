'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface SSEEvent {
  type: string;
  [key: string]: any;
}

interface UseEventSourceOptions {
  onEvent?: (event: SSEEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useEventSource(url: string, options: UseEventSourceOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store callbacks in refs to avoid dependency issues
  const onEventRef = useRef(options.onEvent);
  const onErrorRef = useRef(options.onError);
  const onOpenRef = useRef(options.onOpen);
  
  // Update refs when callbacks change
  useEffect(() => {
    onEventRef.current = options.onEvent;
    onErrorRef.current = options.onError;
    onOpenRef.current = options.onOpen;
  }, [options.onEvent, options.onError, options.onOpen]);

  const {
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return;
    }

    console.log('[EventSource] Connecting to', url);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[EventSource] Connected');
      setIsConnected(true);
      setReconnectAttempts(0);
      onOpenRef.current?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastEvent(data);
        onEventRef.current?.(data);
      } catch (error) {
        console.error('[EventSource] Failed to parse event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[EventSource] Error:', error);
      setIsConnected(false);
      onErrorRef.current?.(error);
      
      eventSource.close();
      eventSourceRef.current = null;

      if (reconnect && reconnectAttempts < maxReconnectAttempts) {
        const backoffDelay = reconnectInterval * Math.pow(1.5, reconnectAttempts);
        console.log(`[EventSource] Reconnecting in ${backoffDelay}ms`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts((prev) => prev + 1);
          connect();
        }, backoffDelay);
      }
    };
  }, [url, reconnect, reconnectInterval, maxReconnectAttempts, reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      console.log('[EventSource] Disconnecting');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    reconnectAttempts,
    disconnect,
    reconnect: connect,
  };
}
