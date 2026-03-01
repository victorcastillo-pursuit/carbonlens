import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface HashDisplayProps {
  hash: string;
  label?: string;
  truncate?: boolean;
}

export function HashDisplay({ hash, label, truncate = false }: HashDisplayProps) {
  const [copied, setCopied] = useState(false);

  const display = truncate ? hash.slice(0, 16) + '…' + hash.slice(-8) : hash;

  async function handleCopy() {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-neutral-500 shrink-0">{label}</span>}
      <span className="font-mono text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded px-2 py-1 break-all">
        {display}
      </span>
      <button
        onClick={handleCopy}
        className="shrink-0 text-neutral-400 hover:text-neutral-700 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
        title="Copy full hash"
        aria-label="Copy hash to clipboard"
      >
        {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
