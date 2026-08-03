import { LitElement, css, html } from 'lit';
import '../components/album-card.js';
import { GalleryRepository } from '../firebase/gallery-repository.js';
import {
  albumCover,
  DEFAULT_SITE_CONFIG,
  type Album,
  type SiteConfig,
} from '../models/gallery.js';
import { albumPath } from '../navigation/routes.js';
import { pageStyles } from './page-styles.js';

export class HomePage extends LitElement {
  private readonly repository = new GalleryRepository();
  private albums: Album[] = [];
  private site: SiteConfig = { ...DEFAULT_SITE_CONFIG };
  private loading = true;
  private error = '';
  private unsubscribeAlbums?: () => void;
  private unsubscribeSite?: () => void;

  static styles = [
    pageStyles,
    css`
      .hero {
        position: relative;
        min-height: min(78vh, 50rem);
        display: grid;
        align-content: end;
        overflow: hidden;
        margin-inline: calc(var(--space-page) * -1);
        padding: clamp(2rem, 7vw, 6rem) var(--space-page);
        border-radius: 0 0 0.5rem 0.5rem;
        isolation: isolate;
      }

      .hero::before,
      .hero::after {
        position: absolute;
        inset: 0;
        z-index: -1;
        content: '';
      }

      .hero::before {
        background-image: var(--hero-image);
        background-position: center;
        background-size: cover;
        transform: scale(1.01);
      }

      .hero::after {
        background: linear-gradient(
          to top,
          rgba(8, 8, 7, 0.94),
          rgba(8, 8, 7, 0.16) 70%
        );
      }

      .hero-content {
        display: grid;
        gap: 1rem;
      }

      .hero h1 {
        color: #fffdf5;
      }

      .hero a {
        width: fit-content;
        margin-top: 0.5rem;
        color: #fff;
        text-underline-offset: 0.3rem;
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
      }

      .filters a {
        padding: 0.55rem 0.8rem;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        color: var(--color-text-muted);
        text-decoration: none;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribeAlbums = this.repository.subscribePublicAlbums(
      albums => {
        this.albums = albums;
        this.loading = false;
        this.requestUpdate();
      },
      error => {
        this.error = error.message;
        this.loading = false;
        this.requestUpdate();
      },
    );
    this.unsubscribeSite = this.repository.subscribeSiteConfig(false, site => {
      this.site = site;
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    this.unsubscribeAlbums?.();
    this.unsubscribeSite?.();
    super.disconnectedCallback();
  }

  render() {
    const featured =
      this.albums.find(album => album.featured) ?? this.albums[0];
    const cover = featured ? albumCover(featured) : undefined;
    const recent = this.albums
      .filter(album => album.id !== featured?.id)
      .slice(0, 6);
    const years = [
      ...new Set(this.albums.map(album => album.startDate.slice(0, 4))),
    ]
      .filter(Boolean)
      .slice(0, 6);

    return html`
      <div class="page">
        <section
          class="hero"
          style=${
            cover?.urls.viewer
              ? `--hero-image: url("${cover.urls.viewer}")`
              : '--hero-image: linear-gradient(135deg, #343026, #11110f 62%)'
          }
        >
          <div class="hero-content">
            <span class="eyebrow">Galería fotográfica</span>
            <h1>${featured?.title || 'Viajes, paseos y momentos.'}</h1>
            <p class="lead">
              ${featured?.description || this.site.introduction}
            </p>
            ${
              featured
                ? html`<a href=${albumPath(featured.slug)}
                    >Explorar este viaje</a
                  >`
                : ''
            }
          </div>
        </section>

        ${
          this.error
            ? html`<p class="error">
                No fue posible cargar la galería: ${this.error}
              </p>`
            : ''
        }
        ${
          this.loading
            ? html`<p role="status">Cargando álbumes…</p>`
            : this.albums.length === 0
              ? html`<section class="empty">
                  <h2>La primera historia está por comenzar</h2>
                  <p>
                    Cuando publiques un álbum desde el estudio privado aparecerá
                    aquí como viaje destacado.
                  </p>
                </section>`
              : html`
                  <section>
                    <div class="section-heading">
                      <h2>Viajes recientes</h2>
                      <a class="text-link" href="/albumes">Ver todos</a>
                    </div>
                    <div class="cards">
                      ${recent.map(
                        album =>
                          html`<album-card .album=${album}></album-card>`,
                      )}
                    </div>
                  </section>
                  ${
                    years.length
                      ? html`<section>
                          <div class="section-heading">
                            <h2>Explorar por año</h2>
                          </div>
                          <div class="filters">
                            ${years.map(
                              year =>
                                html`<a href=${`/albumes?year=${year}`}
                                  >${year}</a
                                >`,
                            )}
                          </div>
                        </section>`
                      : ''
                  }
                `
        }
      </div>
    `;
  }
}

customElements.define('home-page', HomePage);
