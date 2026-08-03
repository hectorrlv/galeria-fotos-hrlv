import type { User } from 'firebase/auth';
import { LitElement, css, html, nothing } from 'lit';
import { AuthService } from '../firebase/auth-service.js';
import { isAdminUid } from '../firebase/admin-access.js';
import { firebaseAvailable } from '../firebase/client.js';
import { GalleryRepository } from '../firebase/gallery-repository.js';
import { BrowserImageProcessor } from '../image-processing/browser-image-processor.js';
import {
  DEFAULT_SITE_CONFIG,
  createDraftAlbum,
  orderedPhotos,
  type Album,
  type GalleryPhoto,
  type PhotoCredit,
  type SiteConfig,
} from '../models/gallery.js';
import { slugify } from '../models/slug.js';
import { pageStyles } from './page-styles.js';

type EditorSection = 'albums' | 'settings';

export class AdminPage extends LitElement {
  private readonly auth = new AuthService();
  private readonly repository = new GalleryRepository();
  private readonly processor = new BrowserImageProcessor();
  private user: User | null = null;
  private authReady = false;
  private albums: Album[] = [];
  private draft: Album | null = null;
  private site: SiteConfig = structuredClone(DEFAULT_SITE_CONFIG);
  private section: EditorSection = 'albums';
  private message = '';
  private error = '';
  private busy = false;
  private uploadProgress = 0;
  private photoFeedbackId = '';
  private photoFeedbackMessage = '';
  private photoFeedbackError = '';
  private regeneratingPhotoId = '';
  private draggedPhotoId = '';
  private unsubscribeAuth?: () => void;
  private unsubscribeAlbums?: () => void;
  private unsubscribeSite?: () => void;

