import type { FirebaseServices } from './client.js';

export interface GalleryBackend {
  readonly available: boolean;
}

export class FirebaseGalleryBackend implements GalleryBackend {
  readonly available: boolean;

  constructor(services: FirebaseServices | null) {
    this.available = services !== null;
  }
}
