import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import { getFirebaseServices } from './client.js';

export class AuthService {
  private readonly services = getFirebaseServices();

  observe(callback: (user: User | null) => void): Unsubscribe {
    if (!this.services) {
      queueMicrotask(() => callback(null));
      return () => undefined;
    }
    return onAuthStateChanged(this.services.auth, callback);
  }

  async signInWithGoogle(): Promise<User> {
    if (!this.services) throw new Error('Firebase no está configurado.');
    const result = await signInWithPopup(
      this.services.auth,
      new GoogleAuthProvider(),
    );
    return result.user;
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    if (!this.services) throw new Error('Firebase no está configurado.');
    const result = await signInWithEmailAndPassword(
      this.services.auth,
      email,
      password,
    );
    return result.user;
  }

  async signOut(): Promise<void> {
    if (this.services) await signOut(this.services.auth);
  }
}
