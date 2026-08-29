import type { BattleState } from '../engine/battleTypes';
import type { Cell } from '../engine/grid';
import { cellKey } from '../engine/grid';
import { currentUnit } from '../engine/battleEngine';

interface Props {
  battle: BattleState;
  previewCells: Cell[];
  targetableUids: string[];
  targetableClones: boolean;
  onUnitTap: (uid: string) => void;
  onCloneTap: (index: number) => void;
}

const FACING_ARROW: Record<string, string> = { N: '▲', S: '▼', E: '▶', W: '◀' };

export default function GridField({ battle, previewCells, targetableUids, targetableClones, onUnitTap, onCloneTap }: Props) {
  const size = battle.gridSize;
  const previewSet = new Set(previewCells.map(cellKey));
  const cur = currentUnit(battle);
  const cells: React.ReactNode[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const key = cellKey({ x, y });
      const tile = battle.tiles[key] ?? 'normal';
      const unit = battle.units.find(u => u.alive && u.pos.x === x && u.pos.y === y);
      const cloneEntries = battle.units
        .map((u, ui) => ({ u, ui }))
        .filter(({ u }) => u.alive && u.clones.some(c => c.x === x && c.y === y));

      const isTargetable = !!unit && targetableUids.includes(unit.uid);
      cells.push(
        <div
          key={key}
          className={`cell tile-${tile}${previewSet.has(key) ? ' in-range' : ''}${isTargetable ? ' targetable' : ''}`}
        >
          {cloneEntries.map(({ u, ui }) => {
            const idx = u.clones.findIndex(c => c.x === x && c.y === y);
            return (
              <div
                key={`clone-${ui}-${idx}`}
                className="clone-token"
                onClick={() => { if (targetableClones && u.uid === cur.uid) onCloneTap(idx); }}
              />
            );
          })}
          {unit && (
            <div
              className={`unit-token team-${unit.team}${unit.uid === cur.uid ? ' current' : ''}${!unit.alive ? ' dead' : ''}`}
              onClick={() => isTargetable && onUnitTap(unit.uid)}
            >
              <span className="facing-arrow">{FACING_ARROW[unit.facing]}</span>
              {unit.name.slice(0, 2)}
              <span className="hpbar"><i style={{ width: `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%` }} /></span>
            </div>
          )}
        </div>,
      );
    }
  }

  return (
    <div className="field-wrap">
      <div
        className="grid-field"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          width: 'min(94vw, 480px)',
          height: 'min(94vw, 480px)',
        }}
      >
        {cells}
      </div>
    </div>
  );
}
