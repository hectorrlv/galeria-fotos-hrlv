import { LitElement, css, html } from 'lit';
import {
  photoLikes,
  type PhotoLikesClient,
  type PhotoLikeState,
} from '../firebase/photo-likes-service.js';

export class PhotoLike extends LitElement {
  static properties = {
    photoId: { type: String, attribute: 'photo-id' },
    albumId: { type: String, attribute: 'album-id' },
    service: { attribute: false },
  };

  declare photoId: string;
  declare albumId: string;
  declare service: PhotoLikesClient;
  private unsubscribe?: () => void;
  private state: PhotoLikeState = {
    count: null,
    liked: false,
    pending: false,
    ready: false,
    error: '',
  };

  static styles = css`
    :host {
      display: inline-grid;
      justify-items: start;
      gap: 0.25rem;
    }
    button {
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      padding: 0.45rem 0.75rem;
      border: 1px solid currentColor;
      border-radius: 2rem;
      background: var(--color-surface, #20201d);
      color: var(--color-text, #f8f5ed);
      cursor: pointer;
      font: inherit;
      font-size: 0.9rem;
      font-variant-numeric: tabular-nums;
    }
    button[aria-pressed='true'] {
      color: #ff9daf;
    }
    button:disabled {
      cursor: default;
      opacity: 0.65;
    }
    button:focus-visible {
      outline: 3px solid var(--color-accent, #e9c990);
      outline-offset: 3px;
    }
    svg {
      width: 1.15rem;
      height: 1.15rem;
      flex: none;
    }
    .feedback {
      max-width: 18rem;
      color: var(--color-text-muted, #bbb7ae);
      background: var(--color-surface, #20201d);
      font-size: 0.78rem;
      border-radius: 0.2rem;
      padding: 0.25rem;
    }
    .feedback:empty {
      display: none;
    }
  `;

  constructor() {
    super();
    this.photoId = '';
    this.albumId = '';
    this.service = photoLikes;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) this.subscribe();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    super.disconnectedCallback();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('photoId') || changed.has('service')) this.subscribe();
  }

  private subscribe() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (!this.isConnected || !this.photoId) return;
    this.unsubscribe = this.service.observe(this.photoId, state => {
      this.state = state;
      this.requestUpdate();
    });
  }

  render() {
    return html`
      <button
        type="button"
        aria-label=${this.state.liked ? 'Quitar me gusta' : 'Me gusta'}
        aria-pressed=${String(this.state.liked)}
        aria-busy=${String(this.state.pending)}
        aria-describedby="like-count"
        ?disabled=${!this.state.ready || this.state.pending}
        @click=${this.toggle}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill=${this.state.liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          stroke-width="1.8"
        >
          <path
            d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
          />
        </svg>
        <span id="like-count"
          >${this.state.count === null ? '—' : this.state.count.toLocaleString('es-MX')}</span
        >
      </button>
      <span class="feedback" role="status"
        >${this.state.pending ? 'Guardando…' : this.state.error}</span
      >
    `;
  }

  private async toggle() {
    if (!this.state.ready || this.state.pending) return;
    try {
      await this.service.setLiked(
        this.photoId,
        this.albumId,
        !this.state.liked,
      );
    } catch {
      // The shared service restores Firebase's confirmed state and reports errors.
    }
  }
}

customElements.define('photo-like', PhotoLike);
