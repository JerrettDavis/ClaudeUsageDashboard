import { EventEmitter } from 'events';

export type SessionEvent = {
  type: 'session:new' | 'session:update' | 'session:ended';
  sessionId: string;
  data: any;
  timestamp: number;
};

export type ProcessEvent = {
  type: 'process:start' | 'process:running' | 'process:end';
  pid: number;
  sessionId?: string;
  cwd?: string;
  data: any;
  timestamp: number;
};

export type MessageEvent = {
  type: 'message:new';
  sessionId: string;
  message: any;
  terminalOutput?: string[];
  timestamp: number;
};

export type DashboardEvent = SessionEvent | ProcessEvent | MessageEvent;

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Support many concurrent SSE connections
  }

  emitSessionEvent(event: SessionEvent) {
    this.emit('session', event);
    this.emit('*', event);
  }

  emitProcessEvent(event: ProcessEvent) {
    this.emit('process', event);
    this.emit('*', event);
  }

  emitMessageEvent(event: MessageEvent) {
    this.emit('message', event);
    this.emit('*', event);
  }

  onSession(handler: (event: SessionEvent) => void) {
    this.on('session', handler);
  }

  onProcess(handler: (event: ProcessEvent) => void) {
    this.on('process', handler);
  }

  onMessage(handler: (event: MessageEvent) => void) {
    this.on('message', handler);
  }

  onAny(handler: (event: DashboardEvent) => void) {
    this.on('*', handler);
  }
}

export const eventBus = new EventBus();
