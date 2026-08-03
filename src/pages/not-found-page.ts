import { LitElement, html } from 'lit';
import { pageStyles } from './page-styles.js';

export class NotFoundPage extends LitElement {
  static styles = pageStyles;

  render() {
    return html`
      <div class="page">
        <section class="intro">
          <span class="eyebrow">Error 404</span>
          <h1>Página no encontrada</h1>
          <p>La dirección no corresponde con una página de esta galería.</p>
        </section>
      </div>
    `;
  }
}

customElements.define('not-found-page', NotFoundPage);
