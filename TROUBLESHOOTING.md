# Troubleshooting Guide

## Common Issues

### Issue: Dashboard doesn't show any sessions

**Cause**: The file watcher hasn't detected any session files yet.

**Solution**:
1. Check that session files exist in `~/.claude/projects/`
2. Verify file watcher is running (check console logs for `[FileWatcher] Starting`)
3. Ensure the file format is `.jsonl`
4. Try starting a new AI session to trigger detection

---

### Issue: "Loading history..." never completes

**Cause**: Session file not found or permission issues.

**Solution**:
1. Verify the session ID is correct (8-character prefix shown in UI)
2. Check file permissions in `~/.claude/projects/`
3. Look for errors in browser console (F12)
4. Verify the file exists: `ls ~/.claude/projects/*/<session-id>.jsonl`

---

### Issue: Real-time updates not working

**Cause**: SSE connection failed or EventSource not supported.

**Solution**:
1. Check browser console for `[EventSource] Connected`
2. If you see `[EventSource] Error`, refresh the page
3. Ensure browser supports Server-Sent Events (all modern browsers do)
4. Check for proxy/firewall blocking SSE connections

---

### Issue: Auto-open toggle not working

**Cause**: State not updating or click handler not firing.

**Solution**:
1. Click directly on the toggle button, not just the label
2. Check browser console for `[TilingMonitor] Auto-open toggled to: true`
3. Try refreshing the page
4. Ensure JavaScript is enabled

---

### Issue: Messages not loading older history

**Cause**: Pagination endpoint timing out or large session file.

**Solution**:
1. Check network tab for failed requests to `/api/sessions/[id]/history`
2. For very large sessions (>10,000 messages), loading may be slow
3. Try refreshing the page and reopening the session
4. Check server logs for errors

---

### Issue: High memory usage

**Cause**: Message cache growing too large with many sessions.

**Solution**:
1. Remove unused sessions from the tiling grid
2. Refresh the page to clear the cache
3. Consider closing and reopening the browser
4. Future releases will implement cache size limits

---

### Issue: Database errors on first run

**Cause**: SQLite database not initialized.

**Solution**:
```bash
# Create data directory
mkdir -p data

# The database will be created automatically on first run
npm run dev
```

---

### Issue: Build fails with TypeScript errors

**Cause**: Strict type checking or missing dependencies.

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Check TypeScript
npm run build
```

---

### Issue: Port 3000 already in use

**Solution**:
```bash
# Use a different port
PORT=3001 npm run dev
```

Or kill the process using port 3000:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Mac/Linux
lsof -ti:3000 | xargs kill
```

---

## Getting Help

If you encounter an issue not listed here:

1. **Check the logs**: Browser console (F12) and terminal output
2. **Search issues**: [GitHub Issues](https://github.com/JerrettDavis/ClaudeUsageDashboard/issues)
3. **Create an issue**: Include:
   - Description of the problem
   - Steps to reproduce
   - Browser and OS information
   - Relevant error messages
   - Screenshots if applicable

## Debug Mode

Enable verbose logging:

```bash
# Set environment variable
DEBUG=* npm run dev
```

This will output detailed logs from all services.
