import { LitElement, html } from 'lit';
import { pageStyles } from './page-styles.js';

export class HomePage extends LitElement {
  static styles = pageStyles;

  render() {
    return html`
      <section>
        <span class="eyebrow">Galería fotográfica</span>
        <h1>Viajes, paseos y momentos.</h1>
        <p>
          Esta portada será el punto de entrada al viaje destacado y a los
          álbumes más recientes.
        </p>
      </section>
    `;
  }
}

customElements.define('home-page', HomePage);
