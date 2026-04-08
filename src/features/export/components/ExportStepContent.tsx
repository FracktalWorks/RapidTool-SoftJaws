import { useState } from 'react';
import { useExport, type ExportFormat } from '../hooks/useExport';
import { geometryCache } from '../../../stores/geometryCache';
import { MOUNTING_HOLES_RESULT_KEY } from '../../mounting-holes/hooks/useMountingHoles';
import { JAW_PROFILE_RESULT_KEY } from '../../jaw-profile/hooks/useJawProfile';

export function ExportStepContent() {
  const [format, setFormat] = useState<ExportFormat>('stl-binary');
  const { isExporting, error, exportJaw } = useExport();

  const hasGeometry =
    geometryCache.has(MOUNTING_HOLES_RESULT_KEY) ||
    geometryCache.has(JAW_PROFILE_RESULT_KEY);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold text-foreground">Export Jaw</h3>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Format</label>
        <select
          className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
        >
          <option value="stl-binary">STL (Binary)</option>
          <option value="stl-ascii">STL (ASCII)</option>
        </select>
      </div>

      {!hasGeometry && (
        <div className="rounded bg-yellow-500/10 p-2 text-xs text-yellow-600 dark:text-yellow-400">
          Generate the jaw profile first before exporting.
        </div>
      )}

      {error && (
        <div className="rounded bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <button
        className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        onClick={() => exportJaw(format)}
        disabled={isExporting || !hasGeometry}
      >
        {isExporting ? 'Exporting…' : 'Download STL'}
      </button>
    </div>
  );
}
