/* Input: touch pedals + keyboard. Exports instantaneous throttle/brake state. */

export class Input {
  constructor(targetEl) {
    this.gas = false;
    this.brake = false;
    this._gasTouches = new Set();
    this._brakeTouches = new Set();
    this.onFirstTouch = null;   // for audio unlock
    this.onAny = null;          // () => void, used to dismiss tutorial

    this._bindKeyboard();
  }

  attachPedals(gasEl, brakeEl) {
    const hook = (el, set, key) => {
      const down = (e) => {
        e.preventDefault();
        if (e.pointerId !== undefined) set.add(e.pointerId); else set.add('mouse');
        el.classList.add('pressed');
        this._eval(); this._touched();
      };
      const up = (e) => {
        if (e.pointerId !== undefined) set.delete(e.pointerId); else set.delete('mouse');
        if (set.size === 0) el.classList.remove('pressed');
        this._eval();
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', (e) => {
        // slide between pedals keeps press if pointer started there
        if (!set.has(e.pointerId ?? 'mouse')) return;
        const r = el.getBoundingClientRect();
        const inside = e.clientX >= r.left - 24 && e.clientX <= r.right + 24 && e.clientY >= r.top - 30 && e.clientY <= r.bottom + 30;
        if (!inside) up(e);
      });
      window.addEventListener('pointerup', (e) => up(e));
      window.addEventListener('pointercancel', (e) => up(e));
    };
    hook(gasEl, this._gasTouches, 'gas');
    hook(brakeEl, this._brakeTouches, 'brake');
  }

  _bindKeyboard() {
    const keys = new Set();
    const map = {
      ArrowRight: 'gas', KeyD: 'gas', ArrowUp: 'gas', KeyW: 'gas',
      ArrowLeft: 'brake', KeyA: 'brake', ArrowDown: 'brake', KeyS: 'brake',
    };
    window.addEventListener('keydown', (e) => {
      const a = map[e.code]; if (!a) return;
      if (keys.size === 0 && !this.gas && !this.brake) this._touched();
      keys.add(a); this._eval();
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const a = map[e.code]; if (!a) return;
      keys.delete(a); this._eval();
    });
    this._keys = keys;
  }

  _eval() {
    this.gas = this._gasTouches.size > 0 || this._keys.has('gas');
    this.brake = this._brakeTouches.size > 0 || this._keys.has('brake');
  }

  _touched() {
    if (this.onFirstTouch) { this.onFirstTouch(); this.onFirstTouch = null; }
    if (this.onAny) this.onAny();
  }
}
