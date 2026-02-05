// Core Types for Claude Usage Dashboard

export type SessionStatus = 'active' | 'completed' | 'error';
export type MessageRole = 'user' | 'assistant';
export type FileOperation = 'create' | 'edit' | 'delete' | 'view';

// Provider Interface
export interface AIProvider {
  id: string;
  name: string;
  icon: string;
  
  // Core operations
  initialize(): Promise<void>;
  detectInstallation(): Promise<boolean>;
  getConfigPath(): string;
  
  // Session management
  listSessions(filter?: SessionFilter): Promise<Session[]>;
  getSession(id: string): Promise<SessionDetail>;
  watchSessions(callback: (event: SessionEvent) => void): Disposable;
  
  // Analytics
  getUsageStats(range: DateRange): Promise<UsageStats>;
  getTokenMetrics(): Promise<TokenMetrics>;
  getCostEstimate(usage: Usage): number;
  
  // Process monitoring
  detectRunningProcesses(): Promise<RunningProcess[]>;
  
  // Session launching
  launchSession(config: LaunchConfig): Promise<ProcessHandle>;
}

// Session Types
export interface Session {
  id: string;
  providerId: string;
  projectPath: string;
  projectName: string;
  startTime: Date;
  endTime?: Date | null;
  status: SessionStatus;
  messageCount: number | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  estimatedCost: number | null;
  createdAt: Date;
  updatedAt: Date;
  cwd?: string | null;
  gitBranch?: string | null;
  version?: string | null;
  lastSummary?: string | null;
  filesModified?: string | null;
  foldersAccessed?: string | null;
  fileCount?: number | null;
  toolUsageCount?: number | null;
  lastActivity?: Date | null;
}

export interface SessionDetail extends Session {
  messages: Message[];
  gitCommits?: GitCommit[];
  fileSnapshots: FileSnapshot[];
  toolCalls: ToolCall[];
  errors: ErrorLog[];
}

export interface Message {
  id: string;
  sessionId: string;
  parentId?: string | null;
  role: MessageRole;
  content: string | MessageContent[];
  timestamp: Date;
  tokens: number | null;
}

export interface MessageContent {
  type: 'text' | 'tool_use' | 'tool_result' | 'image';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  tool_use_id?: string;
}

export interface ToolCall {
  id: number;
  messageId: string;
  toolName: string;
  parameters: string;
  result?: string | null;
  success: boolean | null;
  timestamp: Date;
}

export interface FileModification {
  id: number;
  sessionId: string;
  filePath: string;
  operation: FileOperation;
  timestamp: Date;
}

export interface FileSnapshot {
  id: number;
  sessionId: string;
  filePath: string;
  content: string;
  timestamp: Date;
}

// Git Types
export interface GitCommit {
  id: number;
  sessionId: string;
  commitSha: string;
  commitMessage: string;
  author: string;
  timestamp: Date;
  filesChanged: number;
}

export interface GitRepository {
  path: string;
  branch: string;
  remote?: string;
  lastCommit?: string;
}

// Analytics Types
export interface UsageStats {
  totalSessions: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalTokens: number;
  estimatedCost: number;
  activeTime: number; // minutes
  toolUsageBreakdown: Record<string, number>;
  dailyBreakdown: DailyStat[];
  topProjects: ProjectStat[];
}

export interface TokenMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  averagePerSession: number;
  peakUsage: { date: Date; tokens: number };
}

export interface DailyStat {
  date: string;
  sessions: number;
  tokens: number;
  cost: number;
  activeMinutes: number;
}

export interface ProjectStat {
  projectName: string;
  projectPath: string;
  sessions: number;
  tokens: number;
  cost: number;
  lastActive: Date;
}

export interface ProductivityMetrics {
  averageSessionDuration: number;
  mostProductiveHour: number;
  toolEfficiency: Record<string, number>;
  sessionsPerDay: number;
}

// Process Types
export interface RunningProcess {
  pid: number;
  name: string;
  command: string;
  workingDirectory: string;
  startTime: Date;
  memoryUsage: number;
  cpuUsage: number;
}

export interface ProcessHandle {
  pid: number;
  kill(): Promise<void>;
  onExit(callback: (code: number) => void): void;
}

// Filter Types
export interface SessionFilter {
  providerId?: string;
  projectPath?: string;
  status?: SessionStatus;
  dateRange?: DateRange;
  search?: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Launcher Types
export interface LaunchConfig {
  providerId: string;
  projectPath: string;
  prompt?: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: string;
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

// Event Types
export interface SessionEvent {
  type: 'session_started' | 'session_updated' | 'session_completed' | 'session_error';
  sessionId: string;
  timestamp: Date;
  data?: unknown;
}

export interface FileEvent {
  type: 'file_created' | 'file_modified' | 'file_deleted';
  filePath: string;
  timestamp: Date;
}

export interface ProcessEvent {
  type: 'process_started' | 'process_stopped';
  pid: number;
  timestamp: Date;
}

// Utility Types
export interface Disposable {
  dispose(): void;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface ErrorLog {
  id: number;
  sessionId: string;
  message: string;
  stack?: string;
  timestamp: Date;
}

// Worker Types
export interface WorkerJob<T = unknown> {
  id: string;
  data: T;
}

export interface WorkerResult<T = unknown> {
  jobId: string;
  success: boolean;
  result?: T;
  error?: string;
  progress?: number;
}

// Provider Config
export interface ProviderConfig {
  id: string;
  name: string;
  configPath: string;
  installed: boolean;
  lastSync?: Date;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}
