import { LitElement, html } from 'lit';
import { firebaseAvailable } from '../firebase/client.js';
import { pageStyles } from './page-styles.js';

export class AdminPage extends LitElement {
  static styles = pageStyles;

  render() {
    return html`
      <section>
        <span class="eyebrow">Estudio privado</span>
        <h1>Administración</h1>
        <p>
          ${
            firebaseAvailable
              ? 'Firebase está configurado para la futura autenticación.'
              : 'Modo de demostración: Firebase todavía no está configurado.'
          }
        </p>
      </section>
    `;
  }
}

customElements.define('admin-page', AdminPage);
