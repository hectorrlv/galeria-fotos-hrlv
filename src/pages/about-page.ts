import { LitElement, html } from 'lit';
import { pageStyles } from './page-styles.js';

export class AboutPage extends LitElement {
  static styles = pageStyles;

  render() {
    return html`
      <section>
        <span class="eyebrow">El proyecto</span>
        <h1>Acerca de</h1>
        <p>
          Este espacio contará la historia de la galería y de la persona detrás
          de las fotografías.
        </p>
      </section>
    `;
  }
}

customElements.define('about-page', AboutPage);
