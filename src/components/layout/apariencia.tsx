'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { SunMoon } from 'lucide-react';

export function Apariencia() {
  const { theme, setTheme } = useTheme();
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);
  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm">
      <SunMoon size={16} aria-hidden="true" />
      <select aria-label="Apariencia" value={listo ? theme : 'system'} disabled={!listo}
        onChange={event => setTheme(event.target.value)} className="bg-card text-foreground">
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
  );
}
