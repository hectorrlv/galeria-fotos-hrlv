import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseAvailable, firebaseConfig } from './config.js';

export interface FirebaseServices {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly database: Database;
  readonly storage: FirebaseStorage;
}

let services: FirebaseServices | null | undefined;

export const getFirebaseServices = (): FirebaseServices | null => {
  if (services !== undefined) {
    return services;
  }

  if (!firebaseAvailable) {
    services = null;
    return services;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  services = {
    app,
    auth: getAuth(app),
    database: getDatabase(app),
    storage: getStorage(app),
  };
  return services;
};

export { firebaseAvailable } from './config.js';
