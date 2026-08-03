import { LitElement, html } from 'lit';
import { pageStyles } from './page-styles.js';

export class AlbumPage extends LitElement {
  static properties = {
    slug: { type: String },
  };

  static styles = pageStyles;

  declare slug: string;

  constructor() {
    super();
    this.slug = '';
  }

  render() {
    return html`
      <section>
        <span class="eyebrow">Álbum</span>
        <h1>${this.slug || 'Viaje'}</h1>
        <p>
          Esta ruta alojará la portada, el relato y la cuadrícula justificada de
          fotografías.
        </p>
      </section>
    `;
  }
}

customElements.define('album-page', AlbumPage);
