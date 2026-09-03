/** キーボード／マウス入力とポインタロックの管理 */
export class Input {
  private keys = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private canvas: HTMLElement;

  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  buttons = [false, false, false];
  buttonPressed = [false, false, false];
  pointerLocked = false;
  /** ビルドモード用：正規化デバイス座標 */
  ndcX = 0;
  ndcY = 0;
  clientX = 0;
  clientY = 0;
  onPointerLockChange: ((locked: boolean) => void) | null = null;

  private handlers: Array<[EventTarget, string, EventListener]> = [];

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    this.on(window, 'keydown', (e) => {
      const ev = e as KeyboardEvent;
      if (ev.repeat) return;
      // ブラウザ既定動作の抑制（スクロール等）
      if (['Space', 'Tab', 'KeyR', 'F1'].includes(ev.code)) ev.preventDefault();
      this.keys.add(ev.code);
      this.pressedThisFrame.add(ev.code);
    });
    this.on(window, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).code));
    this.on(window, 'blur', () => {
      this.keys.clear();
      this.buttons = [false, false, false];
    });
    this.on(document, 'mousemove', (e) => {
      const ev = e as MouseEvent;
      if (this.pointerLocked) {
        this.mouseDX += ev.movementX;
        this.mouseDY += ev.movementY;
      }
      const rect = this.canvas.getBoundingClientRect();
      this.clientX = ev.clientX;
      this.clientY = ev.clientY;
      this.ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this.ndcY = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    });
    this.on(window, 'mousedown', (e) => {
      const b = (e as MouseEvent).button;
      if (b < 3) {
        this.buttons[b] = true;
        this.buttonPressed[b] = true;
      }
    });
    this.on(window, 'mouseup', (e) => {
      const b = (e as MouseEvent).button;
      if (b < 3) this.buttons[b] = false;
    });
    this.on(window, 'wheel', (e) => {
      this.wheel += (e as WheelEvent).deltaY;
    });
    this.on(window, 'contextmenu', (e) => e.preventDefault());
    this.on(document, 'pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      this.mouseDX = 0;
      this.mouseDY = 0;
      this.onPointerLockChange?.(this.pointerLocked);
    });
  }

  private on(target: EventTarget, type: string, fn: EventListener) {
    const wrapped = fn as EventListener;
    target.addEventListener(type, wrapped, type === 'wheel' ? { passive: true } : undefined);
    this.handlers.push([target, type, wrapped]);
  }

  isDown(code: string) {
    return this.keys.has(code);
  }

  wasPressed(code: string) {
    return this.pressedThisFrame.has(code);
  }

  axis(neg: string, pos: string) {
    return (this.isDown(pos) ? 1 : 0) - (this.isDown(neg) ? 1 : 0);
  }

  requestLock() {
    if (!this.pointerLocked) {
      const el = this.canvas as HTMLElement & { requestPointerLock: (o?: object) => void };
      el.requestPointerLock?.();
    }
  }

  exitLock() {
    if (this.pointerLocked) document.exitPointerLock();
  }

  /** 毎フレーム末尾で呼ぶ */
  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.pressedThisFrame.clear();
    this.buttonPressed = [false, false, false];
  }

  dispose() {
    for (const [t, type, fn] of this.handlers) t.removeEventListener(type, fn);
    this.handlers = [];
  }
}
