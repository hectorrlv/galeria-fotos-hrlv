import { LitElement, css, html } from 'lit';
import { albumCover, type Album } from '../models/gallery.js';
import { albumPath } from '../navigation/routes.js';

export class AlbumCard extends LitElement {
  static properties = {
    album: { attribute: false },
  };

  declare album: Album;

  static styles = css`
    :host {
      display: block;
      min-width: 0;
    }

    article {
      display: grid;
      gap: 1rem;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    .image {
      position: relative;
      overflow: hidden;
      aspect-ratio: 4 / 3;
      border-radius: 0.3rem;
      background:
        linear-gradient(135deg, #2b2a24, #171714 60%), var(--color-surface);
    }

    img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      transition: transform 420ms ease;
    }

    a:hover img,
    a:focus-visible img {
      transform: scale(1.025);
    }

    a:focus-visible {
      border-radius: 0.3rem;
      outline: 2px solid var(--color-accent);
      outline-offset: 0.35rem;
    }

    .meta {
      display: grid;
      gap: 0.35rem;
    }

    h2 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: clamp(1.45rem, 3vw, 2rem);
      font-weight: 400;
      line-height: 1.05;
    }

    p {
      margin: 0;
      color: var(--color-text-muted);
      font-size: 0.86rem;
      letter-spacing: 0.04em;
    }
  `;

  constructor() {
    super();
    this.album = {} as Album;
  }

  render() {
    const cover = albumCover(this.album);
    const year = this.album.startDate.slice(0, 4);
    const count = this.album.photoOrder.filter(
      id => this.album.photos[id]?.visible,
    ).length;
    return html`
      <article>
        <a href=${albumPath(this.album.slug)} aria-label=${this.album.title}>
          <div class="image">
            ${
              cover?.urls.grid
                ? html`<img
                    src=${cover.urls.grid}
                    alt=${cover.altText || `Portada de ${this.album.title}`}
                    loading="lazy"
                  />`
                : ''
            }
          </div>
        </a>
        <div class="meta">
          <h2><a href=${albumPath(this.album.slug)}>${this.album.title}</a></h2>
          <p>
            ${[this.album.location, this.album.country, year]
              .filter(Boolean)
              .join(' · ')}
            ${count ? html` · ${count} fotos` : ''}
          </p>
        </div>
      </article>
    `;
  }
}

customElements.define('album-card', AlbumCard);
