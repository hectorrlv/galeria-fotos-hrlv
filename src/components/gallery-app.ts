import { Router } from '@lit-labs/router';
import { LitElement, css, html } from 'lit';
import { getFirebaseServices } from '../firebase/client.js';
import { publicNavigation } from '../navigation/routes.js';
import { themeStyles } from '../styles/tokens.js';
import '../pages/about-page.js';
import '../pages/admin-page.js';
import '../pages/album-page.js';
import '../pages/albums-page.js';
import '../pages/home-page.js';
import '../pages/not-found-page.js';

export class GalleryApp extends LitElement {
  private readonly routes = new Router(this, [
    { path: '/', render: () => html`<home-page></home-page>` },
    { path: '/albumes', render: () => html`<albums-page></albums-page>` },
    {
      path: '/album/:slug',
      render: params => html`<album-page .slug=${params.slug}></album-page>`,
    },
    { path: '/acerca-de', render: () => html`<about-page></about-page>` },
    { path: '/admin', render: () => html`<admin-page></admin-page>` },
    { path: '/*', render: () => html`<not-found-page></not-found-page>` },
  ]);

  private readonly firebase = getFirebaseServices();

  static styles = [
    themeStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
      }

      .skip-link {
        position: fixed;
        top: 0.5rem;
        left: 0.5rem;
        z-index: 200;
        padding: 0.7rem 1rem;
        color: #111;
        background: #fff;
        transform: translateY(-150%);
      }

      .skip-link:focus {
        transform: translateY(0);
      }

      header {
        position: sticky;
        top: 0;
        z-index: 10;
        border-bottom: 1px solid
          color-mix(in srgb, var(--color-border) 70%, transparent);
        background: color-mix(
          in srgb,
          var(--color-background) 88%,
          transparent
        );
        backdrop-filter: blur(1rem);
      }

      .header-inner,
      main {
        width: min(100%, var(--content-width));
        margin-inline: auto;
        padding-inline: var(--space-page);
      }

      .header-inner {
        min-height: 4.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 2rem;
      }

      .brand {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 1.15rem;
        text-decoration: none;
      }

      nav ul {
        display: flex;
        flex-wrap: wrap;
        gap: clamp(0.75rem, 3vw, 2rem);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      details {
        display: none;
      }

      nav a {
        color: var(--color-text-muted);
        font-size: 0.88rem;
        text-decoration: none;
      }

      nav a:hover,
      nav a:focus-visible,
      .brand:focus-visible {
        color: var(--color-text);
      }

      nav a:focus-visible,
      .brand:focus-visible {
        border-radius: 0.2rem;
        outline: 2px solid var(--color-accent);
        outline-offset: 0.35rem;
      }

      .mode {
        position: fixed;
        right: 0.75rem;
        bottom: 0.75rem;
        margin: 0;
        padding: 0.45rem 0.65rem;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        color: var(--color-text-muted);
        background: var(--color-surface);
        font-size: 0.7rem;
      }

      footer {
        width: min(100%, var(--content-width));
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        margin-inline: auto;
        padding: 2rem var(--space-page);
        border-top: 1px solid var(--color-border);
        color: var(--color-text-muted);
        font-size: 0.8rem;
      }

      @media (max-width: 42rem) {
        .header-inner {
          min-height: 4.5rem;
        }

        .desktop-nav {
          display: none;
        }

        details {
          position: relative;
          display: block;
        }

        summary {
          cursor: pointer;
        }

        details nav {
          position: absolute;
          top: 2.2rem;
          right: 0;
          min-width: 12rem;
          padding: 1rem;
          border: 1px solid var(--color-border);
          border-radius: 0.3rem;
          background: var(--color-surface);
        }

        details nav ul {
          align-items: flex-end;
          flex-direction: column;
        }
      }
    `,
  ];

  render() {
    return html`
      <a class="skip-link" href="#content">Saltar al contenido</a>
      <header>
        <div class="header-inner">
          <a class="brand" href="/">Galería HRLV</a>
          <nav class="desktop-nav" aria-label="Navegación principal">
            <ul>
              ${publicNavigation.map(
                item => html`<li><a href=${item.path}>${item.label}</a></li>`,
              )}
            </ul>
          </nav>
          <details>
            <summary>Menú</summary>
            <nav aria-label="Navegación móvil">
              <ul>
                ${publicNavigation.map(
                  item => html`<li><a href=${item.path}>${item.label}</a></li>`,
                )}
              </ul>
            </nav>
          </details>
        </div>
      </header>
      <main id="content" tabindex="-1">${this.routes.outlet()}</main>
      <footer>
        <span>Galería HRLV</span>
        <span>Fotografías y relatos de viaje</span>
      </footer>
      ${
        this.firebase
          ? ''
          : html`<p class="mode" role="status">Modo de demostración</p>`
      }
    `;
  }
}

customElements.define('gallery-app', GalleryApp);
