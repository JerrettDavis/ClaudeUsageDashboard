import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Providers table
export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  configPath: text('config_path'),
  installed: integer('installed', { mode: 'boolean' }).default(false),
  lastSync: integer('last_sync', { mode: 'timestamp' }),
  costPerInputToken: real('cost_per_input_token'),
  costPerOutputToken: real('cost_per_output_token'),
});

// Sessions table
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  providerId: text('provider_id')
    .notNull()
    .references(() => providers.id),
  projectPath: text('project_path').notNull(),
  projectName: text('project_name').notNull(),
  cwd: text('cwd'), // Working directory from session
  gitBranch: text('git_branch'), // Git branch
  version: text('version'), // Claude version
  lastSummary: text('last_summary'), // Most recent summary
  filesModified: text('files_modified'), // JSON array of file paths
  foldersAccessed: text('folders_accessed'), // JSON array of folder paths
  fileCount: integer('file_count').default(0), // Number of files touched
  toolUsageCount: integer('tool_usage_count').default(0), // Number of tool calls
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }),
  lastActivity: integer('last_activity', { mode: 'timestamp' }), // Last file modification time
  status: text('status', { enum: ['active', 'completed', 'error'] })
    .notNull()
    .default('active'),
  messageCount: integer('message_count').default(0),
  tokensInput: integer('tokens_input').default(0),
  tokensOutput: integer('tokens_output').default(0),
  estimatedCost: real('estimated_cost').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  providerIdx: index('sessions_provider_idx').on(table.providerId),
  startTimeIdx: index('sessions_start_time_idx').on(table.startTime),
  statusIdx: index('sessions_status_idx').on(table.status),
  lastActivityIdx: index('sessions_last_activity_idx').on(table.lastActivity),
}));

// Messages table
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(), // JSON string
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  tokens: integer('tokens').default(0),
});

// Tool calls table
export const toolCalls = sqliteTable('tool_calls', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: text('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  parameters: text('parameters').notNull(), // JSON string
  result: text('result'), // JSON string
  success: integer('success', { mode: 'boolean' }).default(true),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// File modifications table
export const fileModifications = sqliteTable('file_modifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  operation: text('operation', { enum: ['create', 'edit', 'delete', 'view'] }).notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// File snapshots table
export const fileSnapshots = sqliteTable('file_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  content: text('content').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// Git commits table
export const gitCommits = sqliteTable('git_commits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  commitSha: text('commit_sha').notNull(),
  commitMessage: text('commit_message'),
  author: text('author'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  filesChanged: integer('files_changed').default(0),
});

// Error logs table
export const errorLogs = sqliteTable('error_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  stack: text('stack'),
  timestamp: integer('timestamp', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Prompt templates table
export const promptTemplates = sqliteTable('prompt_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  template: text('template').notNull(),
  variables: text('variables').notNull(), // JSON string
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Types for inference
export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;
export type FileModification = typeof fileModifications.$inferSelect;
export type NewFileModification = typeof fileModifications.$inferInsert;
export type FileSnapshot = typeof fileSnapshots.$inferSelect;
export type NewFileSnapshot = typeof fileSnapshots.$inferInsert;
export type GitCommit = typeof gitCommits.$inferSelect;
export type NewGitCommit = typeof gitCommits.$inferInsert;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type NewErrorLog = typeof errorLogs.$inferInsert;
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type NewPromptTemplate = typeof promptTemplates.$inferInsert;
