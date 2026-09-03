import * as THREE from 'three';

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

function finish(c: HTMLCanvasElement, repeat: number, srgb = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** ざらついたコンクリート風のタイル */
export function concreteTexture(repeat: number, base = '#2a3040', speck = '#3b4356'): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = speck;
  for (let i = 0; i < 260; i++) {
    const r = Math.random() * 2.4 + 0.4;
    ctx.globalAlpha = Math.random() * 0.4;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#0d1017';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo((i * size) / 4, 0);
    ctx.lineTo((i * size) / 4, size);
    ctx.moveTo(0, (i * size) / 4);
    ctx.lineTo(size, (i * size) / 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finish(c, repeat);
}

/** ラフネスマップ用のノイズ（グレースケール） */
export function noiseRoughness(repeat: number, mid = 190, amp = 55): THREE.CanvasTexture {
  const size = 128;
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = mid + (Math.random() - 0.5) * amp * 2;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, repeat, false);
}

/** 侵攻ルートを示す矢印付きの路面 */
export function laneTexture(): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#3a2622';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n;
    img.data[i + 1] += n * 0.7;
    img.data[i + 2] += n * 0.6;
  }
  ctx.putImageData(img, 0, 0);

  // 中央にシェブロン（コア方向 = +Y 側）
  ctx.strokeStyle = 'rgba(255,120,80,0.5)';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  for (const yy of [70, 160]) {
    ctx.beginPath();
    ctx.moveTo(size * 0.28, yy + 40);
    ctx.lineTo(size * 0.5, yy - 12);
    ctx.lineTo(size * 0.72, yy + 40);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,190,120,0.22)';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 0, size - 12, size);
  return finish(c, 1);
}

/** 金属パネル */
export function panelTexture(repeat: number, base = '#4a5468', line = '#232a38'): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = line;
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.6;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i * size) / 4);
    ctx.lineTo(size, (i * size) / 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  for (let i = 0; i < 900; i++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  return finish(c, repeat);
}
