import { LitElement, html } from 'lit';
import { pageStyles } from './page-styles.js';

export class NotFoundPage extends LitElement {
  static styles = pageStyles;

  render() {
    return html`
      <section>
        <span class="eyebrow">Error 404</span>
        <h1>Página no encontrada</h1>
        <p>La dirección no corresponde con una página de esta galería.</p>
      </section>
    `;
  }
}

customElements.define('not-found-page', NotFoundPage);
