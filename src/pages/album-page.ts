import { LitElement, css, html } from 'lit';
import '../components/album-card.js';
import '../components/photo-viewer.js';
import { GalleryRepository } from '../firebase/gallery-repository.js';
import { albumCover, orderedPhotos, type Album } from '../models/gallery.js';
import { albumPath } from '../navigation/routes.js';
import type { PhotoViewer } from '../components/photo-viewer.js';
import { pageStyles } from './page-styles.js';

export class AlbumPage extends LitElement {
  static properties = {
    slug: { type: String },
  };

  declare slug: string;
  private readonly repository = new GalleryRepository();
  private albums: Album[] = [];
  private loading = true;
  private viewerIndex = 0;
  private unsubscribe?: () => void;

  static styles = [
    pageStyles,
    css`
      .cover {
        position: relative;
        min-height: min(75vh, 50rem);
        display: grid;
        align-content: end;
        overflow: hidden;
        margin-inline: calc(var(--space-page) * -1);
        padding: clamp(2rem, 7vw, 6rem) var(--space-page);
        isolation: isolate;
      }

      .cover::before,
      .cover::after {
        position: absolute;
        inset: 0;
        z-index: -1;
        content: '';
      }

      .cover::before {
        background: var(--cover-image) center / cover;
      }

      .cover::after {
        background: linear-gradient(
          to top,
          rgba(5, 5, 5, 0.95),
          transparent 75%
        );
      }

      .cover-content {
        display: grid;
        gap: 1rem;
      }

      .story {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.55fr);
        gap: clamp(2rem, 7vw, 6rem);
      }

      .facts {
        display: grid;
        align-content: start;
        gap: 0.65rem;
        margin: 0;
      }

      .facts div {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding-block: 0.65rem;
        border-bottom: 1px solid var(--color-border);
      }

      dt {
        color: var(--color-text-muted);
      }

      dd {
        margin: 0;
        text-align: right;
      }

      .photos {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .photo {
        min-width: min(100%, 14rem);
        flex: var(--ratio) 1 18rem;
        overflow: hidden;
        padding: 0;
        border: 0;
        border-radius: 0.2rem;
        background: var(--color-surface);
        cursor: zoom-in;
      }

      .photo img {
        width: 100%;
        height: 15rem;
        display: block;
        object-fit: cover;
        transition:
          transform 350ms ease,
          opacity 350ms ease;
      }

      .photo:hover img,
      .photo:focus-visible img {
        transform: scale(1.02);
        opacity: 0.92;
      }

      .photo:focus-visible {
        outline: 3px solid var(--color-accent);
        outline-offset: 0.2rem;
      }

      .album-navigation {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .album-navigation a {
        padding: 1.25rem;
        border: 1px solid var(--color-border);
        border-radius: 0.3rem;
        color: var(--color-accent);
        font-weight: 700;
        text-decoration: none;
      }

      .album-navigation a:hover {
        color: var(--color-text);
        text-decoration: underline;
        text-decoration-thickness: 0.12em;
        text-underline-offset: 0.18em;
      }

      .album-navigation a:focus,
      .album-navigation a:focus-visible {
        outline: 3px solid var(--color-accent);
        outline-offset: 0.2rem;
        text-decoration: underline;
        text-decoration-thickness: 0.12em;
        text-underline-offset: 0.18em;
      }

      .album-navigation a:last-child {
        text-align: right;
      }

      @media (max-width: 44rem) {
        .story {
          grid-template-columns: 1fr;
        }

        .photo {
          min-width: 100%;
        }

        .photo img {
          height: auto;
        }
      }
    `,
  ];

