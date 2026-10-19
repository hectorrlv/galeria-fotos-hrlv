import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth';
import {
  get,
  increment,
  onValue,
  ref,
  update,
  type Unsubscribe,
} from 'firebase/database';
import { getFirebaseServices, type FirebaseServices } from './client.js';

export interface PhotoLikeState {
  count: number | null;
  liked: boolean;
  ready: boolean;
  pending: boolean;
  error: string;
}

export interface PhotoLikesClient {
  observe(
    photoId: string,
    callback: (state: PhotoLikeState) => void,
  ): Unsubscribe;
  setLiked(photoId: string, albumId: string, liked: boolean): Promise<void>;
}

interface Entry {
  state: PhotoLikeState;
  listeners: Set<(state: PhotoLikeState) => void>;
  unsubscribeCount?: Unsubscribe;
  unsubscribeVote?: Unsubscribe;
  voteReady: boolean;
  generation: number;
}

const initialState = (): PhotoLikeState => ({
  count: null,
  liked: false,
  ready: false,
  pending: false,
  error: '',
});

/** One shared subscription and in-flight operation per photo, across both views. */
export class PhotoLikesService implements PhotoLikesClient {
  private readonly entries = new Map<string, Entry>();
  private unsubscribeAuth?: Unsubscribe;
  private user: User | null = null;
  private authReady = false;
  private signingIn?: Promise<User>;

  constructor(
    private readonly services: FirebaseServices | null = getFirebaseServices(),
  ) {}

  observe(
    photoId: string,
    callback: (state: PhotoLikeState) => void,
  ): Unsubscribe {
    const entry = this.entry(photoId);
    entry.listeners.add(callback);
    callback({ ...entry.state });
    if (!this.services) {
      this.emit(entry, { error: 'Likes no disponibles.' });
    } else {
      if (!this.unsubscribeAuth) {
        this.unsubscribeAuth = onAuthStateChanged(this.services.auth, user => {
          this.user = user;
          this.authReady = true;
          for (const [id, observed] of this.entries) {
            if (observed.listeners.size) this.observeVote(id, observed);
          }
        });
      }
      if (!entry.unsubscribeCount) {
        entry.unsubscribeCount = onValue(
          ref(this.services.database, `photoLikes/${photoId}/count`),
          snapshot => {
            this.emit(entry, { count: snapshot.val() ?? 0, error: '' });
          },
          () =>
            this.emit(entry, {
              count: null,
              error: 'No se pudieron cargar los likes.',
            }),
        );
        if (this.authReady) this.observeVote(photoId, entry);
      }
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      entry.listeners.delete(callback);
      this.release(photoId, entry);
    };
  }

  async setLiked(
    photoId: string,
    albumId: string,
    liked: boolean,
  ): Promise<void> {
    if (!this.services) throw new Error('Likes no disponibles.');
    const entry = this.entry(photoId);
    if (entry.state.pending) return;
    this.emit(entry, { pending: true, error: '' });
    try {
      const user = await this.ensureUser();
      const uid = user.uid;
      const vote = ref(
        this.services.database,
        `photoLikes/${photoId}/voters/${uid}`,
      );
      const current = await get(vote);
      if (this.services.auth.currentUser?.uid !== uid)
        throw new Error('La sesión cambió. Inténtalo de nuevo.');
      if (current.exists() === liked) return;
      try {
        await update(ref(this.services.database, `photoLikes/${photoId}`), {
          [`voters/${uid}`]: liked ? { albumId } : null,
          count: increment(liked ? 1 : -1),
        });
      } catch (error) {
        // A different tab may already have established the requested state.
        if (this.services.auth.currentUser?.uid !== uid) throw error;
        const confirmed = await get(vote);
        if (confirmed.exists() !== liked) throw error;
      }
    } catch {
      this.emit(entry, {
        error: 'No se pudo guardar el like. Inténtalo de nuevo.',
      });
      throw new Error(entry.state.error);
    } finally {
      this.emit(entry, { pending: false });
      this.release(photoId, entry);
    }
  }

  private async ensureUser(): Promise<User> {
    const { auth } = this.services!;
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser;
    this.signingIn ??= signInAnonymously(auth).then(result => result.user);
    try {
      return await this.signingIn;
    } finally {
      this.signingIn = undefined;
    }
  }

  private entry(photoId: string): Entry {
    let entry = this.entries.get(photoId);
    if (!entry) {
      entry = {
        state: initialState(),
        listeners: new Set(),
        voteReady: false,
        generation: 0,
      };
      this.entries.set(photoId, entry);
    }
    return entry;
  }

  private observeVote(photoId: string, entry: Entry) {
    entry.unsubscribeVote?.();
    entry.unsubscribeVote = undefined;
    const generation = ++entry.generation;
    entry.voteReady = !this.user;
    this.emit(entry, { liked: false });
    if (!this.user) return;
    entry.unsubscribeVote = onValue(
      ref(
        this.services!.database,
        `photoLikes/${photoId}/voters/${this.user.uid}`,
      ),
      snapshot => {
        if (generation !== entry.generation) return;
        entry.voteReady = true;
        this.emit(entry, { liked: snapshot.exists(), error: '' });
      },
      () => {
        if (generation !== entry.generation) return;
        entry.voteReady = false;
        this.emit(entry, { error: 'No se pudo consultar tu like.' });
      },
    );
  }

  private emit(entry: Entry, patch: Partial<PhotoLikeState>) {
    Object.assign(entry.state, patch);
    entry.state.ready =
      this.authReady && entry.voteReady && entry.state.count !== null;
    for (const listener of entry.listeners) listener({ ...entry.state });
  }

  private release(photoId: string, entry: Entry) {
    if (entry.listeners.size || entry.state.pending) return;
    entry.unsubscribeCount?.();
    entry.unsubscribeVote?.();
    ++entry.generation;
    this.entries.delete(photoId);
    if (
      ![...this.entries.values()].some(
        item => item.listeners.size || item.state.pending,
      )
    ) {
      this.unsubscribeAuth?.();
      this.unsubscribeAuth = undefined;
      this.authReady = false;
      this.user = null;
    }
  }
}

export const photoLikes = new PhotoLikesService();
