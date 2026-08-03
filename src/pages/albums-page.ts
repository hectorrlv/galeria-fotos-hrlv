import { LitElement, html } from 'lit';
import { pageStyles } from './page-styles.js';

export class AlbumsPage extends LitElement {
  static styles = pageStyles;

  render() {
    return html`
      <section>
        <span class="eyebrow">Explorar</span>
        <h1>Álbumes</h1>
        <p>
          Aquí aparecerán las portadas y los filtros por año, país y tipo de
          paseo.
        </p>
      </section>
    `;
  }
}

customElements.define('albums-page', AlbumsPage);
