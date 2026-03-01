import { Sun } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-white border-b border-neutral-200">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-md">
            <Sun size={16} className="text-white" />
          </div>
          <div>
            <span className="text-base font-semibold text-neutral-900">CarbonLens</span>
            <span className="ml-2 text-xs text-neutral-400 font-normal">Solar Carbon Credit Documentation</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-neutral-400 bg-neutral-50 border border-neutral-200 rounded px-2 py-1">
            CDM AMS I.D
          </span>
          <span className="text-xs text-neutral-400">EPA eGRID 2023 Rev 2</span>
        </div>
      </div>
    </header>
  );
}
