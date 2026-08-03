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
  private pointerStartX: number | null = null;

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
      grid-template: auto minmax(0, 1fr) auto / auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.75rem;
      overflow: hidden;
      padding: max(clamp(0.75rem, 2vw, 1.5rem), env(safe-area-inset-top))
        max(clamp(0.75rem, 2vw, 1.5rem), env(safe-area-inset-right))
        max(clamp(0.75rem, 2vw, 1.5rem), env(safe-area-inset-bottom))
        max(clamp(0.75rem, 2vw, 1.5rem), env(safe-area-inset-left));
    }

    .close {
      grid-column: 3;
      justify-self: end;
    }

    figure {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      grid-area: 2 / 2;
      display: grid;
      place-items: center;
      overflow: hidden;
      margin: 0;
    }

    img {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      display: block;
      object-fit: contain;
      user-select: none;
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

    .previous {
      grid-area: 2 / 1;
    }

    .next {
      grid-area: 2 / 3;
    }

    .caption {
      grid-area: 3 / 2;
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
        grid-template-columns: auto minmax(0, 1fr) auto;
      }

      .previous,
      .next {
        align-self: end;
        margin-bottom: 3.5rem;
      }

      .caption {
        grid-column: 1 / -1;
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
    super.disconnectedCallback();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('open')) {
      document.documentElement.style.overflow = this.open ? 'hidden' : '';
      if (this.open) {
        requestAnimationFrame(() =>
          this.renderRoot.querySelector<HTMLButtonElement>('.close')?.focus(),
        );
      }
    }
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
        @pointerdown=${(event: PointerEvent) => {
          this.pointerStartX = event.clientX;
        }}
        @pointerup=${this.handlePointerUp}
      >
        <button class="close" @click=${this.close} aria-label="Cerrar visor">
          ×
        </button>
        <button
          class="previous"
          @click=${() => this.move(-1)}
          aria-label="Fotografía anterior"
        >
          ‹
        </button>
        <figure>
          <img src=${photo.urls.viewer} alt=${photo.altText} />
        </figure>
        <button
          class="next"
          @click=${() => this.move(1)}
          aria-label="Fotografía siguiente"
        >
          ›
        </button>
        <div class="caption" aria-live="polite">
          <p>${photo.caption || photo.location}</p>
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
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (this.pointerStartX === null) return;
    const distance = event.clientX - this.pointerStartX;
    this.pointerStartX = null;
    if (Math.abs(distance) > 50) this.move(distance > 0 ? -1 : 1);
  };

  private move(direction: number) {
    if (this.photos.length === 0) return;
    this.index =
      (this.index + direction + this.photos.length) % this.photos.length;
    this.requestUpdate();
  }

  private readonly close = () => {
    this.open = false;
    this.dispatchEvent(new CustomEvent('viewer-close'));
  };
}

customElements.define('photo-viewer', PhotoViewer);