  static styles = [
    pageStyles,
    css`
      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }

      .admin-page {
        display: grid;
        gap: 2rem;
        padding-block: clamp(2rem, 6vw, 5rem);
      }

      .admin-header,
      .toolbar,
      .actions,
      .tabs,
      .photo-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .admin-header,
      .toolbar {
        justify-content: space-between;
      }

      .admin-header h1 {
        font-size: clamp(2.4rem, 6vw, 4.5rem);
      }

      .workspace {
        display: grid;
        grid-template-columns: minmax(14rem, 0.35fr) minmax(0, 1fr);
        gap: 1.5rem;
        align-items: start;
      }

      .panel,
      .login-card {
        padding: clamp(1rem, 3vw, 1.75rem);
        border: 1px solid var(--color-border);
        border-radius: 0.45rem;
        background: var(--color-surface);
      }

      .login-card {
        width: min(100%, 32rem);
        display: grid;
        gap: 1.25rem;
        margin-inline: auto;
      }

      form,
      .fields,
      .album-list,
      .photos-editor,
      .settings {
        display: grid;
        gap: 1rem;
      }

      .field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .field-grid > *,
      .photo-fields > * {
        min-width: 0;
      }

      label {
        display: grid;
        gap: 0.4rem;
        color: var(--color-text-muted);
        font-size: 0.8rem;
      }

      input,
      textarea,
      select {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        min-height: 2.8rem;
        padding: 0.65rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 0.25rem;
        color: var(--color-text);
        background: var(--color-background);
      }

      textarea {
        min-height: 8rem;
        resize: vertical;
      }

      input[type='checkbox'] {
        width: 1.15rem;
        min-height: 1.15rem;
        accent-color: var(--color-accent);
      }

      .checkbox {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      button,
      .button {
        min-height: 2.7rem;
        padding: 0.6rem 0.9rem;
        border: 1px solid var(--color-border);
        border-radius: 0.25rem;
        color: var(--color-text);
        background: var(--color-surface-raised);
        cursor: pointer;
        font: inherit;
        text-decoration: none;
      }

      button.primary {
        border-color: var(--color-accent);
        color: #17140f;
        background: var(--color-accent);
      }

      button.danger {
        border-color: #874e49;
        color: #ffd8d3;
      }

      button:disabled,
      input:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      button:focus-visible,
      input:focus-visible,
      textarea:focus-visible,
      select:focus-visible,
      .button:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 0.2rem;
      }

      .album-list button {
        display: grid;
        gap: 0.25rem;
        text-align: left;
      }

      .album-list button[aria-current='true'] {
        border-color: var(--color-accent);
      }

      .album-list small,
      .hint,
      .signed-in {
        color: var(--color-text-muted);
      }

      .status {
        padding: 0.8rem 1rem;
        border: 1px solid var(--color-border);
        border-radius: 0.3rem;
        background: var(--color-background);
      }

      .status.error {
        border-color: #874e49;
        color: #ffd8d3;
      }

      progress {
        width: 100%;
        accent-color: var(--color-accent);
      }

      .photo-card {
        display: grid;
        grid-template-columns: minmax(9rem, 0.28fr) minmax(0, 1fr);
        gap: 1rem;
        padding: 1rem;
        border: 1px solid var(--color-border);
        border-radius: 0.35rem;
        background: var(--color-background);
      }

      .photo-card[draggable='true'] {
        cursor: grab;
      }

      .photo-card img {
        width: 100%;
        aspect-ratio: 4 / 3;
        display: block;
        border-radius: 0.2rem;
        object-fit: cover;
        background: var(--color-surface);
      }

      .photo-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .photo-fields .wide {
        grid-column: 1 / -1;
      }

      .review-warning {
        color: #f1bd79;
      }

      .photo-feedback {
        grid-column: 1 / -1;
        margin: 0;
      }

      .photo-feedback.error {
        color: #ffd8d3;
      }

      .preview {
        padding: 1rem;
        border: 1px dashed var(--color-border);
        border-radius: 0.35rem;
      }

      .preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
        gap: 0.4rem;
        margin-top: 1rem;
      }

      .preview-grid img {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
      }

      @media (max-width: 54rem) {
        .workspace,
        .photo-card {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 38rem) {
        .field-grid,
        .photo-fields {
          grid-template-columns: 1fr;
        }

        .photo-fields .wide {
          grid-column: auto;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribeAuth = this.auth.observe(user => {
      this.user = user;
      this.authReady = true;
      this.unsubscribeAlbums?.();
      this.unsubscribeSite?.();
      if (isAdminUid(user?.uid)) this.subscribePrivateData();
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    this.unsubscribeAuth?.();
    this.unsubscribeAlbums?.();
    this.unsubscribeSite?.();
    super.disconnectedCallback();
  }

  render() {
    if (!firebaseAvailable) {
      return html`<div class="page">
        <section class="intro">
          <span class="eyebrow">Estudio privado</span>
          <h1>Administración</h1>
          <p>Modo de demostración: Firebase todavía no está configurado.</p>
        </section>
      </div>`;
    }
    if (!this.authReady)
      return html`<p class="status" role="status">Verificando sesión…</p>`;
    if (!this.user) return this.renderLogin();
    if (!isAdminUid(this.user.uid)) return this.renderUnauthorized();
    return this.renderStudio();
  }

  private renderLogin() {
    return html`<div class="admin-page">
      <section class="intro">
        <span class="eyebrow">Estudio privado</span>
        <h1>Iniciar sesión</h1>
        <p class="lead">Acceso exclusivo para administrar la galería.</p>
      </section>
      <div class="login-card">
        <button class="primary" @click=${this.loginWithGoogle}>
          Continuar con Google
        </button>
        <form @submit=${this.loginWithEmail}>
          <label>
            Correo
            <input name="email" type="email" autocomplete="username" required />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autocomplete="current-password"
              required
            />
          </label>
          <button type="submit">Entrar con correo</button>
        </form>
        ${this.renderMessages()}
      </div>
    </div>`;
  }

  private renderUnauthorized() {
    return html`<div class="page">
      <section class="empty">
        <h1>Cuenta sin autorización</h1>
        <p>
          La cuenta ${this.user?.email ?? ''} inició sesión, pero su UID no está
          autorizado para administrar la galería.
        </p>
        <button @click=${() => this.auth.signOut()}>Cerrar sesión</button>
      </section>
    </div>`;
  }

  private renderStudio() {
    return html`<div class="admin-page">
      <header class="admin-header">
        <div>
          <span class="eyebrow">Estudio privado</span>
          <h1>Administración</h1>
          <p class="signed-in">${this.user?.email ?? 'Administrador'}</p>
        </div>
        <button @click=${() => this.auth.signOut()}>Cerrar sesión</button>
      </header>
      <div class="tabs" role="tablist" aria-label="Secciones administrativas">
        <button
          role="tab"
          aria-selected=${this.section === 'albums'}
          @click=${() => this.setSection('albums')}
        >
          Álbumes
        </button>
        <button
          role="tab"
          aria-selected=${this.section === 'settings'}
          @click=${() => this.setSection('settings')}
        >
          Configuración
        </button>
      </div>
      ${this.renderMessages()}
      ${
        this.section === 'settings'
          ? this.renderSettings()
          : this.renderAlbumWorkspace()
      }
    </div>`;
  }

  private renderAlbumWorkspace() {
    return html`<div class="workspace">
      <aside class="panel">
        <div class="toolbar">
          <h2>Álbumes</h2>
          <button class="primary" @click=${this.createAlbum}>Nuevo</button>
        </div>
        <div class="album-list">
          ${
            this.albums.length
              ? this.albums.map(
                  album =>
                    html`<button
                      aria-current=${this.draft?.id === album.id}
                      @click=${() => this.selectAlbum(album)}
                    >
                      <strong>${album.title || 'Sin título'}</strong>
                      <small>${this.statusLabel(album.status)}</small>
                    </button>`,
                )
              : html`<p class="hint">Aún no hay álbumes.</p>`
          }
        </div>
      </aside>
      <main class="panel">
        ${
          this.draft
            ? this.renderAlbumEditor(this.draft)
            : html`<div class="empty">
                <h2>Selecciona o crea un álbum</h2>
                <p>Podrás preparar toda la historia antes de publicarla.</p>
              </div>`
        }
      </main>
    </div>`;
  }

  private renderAlbumEditor(album: Album) {
    const photos = orderedPhotos(album);
    return html`<form @submit=${this.saveDraft}>
      <div class="toolbar">
        <div>
          <span class="eyebrow">${this.statusLabel(album.status)}</span>
          <h2>${album.title || 'Nuevo álbum'}</h2>
        </div>
        <div class="actions">
          <button type="submit" ?disabled=${this.busy}>
            ${
              album.status === 'published'
                ? 'Guardar cambios'
                : 'Guardar borrador'
            }
          </button>
          ${
            album.status === 'published'
              ? html`<button
                  type="button"
                  class="danger"
                  @click=${this.unpublish}
                  ?disabled=${this.busy}
                >
                  Retirar
                </button>`
              : html`<button
                  type="button"
                  class="primary"
                  @click=${this.publish}
                  ?disabled=${this.busy}
                >
                  Publicar
                </button>`
          }
        </div>
      </div>

      <div class="field-grid">
        ${this.albumInput('Título', 'title', album.title, true)}
        ${this.albumInput('URL corta', 'slug', album.slug, true)}
        ${this.albumInput('País', 'country', album.country)}
        ${this.albumInput('Lugar', 'location', album.location)}
        ${this.albumInput('Fecha inicial', 'startDate', album.startDate, false, 'date')}
        ${this.albumInput('Fecha final', 'endDate', album.endDate, false, 'date')}
        ${this.albumInput('Tipo de paseo', 'category', album.category)}
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${album.featured}
            @change=${(event: Event) => {
              album.featured = (
                event.currentTarget as HTMLInputElement
              ).checked;
              this.requestUpdate();
            }}
          />
          Viaje destacado
        </label>
      </div>
      <label>
        Relato del viaje
        <textarea
          name="description"
          .value=${album.description}
          @input=${this.updateAlbumField}
        ></textarea>
      </label>

      <section class="photos-editor">
        <div class="toolbar">
          <div>
            <h2>Fotografías</h2>
            <p class="hint">
              Arrastra las tarjetas para cambiar el orden. El original permanece
              privado y sin modificaciones.
            </p>
          </div>
          <label class="button">
            Agregar fotografías
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              @change=${this.uploadPhotos}
              ?disabled=${this.busy}
            />
          </label>
        </div>
        ${
          this.busy && this.uploadProgress > 0
            ? html`<div>
                <p role="status">${this.message}</p>
                <progress max="1" .value=${this.uploadProgress}></progress>
              </div>`
            : ''
        }
        ${photos.map((photo, index) => this.renderPhotoEditor(photo, index))}
      </section>

      ${
        photos.length
          ? html`<details class="preview">
              <summary>Revisar mosaico antes de publicar</summary>
              <div class="preview-grid">
                ${photos
                  .filter(photo => photo.visible)
                  .map(
                    photo =>
                      html`<img
                        src=${photo.urls.thumbnail}
                        alt=${photo.altText}
                        loading="lazy"
                      />`,
                  )}
              </div>
            </details>`
          : ''
      }
    </form>`;
  }

  private renderPhotoEditor(photo: GalleryPhoto, index: number) {
    return html`<article
      class="photo-card"
      draggable="true"
      @dragstart=${() => {
        this.draggedPhotoId = photo.id;
      }}
      @dragover=${(event: DragEvent) => event.preventDefault()}
      @drop=${() => this.dropPhoto(photo.id)}
    >
      <div>
        <img src=${photo.urls.thumbnail} alt=${photo.altText} />
        <p class="hint">${index + 1}. ${photo.fileName}</p>
        ${
          photo.credit.requiresReview
            ? html`<p class="review-warning">Revisar contraste del crédito</p>`
            : ''
        }
      </div>
      <div class="photo-fields">
        ${this.photoInput(photo, 'Texto alternativo', 'altText', photo.altText, true)}
        ${this.photoInput(photo, 'Lugar', 'location', photo.location)}
        ${this.photoInput(photo, 'Fecha', 'takenAt', photo.takenAt, false, 'date')}
        ${this.photoInput(photo, 'Pie de foto', 'caption', photo.caption)}
        <label>
          Posición del crédito
          <select
            .value=${photo.credit.position}
            @change=${(event: Event) => {
              photo.credit.position = (event.currentTarget as HTMLSelectElement)
                .value as PhotoCredit['position'];
              this.requestUpdate();
            }}
          >
            <option value="auto">Automática</option>
            <option value="top-left">Superior izquierda</option>
            <option value="top-right">Superior derecha</option>
            <option value="bottom-left">Inferior izquierda</option>
            <option value="bottom-right">Inferior derecha</option>
          </select>
        </label>
        <label>
          Color
          <select
            .value=${photo.credit.color}
            @change=${(event: Event) => {
              photo.credit.color = (event.currentTarget as HTMLSelectElement)
                .value as PhotoCredit['color'];
              this.requestUpdate();
            }}
          >
            <option value="auto">Automático</option>
            <option value="light">Blanco</option>
            <option value="dark">Negro</option>
          </select>
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${photo.visible}
            @change=${(event: Event) => {
              photo.visible = (event.currentTarget as HTMLInputElement).checked;
              this.requestUpdate();
            }}
          />
          Visible al publicar
        </label>
        <label class="checkbox">
          <input
            type="radio"
            name="cover"
            .checked=${this.draft?.coverPhotoId === photo.id}
            @change=${() => {
              if (this.draft) this.draft.coverPhotoId = photo.id;
              this.requestUpdate();
            }}
          />
          Usar como portada
        </label>
        <div class="photo-actions wide">
          <button
            type="button"
            @click=${() => this.regeneratePhoto(photo)}
            ?disabled=${this.busy}
          >
            ${
              this.regeneratingPhotoId === photo.id
                ? `Regenerando crédito… ${Math.round(this.uploadProgress * 100)}%`
                : 'Regenerar crédito'
            }
          </button>
          <button
            type="button"
            class="danger"
            @click=${() => this.deletePhoto(photo)}
            ?disabled=${this.busy}
          >
            Eliminar foto
          </button>
        </div>
        ${
          this.photoFeedbackId === photo.id && this.photoFeedbackError
            ? html`<p class="photo-feedback error" role="alert">
                ${this.photoFeedbackError}
              </p>`
            : this.photoFeedbackId === photo.id && this.photoFeedbackMessage
              ? html`<p class="photo-feedback" role="status">
                  ${this.photoFeedbackMessage}
                </p>`
              : nothing
        }
      </div>
    </article>`;
  }

  private renderSettings() {
    return html`<form class="panel settings" @submit=${this.saveSettings}>
      <div class="toolbar">
        <div>
          <span class="eyebrow">Identidad</span>
          <h2>Configuración de la galería</h2>
        </div>
        <button class="primary" type="submit" ?disabled=${this.busy}>
          Guardar configuración
        </button>
      </div>
      <div class="field-grid">
        ${this.siteInput('Nombre de la galería', 'galleryName', this.site.galleryName)}
        ${this.siteInput('Crédito fotográfico', 'creditText', this.site.creditText)}
        ${this.siteInput('Instagram', 'instagramUrl', this.site.instagramUrl, 'url')}
        ${this.siteInput('X', 'xUrl', this.site.xUrl, 'url')}
      </div>
      <label>
        Introducción de portada
        <textarea
          name="introduction"
          .value=${this.site.introduction}
          @input=${this.updateSiteField}
        ></textarea>
      </label>
      <label>
        Texto de Acerca de
        <textarea
          name="about"
          .value=${this.site.about}
          @input=${this.updateSiteField}
        ></textarea>
      </label>
      <div class="field-grid">
        <label>
          Opacidad predeterminada
          <input
            type="range"
            min="0.35"
            max="1"
            step="0.05"
            .value=${String(this.site.defaultCredit.opacity)}
            @input=${(event: Event) => {
              this.site.defaultCredit.opacity = Number(
                (event.currentTarget as HTMLInputElement).value,
              );
              this.requestUpdate();
            }}
          />
        </label>
        <label>
          Tamaño predeterminado
          <input
            type="range"
            min="0.6"
            max="2"
            step="0.1"
            .value=${String(this.site.defaultCredit.scale)}
            @input=${(event: Event) => {
              this.site.defaultCredit.scale = Number(
                (event.currentTarget as HTMLInputElement).value,
              );
              this.requestUpdate();
            }}
          />
        </label>
      </div>
    </form>`;
  }

  private renderMessages() {
    if (this.error)
      return html`<p class="status error" role="alert">${this.error}</p>`;
    if (this.message)
      return html`<p class="status" role="status">${this.message}</p>`;
    return nothing;
  }

  private subscribePrivateData() {
    this.unsubscribeAlbums = this.repository.subscribePrivateAlbums(
      albums => {
        this.albums = albums;
        this.requestUpdate();
      },
      error => this.setError(error),
    );
    this.unsubscribeSite = this.repository.subscribeSiteConfig(
      true,
      site => {
        this.site = structuredClone(site);
        this.requestUpdate();
      },
      error => this.setError(error),
    );
  }

  private readonly loginWithGoogle = async () => {
    await this.run(async () => {
      const user = await this.auth.signInWithGoogle();
      if (!isAdminUid(user.uid))
        throw new Error('Esta cuenta no está autorizada.');
    }, 'Sesión iniciada.');
  };

  private readonly loginWithEmail = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    await this.run(async () => {
      const user = await this.auth.signInWithEmail(
        String(data.get('email') ?? ''),
        String(data.get('password') ?? ''),
      );
      if (!isAdminUid(user.uid))
        throw new Error('Esta cuenta no está autorizada.');
    }, 'Sesión iniciada.');
  };

  private setSection(section: EditorSection) {
    this.section = section;
    this.clearMessages();
    this.requestUpdate();
  }

  private readonly createAlbum = () => {
    this.draft = createDraftAlbum();
    this.clearMessages();
    this.requestUpdate();
  };

  private selectAlbum(album: Album) {
    this.draft = structuredClone(album);
    this.clearMessages();
    this.requestUpdate();
  }

  private albumInput(
    label: string,
    name: keyof Album,
    value: string,
    required = false,
    type = 'text',
  ) {
    return html`<label>
      ${label}
      <input
        name=${name}
        type=${type}
        .value=${value}
        ?required=${required}
        @input=${this.updateAlbumField}
      />
    </label>`;
  }

  private readonly updateAlbumField = (event: Event) => {
    if (!this.draft) return;
    const input = event.currentTarget as HTMLInputElement | HTMLTextAreaElement;
    const name = input.name as
      | 'title'
      | 'slug'
      | 'country'
      | 'location'
      | 'startDate'
      | 'endDate'
      | 'category'
      | 'description';
    this.draft[name] = name === 'slug' ? slugify(input.value) : input.value;
    if (name === 'title' && !this.draft.slug)
      this.draft.slug = slugify(input.value);
    this.requestUpdate();
  };

  private photoInput(
    photo: GalleryPhoto,
    label: string,
    name: 'altText' | 'location' | 'takenAt' | 'caption',
    value: string,
    required = false,
    type = 'text',
  ) {
    return html`<label>
      ${label}
      <input
        type=${type}
        .value=${value}
        ?required=${required}
        @input=${(event: Event) => {
          photo[name] = (event.currentTarget as HTMLInputElement).value;
        }}
      />
    </label>`;
  }

  private readonly saveDraft = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!this.draft) return;
    await this.persistDraft('Borrador guardado.');
  };

  private async persistDraft(successMessage: string) {
    const isPublished = this.draft?.status === 'published';
    const album = this.validatedDraft(isPublished);
    if (!album) return;
    await this.run(
      async () => {
        if (isPublished) {
          await this.repository.publishAlbum(album, this.albums);
        } else {
          await this.repository.saveAlbum(album);
        }
      },
      isPublished ? 'Cambios publicados.' : successMessage,
    );
  }

  private readonly publish = async () => {
    const album = this.validatedDraft(true);
    if (!album) return;
    await this.run(async () => {
      const published = await this.repository.publishAlbum(album, this.albums);
      album.status = published.status;
      album.updatedAt = published.updatedAt;
      album.publishedAt = published.publishedAt;
    }, 'Álbum publicado.');
  };

  private readonly unpublish = async () => {
    if (!this.draft) return;
    await this.run(async () => {
      await this.repository.unpublishAlbum(this.draft as Album);
      if (this.draft) this.draft.status = 'draft';
    }, 'Álbum retirado de la galería pública.');
  };

  private validatedDraft(forPublishing = false): Album | null {
    if (!this.draft) return null;
    this.draft.slug = slugify(this.draft.slug || this.draft.title);
    if (!this.draft.title.trim() || !this.draft.slug) {
      this.setError(new Error('Título y URL corta son obligatorios.'));
      return null;
    }
    const duplicate = this.albums.some(
      album => album.id !== this.draft?.id && album.slug === this.draft?.slug,
    );
    if (duplicate) {
      this.setError(new Error('Ya existe un álbum con esta URL corta.'));
      return null;
    }
    if (forPublishing) {
      const visiblePhotos = orderedPhotos(this.draft).filter(
        photo => photo.visible,
      );
      if (visiblePhotos.length === 0) {
        this.setError(new Error('Agrega al menos una fotografía visible.'));
        return null;
      }
      if (!this.draft.description.trim()) {
        this.setError(
          new Error('Agrega el relato del viaje antes de publicar.'),
        );
        return null;
      }
      if (!this.site.creditText.trim() || this.site.creditText === '@usuario') {
        this.setError(
          new Error('Configura tu crédito fotográfico antes de publicar.'),
        );
        return null;
      }
    }
    this.draft.updatedAt = Date.now();
    return this.draft;
  }

  private readonly uploadPhotos = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!this.draft || files.length === 0) return;
    this.busy = true;
    this.error = '';
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!file) continue;
        const photoId = crypto.randomUUID();
        this.message = `Procesando ${index + 1} de ${files.length}: ${file.name}`;
        this.uploadProgress = index / files.length;
        this.requestUpdate();
        const result = await this.processor.process(
          file,
          this.site.creditText,
          structuredClone(this.site.defaultCredit),
        );
        const originalPath = await this.repository.uploadOriginal(
          this.draft.id,
          photoId,
          file,
          progress => {
            this.uploadProgress = (index + progress * 0.35) / files.length;
            this.requestUpdate();
          },
        );
        const uploaded = await this.repository.uploadVariants(
          this.draft.id,
          photoId,
          result.variants,
          progress => {
            this.uploadProgress =
              (index + 0.35 + progress * 0.65) / files.length;
            this.requestUpdate();
          },
        );
        const fallbackAlt = file.name
          .replace(/\.[^.]+$/, '')
          .replace(/[-_]+/g, ' ');
        const photo: GalleryPhoto = {
          id: photoId,
          albumId: this.draft.id,
          fileName: file.name,
          width: result.originalWidth,
          height: result.originalHeight,
          caption: '',
          location: this.draft.location,
          takenAt: this.draft.startDate,
          altText: fallbackAlt,
          visible: true,
          originalPath,
          publicPaths: uploaded.paths,
          urls: uploaded.urls,
          credit: result.credit,
        };
        this.draft.photos[photoId] = photo;
        this.draft.photoOrder.push(photoId);
        this.draft.coverPhotoId ??= photoId;
      }
      await this.repository.saveAlbum(this.draft);
      this.message = `${files.length} fotografía${files.length === 1 ? '' : 's'} agregada${files.length === 1 ? '' : 's'}.`;
      this.uploadProgress = 0;
    } catch (error) {
      this.setError(error);
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  };

  private async regeneratePhoto(photo: GalleryPhoto) {
    if (!this.draft) return;
    this.busy = true;
    this.clearMessages();
    this.photoFeedbackId = photo.id;
    this.photoFeedbackMessage = `Regenerando crédito de ${photo.fileName}…`;
    this.photoFeedbackError = '';
    this.regeneratingPhotoId = photo.id;
    this.uploadProgress = 0;
    this.requestUpdate();
    try {
      const original = await this.repository.getOriginalFile(photo);
      const result = await this.processor.process(
        original,
        this.site.creditText,
        photo.credit,
      );
      const previousPaths = [...photo.publicPaths];
      const uploaded = await this.repository.uploadVariants(
        this.draft?.id ?? photo.albumId,
        photo.id,
        result.variants,
        progress => {
          this.uploadProgress = progress;
          this.requestUpdate();
        },
      );
      photo.credit = result.credit;
      photo.urls = uploaded.urls;
      photo.publicPaths = uploaded.paths;
      await this.repository.saveAlbum(this.draft as Album);
      await this.repository.deletePaths(previousPaths);
      this.photoFeedbackMessage =
        this.draft.status === 'published'
          ? 'Crédito regenerado. Guarda los cambios para actualizar el álbum publicado.'
          : 'Crédito regenerado y listo para revisión.';
    } catch (error) {
      this.photoFeedbackMessage = '';
      this.photoFeedbackError =
        error instanceof Error
          ? error.message
          : 'No fue posible regenerar el crédito.';
      this.setError(error);
    } finally {
      this.busy = false;
      this.regeneratingPhotoId = '';
      this.uploadProgress = 0;
      this.requestUpdate();
    }
  }

  private async deletePhoto(photo: GalleryPhoto) {
    if (!this.draft) return;
    const confirmed = window.confirm(
      `¿Eliminar ${photo.fileName}? También se borrará su original privado.`,
    );
    if (!confirmed) return;
    await this.run(async () => {
      await this.repository.deletePhotoFiles(photo);
      if (!this.draft) return;
      delete this.draft.photos[photo.id];
      this.draft.photoOrder = this.draft.photoOrder.filter(
        id => id !== photo.id,
      );
      if (this.draft.coverPhotoId === photo.id)
        this.draft.coverPhotoId = this.draft.photoOrder[0] ?? null;
      await this.repository.saveAlbum(this.draft);
    }, 'Fotografía eliminada.');
  }

  private dropPhoto(targetId: string) {
    if (!this.draft || !this.draggedPhotoId || this.draggedPhotoId === targetId)
      return;
    const order = this.draft.photoOrder.filter(
      id => id !== this.draggedPhotoId,
    );
    const targetIndex = order.indexOf(targetId);
    order.splice(targetIndex, 0, this.draggedPhotoId);
    this.draft.photoOrder = order;
    this.draggedPhotoId = '';
    this.requestUpdate();
  }

  private siteInput(
    label: string,
    name: 'galleryName' | 'creditText' | 'instagramUrl' | 'xUrl',
    value: string,
    type = 'text',
  ) {
    return html`<label>
      ${label}
      <input
        name=${name}
        type=${type}
        .value=${value}
        @input=${this.updateSiteField}
      />
    </label>`;
  }

  private readonly updateSiteField = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement | HTMLTextAreaElement;
    const name = input.name as
      | 'galleryName'
      | 'creditText'
      | 'instagramUrl'
      | 'xUrl'
      | 'introduction'
      | 'about';
    this.site[name] = input.value;
  };

  private readonly saveSettings = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!this.site.galleryName.trim() || !this.site.creditText.trim()) {
      this.setError(
        new Error('Nombre y crédito fotográfico son obligatorios.'),
      );
      return;
    }
    await this.run(
      async () => this.repository.saveSiteConfig(this.site),
      'Configuración guardada.',
    );
  };

  private statusLabel(status: Album['status']): string {
    if (status === 'published') return 'Publicado';
    if (status === 'archived') return 'Archivado';
    return 'Borrador';
  }

  private async run(action: () => Promise<void>, successMessage: string) {
    this.busy = true;
    this.clearMessages();
    this.requestUpdate();
    try {
      await action();
      this.message = successMessage;
    } catch (error) {
      this.setError(error);
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }

  private setError(error: unknown) {
    this.error =
      error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
    this.message = '';
    this.requestUpdate();
  }

  private clearMessages() {
    this.error = '';
    this.message = '';
  }
}

customElements.define('admin-page', AdminPage);
