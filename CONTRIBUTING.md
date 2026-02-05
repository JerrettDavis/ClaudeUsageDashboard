# Contributing to AI Usage Dashboard

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## 🚀 Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ClaudeUsageDashboard.git
   cd ClaudeUsageDashboard
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Start development server**
   ```bash
   npm run dev
   ```

## 🏗️ Architecture Overview

### Key Principles
- **Type Safety**: Full TypeScript coverage
- **Real-time First**: SSE for live updates
- **Worker Threads**: CPU-intensive tasks off main thread
- **Component Isolation**: Small, focused components
- **Clean Architecture**: Separation of concerns

### Directory Structure
- `app/` - Next.js App Router (pages and API routes)
- `components/` - React components (UI and features)
- `lib/services/` - Core business logic
- `lib/providers/` - AI provider integrations
- `lib/hooks/` - Custom React hooks
- `types/` - TypeScript type definitions

## 📝 Development Workflow

### 1. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes
- Follow existing code patterns
- Keep components small and focused
- Add TypeScript types for all new code
- Use existing hooks and services where possible

### 3. Test Your Changes
```bash
npm run lint        # Check for linting errors
npm run build       # Ensure production build works
```

### 4. Commit Your Changes
```bash
git add .
git commit -m "Add: Brief description of your changes"
```

Use semantic commit messages:
- `Add:` New features
- `Fix:` Bug fixes
- `Update:` Changes to existing features
- `Refactor:` Code restructuring
- `Docs:` Documentation changes

### 5. Push and Create PR
```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 🎨 Code Style

### TypeScript
- Use explicit types (avoid `any`)
- Prefer interfaces over types for objects
- Use `const` for immutable values
- Destructure props in components

### React Components
```typescript
// Good component structure
interface MyComponentProps {
  title: string;
  count: number;
}

export function MyComponent({ title, count }: MyComponentProps) {
  const [value, setValue] = useState(0);
  
  return (
    <div className="...">
      {/* Component content */}
    </div>
  );
}
```

### Naming Conventions
- **Components**: PascalCase (`SessionTerminal.tsx`)
- **Hooks**: camelCase with `use` prefix (`useEventSource.ts`)
- **Services**: PascalCase classes (`FileWatcherService`)
- **Types**: PascalCase interfaces (`SessionEvent`)

## 🧪 Testing

While we're still building out the test infrastructure, aim to:
- Test critical business logic
- Test API endpoints
- Test complex hooks
- Manual testing for UI components

## 📚 Adding New Features

### Adding a New AI Provider
1. Create provider implementation in `lib/providers/`
2. Implement the base provider interface
3. Add file parsing logic
4. Update the UI to support the new provider

### Adding a New Monitoring View
1. Create component in `components/monitoring/`
2. Add route in `app/monitoring/`
3. Connect to event bus for real-time updates
4. Update navigation in sidebar

## 🐛 Reporting Bugs

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Environment (OS, Node version, etc.)

## 💡 Suggesting Features

Feature requests are welcome! Please:
- Check existing issues first
- Explain the use case
- Describe the proposed solution
- Consider backwards compatibility

## 🔐 Security

- Never commit secrets or API keys
- No external API calls without user consent
- Keep user data local
- Review `.gitignore` before committing

## 📞 Questions?

Feel free to open an issue for:
- Questions about architecture
- Clarification on features
- Help with development setup
- General discussions

## 🙏 Thank You!

Every contribution helps make this project better. We appreciate your time and effort!
