import type { NextRequest } from 'next/server';
import { eventBus } from '@/lib/services/event-bus';
import { fileWatcher } from '@/lib/services/file-watcher';
import { processMonitor } from '@/lib/services/process-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Start services on first request
let servicesStarted = false;
async function ensureServicesStarted() {
  if (!servicesStarted) {
    console.log('[SSE] Starting monitoring services...');
    await fileWatcher.start(); // Now properly awaited
    processMonitor.start();
    servicesStarted = true;
  }
}

export async function GET(request: NextRequest) {
  await ensureServicesStarted();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      console.log('[SSE] New client connected');

      // Send initial connection message
      const initMessage = `data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`;
      controller.enqueue(encoder.encode(initMessage));

      // Send service status
      const statusMessage = `data: ${JSON.stringify({
        type: 'status',
        fileWatcher: fileWatcher.getStatus(),
        processMonitor: processMonitor.getStatus(),
        timestamp: Date.now(),
      })}\n\n`;
      controller.enqueue(encoder.encode(statusMessage));

      // Listen to all events
      const eventHandler = (event: any) => {
        try {
          const message = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error('[SSE] Error sending event:', error);
        }
      };

      eventBus.onAny(eventHandler);

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          const ping = `data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`;
          controller.enqueue(encoder.encode(ping));
        } catch (error) {
          console.error('[SSE] Heartbeat error:', error);
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        console.log('[SSE] Client disconnected');
        clearInterval(heartbeat);
        eventBus.off('*', eventHandler);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
