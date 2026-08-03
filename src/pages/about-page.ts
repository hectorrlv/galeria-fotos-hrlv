import { LitElement, css, html } from 'lit';
import { GalleryRepository } from '../firebase/gallery-repository.js';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '../models/gallery.js';
import { pageStyles } from './page-styles.js';

export class AboutPage extends LitElement {
  private readonly repository = new GalleryRepository();
  private site: SiteConfig = { ...DEFAULT_SITE_CONFIG };
  private unsubscribe?: () => void;

  static styles = [
    pageStyles,
    css`
      .about {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(15rem, 0.6fr);
        gap: clamp(2rem, 8vw, 8rem);
      }

      .social {
        display: flex;
        gap: 1rem;
        align-items: start;
      }

      @media (max-width: 42rem) {
        .about {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = this.repository.subscribeSiteConfig(false, site => {
      this.site = site;
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div class="page">
        <section class="intro">
          <span class="eyebrow">El proyecto</span>
          <h1>Acerca de</h1>
        </section>
        <section class="about">
          <div>
            <h2>${this.site.galleryName}</h2>
            <p class="lead">${this.site.about}</p>
          </div>
          <div class="social">
            ${
              this.site.instagramUrl
                ? html`<a
                    class="text-link"
                    href=${this.site.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    >Instagram</a
                  >`
                : ''
            }
            ${
              this.site.xUrl
                ? html`<a
                    class="text-link"
                    href=${this.site.xUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    >X</a
                  >`
                : ''
            }
          </div>
        </section>
      </div>
    `;
  }
}

customElements.define('about-page', AboutPage);
