import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  getDatabase,
  type Database,
} from 'firebase/database';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import {
  firebaseAvailable,
  firebaseConfig,
  firebaseEmulatorsEnabled,
} from './config.js';

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
  const auth = getAuth(app);
  const database = getDatabase(app);
  if (firebaseEmulatorsEnabled) {
    if (!['localhost', '127.0.0.1'].includes(location.hostname))
      throw new Error('Los emuladores solo están disponibles en localhost.');
    connectAuthEmulator(auth, 'http://127.0.0.1:9109', {
      disableWarnings: true,
    });
    connectDatabaseEmulator(database, '127.0.0.1', 9019);
  }
  services = {
    app,
    auth,
    database,
    storage: getStorage(app),
  };
  return services;
};

export { firebaseAvailable } from './config.js';
