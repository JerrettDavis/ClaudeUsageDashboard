'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileCode } from 'lucide-react';

interface JsonViewerProps {
  sessionId: string;
  jsonlPath: string;
}

export function JsonViewer({ sessionId, jsonlPath }: JsonViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [jsonlData, setJsonlData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadJsonl = async () => {
    if (jsonlData.length > 0) {
      setIsExpanded(!isExpanded);
      return;
    }

    setIsLoading(true);
    try {
      // In a real implementation, you'd fetch the JSONL file
      // For now, we'll show a placeholder
      setJsonlData([
        { type: 'placeholder', message: 'JSONL viewer coming soon...' }
      ]);
      setIsExpanded(true);
    } catch (error) {
      console.error('Failed to load JSONL:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-zinc-800 bg-zinc-900/50 rounded overflow-hidden">
      <button
        onClick={loadJsonl}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-400 font-mono">RAW JSONL DATA</h2>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 max-h-[600px] overflow-auto bg-black/20">
          {isLoading ? (
            <p className="text-xs text-zinc-600 font-mono">Loading...</p>
          ) : (
            <pre className="text-xs text-zinc-400 font-mono">
              {JSON.stringify(jsonlData, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
