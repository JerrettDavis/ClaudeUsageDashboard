# AI Usage Dashboard

A comprehensive, real-time monitoring dashboard for AI coding assistant usage. Track sessions, analyze usage patterns, and monitor costs across your development workflow. Built with Next.js and TypeScript for performance and extensibility.

## ✨ Features

### 🖥️ **Tiling Window Manager**
- Monitor multiple AI sessions simultaneously in a customizable grid layout
- Real-time streaming of conversation content
- Auto-open new sessions, auto-close finished sessions
- Load message history on-demand with infinite scroll
- Session details panel with live statistics

### 📊 **Real-Time Monitoring**
- Live event stream with Server-Sent Events (SSE)
- File watching with automatic change detection
- Process monitoring for active sessions
- Terminal-style output with color-coded messages

### 📈 **Analytics & Insights**
- Token usage tracking (input/output)
- Cost estimation per session
- Message count and duration tracking
- Project-level statistics

### 🎯 **Session Management**
- Session picker modal with auto-population
- Quick-add bar for detected sessions
- Message history caching for instant reload
- Chunked message loading (newest first)

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, shadcn/ui, TailwindCSS
- **Backend**: tRPC, Drizzle ORM, SQLite, Server-Sent Events
- **Monitoring**: File watching, Process monitoring, Event bus
- **Styling**: Tailwind CSS v3, Radix UI primitives

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/JerrettDavis/ClaudeUsageDashboard.git
cd ClaudeUsageDashboard

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the dashboard.

## 🚀 Quick Start

1. **Development Mode**
   ```bash
   npm run dev
   ```

2. **Production Build**
   ```bash
   npm run build
   npm start
   ```

3. **View the Tiling Monitor**
   - Navigate to `/monitoring/sessions`
   - Enable AUTO-OPEN to automatically track new sessions
   - Click "Add Session" to manually add specific sessions

## 📁 Project Structure

```
ai-usage-dashboard/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── events/           # SSE endpoints
│   │   ├── sessions/         # Session APIs
│   │   └── trpc/             # tRPC endpoints
│   ├── dashboard/            # Dashboard pages
│   └── monitoring/           # Monitoring views
├── components/               # React components
│   ├── monitoring/           # Monitoring components
│   │   ├── tiling-monitor.tsx
│   │   ├── session-picker-modal.tsx
│   │   └── live-logs-panel.tsx
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── services/             # Core services
│   │   ├── file-watcher.ts   # File monitoring
│   │   ├── process-monitor.ts # Process tracking
│   │   ├── event-bus.ts      # Event management
│   │   └── message-formatter.ts
│   ├── providers/            # AI provider integrations
│   ├── hooks/                # React hooks
│   └── db/                   # Database & schema
└── types/                    # TypeScript definitions
```

## 🎯 Key Features Explained

### Tiling Window Manager

The tiling monitor allows you to watch multiple AI sessions simultaneously:

- **Dynamic Grid Layout**: Automatically adjusts based on session count
  - 1 session: Full screen
  - 2 sessions: Side by side
  - 4 sessions: 2x2 grid
  - 6+ sessions: 3x3 grid

- **Session Controls**:
  - Expand details panel for stats
  - Maximize to focus on one session
  - Remove sessions from grid
  - Load older messages on demand

### Message History Loading

Sessions load the most recent 100 messages instantly, then allow you to load older messages incrementally:

```typescript
// API supports pagination
GET /api/sessions/{sessionId}/history?limit=100&offset=0
```

Messages are cached in memory to avoid re-fetching when you revisit a session.

### Auto-Open/Auto-Close

- **AUTO-OPEN**: New sessions automatically appear in your grid
- **AUTO-CLOSE**: Finished sessions automatically disappear

Toggle these features in the top bar of the tiling monitor.

## 🔧 Configuration

The dashboard automatically detects AI session files in:
- `~/.claude/projects/` (Windows/Mac/Linux)

No configuration file needed - it works out of the box!

## 📊 Data Sources

### Session Files (JSONL)
The dashboard reads session data from `.jsonl` files:
- One JSON object per line
- Contains messages, tool calls, and metadata
- Automatically parsed and formatted

### Database
Local SQLite database stores:
- Session metadata
- Message history
- Tool usage statistics
- Cost calculations

## 🧪 Development

```bash
# Run linter
npm run lint

# Run tests (when implemented)
npm test

# Format code
npm run format

# Build for production
npm run build
```

## 🛡️ Security & Privacy

- ✅ **100% Local** - All data stays on your machine
- ✅ **No External Calls** - No data sent to remote servers
- ✅ **Local Database** - SQLite database in `/data` directory
- ✅ **No Telemetry** - No usage tracking or analytics

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

---

**Note**: This dashboard is designed to work with AI coding assistants that store session data locally in JSONL format. The initial implementation focuses on one specific AI assistant, but the architecture is extensible to support multiple providers.

