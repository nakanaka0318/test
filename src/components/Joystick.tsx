import { useRef, useState } from 'react';
import type { Facing } from '../types';

interface Props {
  active: boolean;
  onStep: (facing: Facing) => void;
}

const STEP_THRESHOLD = 26; // このピクセル数だけドラッグしたら1マス移動する

export default function Joystick({ active, onStep }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  const stop = (el?: HTMLDivElement | null) => {
    draggingRef.current = false;
    originRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    if (el) {
      try { el.releasePointerCapture?.((el as unknown as { pointerId?: number }).pointerId ?? 0); } catch { /* noop */ }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    originRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || !draggingRef.current || !originRef.current) return;
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, 34);
    if (dist > 0) {
      setKnobOffset({ x: (dx / dist) * clamped, y: (dy / dist) * clamped });
    }
    if (dist >= STEP_THRESHOLD) {
      const facing: Facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
      onStep(facing);
      // 発動したら基準点をリセットし、押し続けている間は連続で入力できるようにする
      originRef.current = { x: e.clientX, y: e.clientY };
      setKnobOffset({ x: 0, y: 0 });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    stop(e.currentTarget);
  };

  return (
    <div
      ref={wrapRef}
      className={`joystick-wrap${active ? '' : ' inactive'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={(e) => { if (draggingRef.current) stop(e.currentTarget); }}
    >
      <div className="joystick-knob" style={{ transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)` }} />
    </div>
  );
}