  constructor() {
    super();
    this.slug = '';
  }

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = this.repository.subscribePublicAlbums(albums => {
      this.albums = albums;
      this.loading = false;
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    super.disconnectedCallback();
  }

  render() {
    const decodedSlug = decodeURIComponent(this.slug || 'viaje');
    const album = this.albums.find(item => item.slug === decodedSlug);
    if (!album) {
      return html`<div class="page">
        <section class="intro">
          <span class="eyebrow">Álbum</span>
          <h1>${decodedSlug}</h1>
          <p class="lead">
            ${
              this.loading
                ? 'Cargando este viaje…'
                : 'Este álbum todavía no está publicado.'
            }
          </p>
        </section>
      </div>`;
    }
    const photos = orderedPhotos(album).filter(photo => photo.visible);
    const cover = albumCover(album);
    const currentIndex = this.albums.findIndex(item => item.id === album.id);
    const previous = this.albums[currentIndex + 1];
    const next = this.albums[currentIndex - 1];
    const related = this.albums
      .filter(
        item =>
          item.id !== album.id &&
          (item.country === album.country ||
            item.startDate.slice(0, 4) === album.startDate.slice(0, 4)),
      )
      .slice(0, 3);

    return html`<div class="page">
      <section
        class="cover"
        style=${
          cover?.urls.viewer
            ? `--cover-image: url("${cover.urls.viewer}")`
            : '--cover-image: linear-gradient(135deg, #343026, #11110f)'
        }
      >
        <div class="cover-content">
          <span class="eyebrow">${album.category || 'Viaje'}</span>
          <h1>${album.title}</h1>
          <p class="lead">
            ${[album.location, album.country, this.dateRange(album)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </section>

      <section class="story">
        <div>
          <span class="eyebrow">La historia</span>
          <h2>${album.title}</h2>
          <p class="lead">${album.description}</p>
        </div>
        <dl class="facts">
          <div>
            <dt>Lugar</dt>
            <dd>${album.location || '—'}</dd>
          </div>
          <div>
            <dt>País</dt>
            <dd>${album.country || '—'}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>${this.dateRange(album) || '—'}</dd>
          </div>
          <div>
            <dt>Fotografías</dt>
            <dd>${photos.length}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Fotografías del álbum">
        <div class="photos">
          ${photos.map(
            (photo, index) =>
              html`<button
                class="photo"
                style=${`--ratio: ${Math.max(0.65, photo.width / photo.height)}`}
                @click=${() => this.openViewer(index)}
                aria-label=${`Abrir fotografía ${index + 1}: ${photo.altText}`}
              >
                <img
                  src=${photo.urls.grid}
                  alt=${photo.altText}
                  loading="lazy"
                  width=${photo.width}
                  height=${photo.height}
                />
              </button>`,
          )}
        </div>
      </section>

      ${
        previous || next
          ? html`<nav class="album-navigation" aria-label="Otros viajes">
              ${
                previous
                  ? html`<a href=${albumPath(previous.slug)}
                      >← ${previous.title}</a
                    >`
                  : html`<span></span>`
              }
              ${
                next
                  ? html`<a href=${albumPath(next.slug)}>${next.title} →</a>`
                  : ''
              }
            </nav>`
          : ''
      }
      ${
        related.length
          ? html`<section>
              <div class="section-heading"><h2>Viajes relacionados</h2></div>
              <div class="cards">
                ${related.map(
                  item => html`<album-card .album=${item}></album-card>`,
                )}
              </div>
            </section>`
          : ''
      }
      <photo-viewer .photos=${photos} .index=${this.viewerIndex}></photo-viewer>
    </div>`;
  }

  private dateRange(album: Album): string {
    if (!album.startDate) return '';
    const format = (value: string) =>
      new Intl.DateTimeFormat('es-MX', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${value}T00:00:00Z`));
    if (!album.endDate || album.endDate === album.startDate)
      return format(album.startDate);
    return `${format(album.startDate)} – ${format(album.endDate)}`;
  }

  private openViewer(index: number) {
    this.viewerIndex = index;
    const viewer = this.renderRoot.querySelector<PhotoViewer>('photo-viewer');
    if (viewer) {
      viewer.index = index;
      viewer.open = true;
    }
  }
}

customElements.define('album-page', AlbumPage);
