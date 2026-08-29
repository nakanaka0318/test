import type { ReactNode } from 'react';
import type { CharacterDef } from '../types';

export function renderTemplate(def: CharacterDef, template: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(template))) {
    if (match.index > lastIndex) parts.push(template.slice(lastIndex, match.index));
    const id = match[1];
    const tu = def.tunables[id];
    if (tu) {
      parts.push(
        <span key={`t-${key++}`} className="tunable">{tu.current}{tu.unit}</span>,
      );
    } else {
      parts.push(match[0]);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < template.length) parts.push(template.slice(lastIndex));
  return parts;
}
