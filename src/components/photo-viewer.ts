import { LitElement, css, html, nothing } from 'lit';
import type { GalleryPhoto } from '../models/gallery.js';

export class PhotoViewer extends LitElement {
  static properties = {
    photos: { attribute: false },
    index: { type: Number },
    open: { type: Boolean, reflect: true },
  };

  declare photos: GalleryPhoto[];
  declare index: number;
  declare open: boolean;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private swipeStart: { x: number; y: number } | null = null;
  private dragStart: {
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null = null;
  private pinchStart: { distance: number; zoom: number } | null = null;
  private lastTapAt = 0;
  private lastTouchZoomAt = 0;

  static styles = css`
    :host {
      display: none;
    }

    :host([open]) {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: block;
      color: #f8f5ed;
      background: rgba(5, 5, 5, 0.97);
    }

    .viewer {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      max-height: 100dvh;
      display: grid;
      grid-template: auto minmax(0, 1fr) auto / minmax(0, 1fr);
      align-items: center;
      gap: 0.75rem;
      overflow: hidden;
      padding: max(clamp(0.75rem, 2vw, 1.5rem), env(safe-area-inset-top))
        max(clamp(0.75rem, 2vw, 1.5rem), env(safe-area-inset-right))
        max(clamp(0.75rem, 2vw, 1.5rem), env(safe-area-inset-bottom))
        max(clamp(0.75rem, 2vw, 1.5rem), env(safe-area-inset-left));
    }

    .close {
      grid-column: 1;
      justify-self: end;
    }

    figure {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      grid-area: 2 / 1;
      display: grid;
      place-items: center;
      overflow: hidden;
      margin: 0;
      touch-action: none;
    }

    img {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      display: block;
      object-fit: contain;
      transform-origin: center;
      user-select: none;
      will-change: transform;
    }

    button {
      width: 2.8rem;
      height: 2.8rem;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      color: inherit;
      background: rgba(20, 20, 20, 0.75);
      cursor: pointer;
      font: inherit;
      font-size: 1.3rem;
    }

    button:hover,
    button:focus-visible {
      border-color: #fff;
      outline: 2px solid #fff;
      outline-offset: 0.2rem;
    }

    .caption {
      grid-area: 3 / 1;
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      max-height: min(30dvh, 10rem);
      align-self: start;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      color: #bbb7ae;
      font-size: 0.86rem;
      overflow: auto;
    }

    .caption p {
      min-width: 0;
      margin: 0;
      overflow-wrap: anywhere;
    }

    .caption p:first-child {
      flex: 1;
    }

    .caption p:last-child {
      flex: none;
    }

    @media (max-width: 40rem) {
      .viewer {
        gap: 0.5rem;
        padding-right: max(0.75rem, env(safe-area-inset-right));
        padding-left: max(0.75rem, env(safe-area-inset-left));
      }

      .caption {
        padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
      }
    }
  `;

  constructor() {
    super();
    this.photos = [];
    this.index = 0;
    this.open = false;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.handleKeydown);
    document.documentElement.style.overflow = '';
    super.disconnectedCallback();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('open')) {
      document.documentElement.style.overflow = this.open ? 'hidden' : '';
      if (this.open) {
        this.resetZoom();
        requestAnimationFrame(() =>
          this.renderRoot.querySelector<HTMLButtonElement>('.close')?.focus(),
        );
      } else {
        this.resetZoom();
      }
    }
    if (changed.has('index')) this.resetZoom();
  }

  render() {
    if (!this.open) return nothing;
    const photo = this.photos[this.index];
    if (!photo) return nothing;
    return html`
      <div
        class="viewer"
        role="dialog"
        aria-modal="true"
        aria-label="Visor de fotografías"
      >
        <button class="close" @click=${this.close} aria-label="Cerrar visor">
          ×
        </button>
        <figure
          @pointerdown=${this.handlePointerDown}
          @pointermove=${this.handlePointerMove}
          @pointerup=${this.handlePointerUp}
          @pointercancel=${this.handlePointerCancel}
          @dblclick=${this.handleDoubleClick}
          @wheel=${this.handleWheel}
        >
          <img
            src=${photo.urls.viewer}
            alt=${photo.altText}
            draggable="false"
            style=${`transform: translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`}
          />
        </figure>
        <div class="caption" aria-live="polite">
          <p>${this.photoDetails(photo)}</p>
          <p>${this.index + 1} / ${this.photos.length}</p>
        </div>
      </div>
    `;
  }

  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (!this.open) return;
    if (event.key === 'Escape') this.close();
    if (event.key === 'ArrowLeft') this.move(-1);
    if (event.key === 'ArrowRight') this.move(1);
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.setZoom(this.zoom + 0.5);
    }
    if (event.key === '-') {
      event.preventDefault();
      this.setZoom(this.zoom - 0.5);
    }
    if (event.key === '0') {
      event.preventDefault();
      this.resetZoom();
    }
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    const figure = event.currentTarget as HTMLElement;
    figure.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 1) {
      this.swipeStart = { x: event.clientX, y: event.clientY };
      this.dragStart = {
        x: event.clientX,
        y: event.clientY,
        panX: this.panX,
        panY: this.panY,
      };
      return;
    }

    if (this.pointers.size === 2) {
      this.pinchStart = { distance: this.pointerDistance(), zoom: this.zoom };
      this.swipeStart = null;
    }
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size >= 2 && this.pinchStart) {
      event.preventDefault();
      this.setZoom(
        this.pinchStart.zoom *
          (this.pointerDistance() / this.pinchStart.distance),
      );
      return;
    }

    if (this.zoom <= 1 || !this.dragStart) return;
    event.preventDefault();
    this.setPan(
      this.dragStart.panX + event.clientX - this.dragStart.x,
      this.dragStart.panY + event.clientY - this.dragStart.y,
    );
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    const start = this.swipeStart;
    const wasPinching = this.pointers.size > 1;
    this.pointers.delete(event.pointerId);

    if (this.pointers.size === 1) {
      const remaining = [...this.pointers.values()][0];
      if (remaining) {
        this.dragStart = {
          x: remaining.x,
          y: remaining.y,
          panX: this.panX,
          panY: this.panY,
        };
      }
    } else {
      this.dragStart = null;
      this.pinchStart = null;
    }

    if (wasPinching || !start || this.zoom > 1) return;
    const distanceX = event.clientX - start.x;
    const distanceY = event.clientY - start.y;
    if (Math.abs(distanceX) > 50 && Math.abs(distanceX) > Math.abs(distanceY)) {
      this.move(distanceX > 0 ? -1 : 1);
      return;
    }

    if (
      event.pointerType !== 'mouse' &&
      Math.hypot(distanceX, distanceY) < 12
    ) {
      const now = Date.now();
      if (now - this.lastTapAt < 300) {
        this.toggleZoom();
        this.lastTapAt = 0;
        this.lastTouchZoomAt = now;
      } else {
        this.lastTapAt = now;
      }
    }
  };

  private readonly handlePointerCancel = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    this.pointers.clear();
    this.swipeStart = null;
    this.dragStart = null;
    this.pinchStart = null;
    this.lastTapAt = 0;
  };

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.setZoom(this.zoom * (event.deltaY < 0 ? 1.15 : 0.85));
  };

  private readonly handleDoubleClick = () => {
    if (Date.now() - this.lastTouchZoomAt < 500) return;
    this.toggleZoom();
  };

  private readonly toggleZoom = () => {
    this.setZoom(this.zoom > 1 ? 1 : 2);
  };

  private move(direction: number) {
    if (this.photos.length === 0) return;
    this.index =
      (this.index + direction + this.photos.length) % this.photos.length;
    this.resetZoom();
    this.requestUpdate();
  }

  private setZoom(value: number) {
    this.zoom = Math.min(4, Math.max(1, value));
    if (this.zoom === 1) {
      this.panX = 0;
      this.panY = 0;
    } else {
      this.setPan(this.panX, this.panY, false);
    }
    this.requestUpdate();
  }

  private setPan(x: number, y: number, requestUpdate = true) {
    const figure = this.renderRoot.querySelector<HTMLElement>('figure');
    const size = this.containedPhotoSize(figure);
    const maxX = figure
      ? Math.max(0, (size.width * this.zoom - figure.clientWidth) / 2)
      : 0;
    const maxY = figure
      ? Math.max(0, (size.height * this.zoom - figure.clientHeight) / 2)
      : 0;
    this.panX = Math.min(maxX, Math.max(-maxX, x));
    this.panY = Math.min(maxY, Math.max(-maxY, y));
    if (requestUpdate) this.requestUpdate();
  }

  private resetZoom() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.pointers.clear();
    this.swipeStart = null;
    this.dragStart = null;
    this.pinchStart = null;
    this.lastTapAt = 0;
    this.lastTouchZoomAt = 0;
    this.requestUpdate();
  }

  private pointerDistance() {
    const [first, second] = [...this.pointers.values()];
    if (!first || !second) return 1;
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  private containedPhotoSize(figure: HTMLElement | null) {
    const photo = this.photos[this.index];
    if (!figure || !photo?.width || !photo.height) {
      return {
        width: figure?.clientWidth ?? 0,
        height: figure?.clientHeight ?? 0,
      };
    }
    const scale = Math.min(
      figure.clientWidth / photo.width,
      figure.clientHeight / photo.height,
    );
    return { width: photo.width * scale, height: photo.height * scale };
  }

  private photoDetails(photo: GalleryPhoto): string {
    const takenAt = photo.takenAt
      ? new Intl.DateTimeFormat('es-MX', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${photo.takenAt}T00:00:00Z`))
      : '';
    return [photo.caption, photo.location, takenAt].filter(Boolean).join(' · ');
  }

  private readonly close = () => {
    this.resetZoom();
    this.open = false;
    this.dispatchEvent(new CustomEvent('viewer-close'));
  };
}

customElements.define('photo-viewer', PhotoViewer);
