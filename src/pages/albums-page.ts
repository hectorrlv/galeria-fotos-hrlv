import { LitElement, css, html } from 'lit';
import '../components/album-card.js';
import { GalleryRepository } from '../firebase/gallery-repository.js';
import type { Album } from '../models/gallery.js';
import { sortAlbums, type AlbumSortOrder } from '../models/album-order.js';
import { pageStyles } from './page-styles.js';

export class AlbumsPage extends LitElement {
  private readonly repository = new GalleryRepository();
  private albums: Album[] = [];
  private loading = true;
  private year = '';
  private country = '';
  private category = '';
  private sort: AlbumSortOrder = 'date-desc';
  private unsubscribe?: () => void;

  static styles = [
    pageStyles,
    css`
      .filters {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
        padding: 1rem;
        border: 1px solid var(--color-border);
        border-radius: 0.4rem;
        background: var(--color-surface);
      }

      label {
        display: grid;
        gap: 0.4rem;
        color: var(--color-text-muted);
        font-size: 0.8rem;
      }

      select {
        min-width: 0;
        min-height: 2.8rem;
        padding-inline: 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 0.25rem;
        color: var(--color-text);
        background: var(--color-background);
      }

      @media (max-width: 60rem) {
        .filters {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 40rem) {
        .filters {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    const params = new URLSearchParams(window.location.search);
    this.year = params.get('year') ?? '';
    this.country = params.get('country') ?? '';
    this.category = params.get('category') ?? '';
    this.sort = params.get('sort') === 'date-asc' ? 'date-asc' : 'date-desc';
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
    const years = this.options(album => album.startDate.slice(0, 4));
    const countries = this.options(album => album.country);
    const categories = this.options(album => album.category);
    const filtered = sortAlbums(this.albums, this.sort).filter(
      album =>
        (!this.year || album.startDate.startsWith(this.year)) &&
        (!this.country || album.country === this.country) &&
        (!this.category || album.category === this.category),
    );
    return html`
      <div class="page">
        <section class="intro">
          <span class="eyebrow">Explorar</span>
          <h1>Álbumes</h1>
          <p class="lead">
            Historias agrupadas por viaje, lugar y momento. Usa los filtros para
            volver a una ruta concreta.
          </p>
        </section>
        <section aria-label="Filtros de álbumes">
          <div class="filters">
            ${this.filterSelect('Año', 'year', this.year, years)}
            ${this.filterSelect('País', 'country', this.country, countries)}
            ${this.filterSelect(
              'Tipo de paseo',
              'category',
              this.category,
              categories,
            )}
            <label>
              Orden
              <select
                name="sort"
                aria-label="Orden"
                .value=${this.sort}
                @change=${this.handleFilter}
              >
                <option
                  value="date-desc"
                  ?selected=${this.sort === 'date-desc'}
                >
                  Viajes más recientes
                </option>
                <option value="date-asc" ?selected=${this.sort === 'date-asc'}>
                  Viajes más antiguos
                </option>
              </select>
            </label>
          </div>
        </section>
        ${
          this.loading
            ? html`<p role="status">Cargando álbumes…</p>`
            : filtered.length
              ? html`<section class="cards">
                  ${filtered.map(
                    album => html`<album-card .album=${album}></album-card>`,
                  )}
                </section>`
              : html`<section class="empty">
                  <h2>No hay álbumes para estos filtros</h2>
                  <p>Prueba otra combinación o vuelve a mostrar todos.</p>
                </section>`
        }
      </div>
    `;
  }

  private options(read: (album: Album) => string): string[] {
    return [...new Set(this.albums.map(read).filter(Boolean))].sort();
  }

  private filterSelect(
    label: string,
    name: 'year' | 'country' | 'category',
    value: string,
    options: readonly string[],
  ) {
    return html`<label>
      ${label}
      <select
        name=${name}
        aria-label=${label}
        .value=${value}
        @change=${this.handleFilter}
      >
        <option value="" ?selected=${!value}>Todos</option>
        ${options.map(option => html`<option value=${option} ?selected=${value === option}>${option}</option>`)}
      </select>
    </label>`;
  }

  private readonly handleFilter = (event: Event) => {
    const select = event.currentTarget as HTMLSelectElement;
    if (select.name === 'year') this.year = select.value;
    if (select.name === 'country') this.country = select.value;
    if (select.name === 'category') this.category = select.value;
    if (select.name === 'sort')
      this.sort = select.value === 'date-asc' ? 'date-asc' : 'date-desc';
    const params = new URLSearchParams();
    if (this.year) params.set('year', this.year);
    if (this.country) params.set('country', this.country);
    if (this.category) params.set('category', this.category);
    if (this.sort === 'date-asc') params.set('sort', this.sort);
    const query = params.toString();
    window.history.replaceState({}, '', `/albumes${query ? `?${query}` : ''}`);
    this.requestUpdate();
  };
}

customElements.define('albums-page', AlbumsPage);
