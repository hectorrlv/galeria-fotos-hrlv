import type { FirebaseOptions } from 'firebase/app';

declare const __FIREBASE_API_KEY__: string;
declare const __FIREBASE_AUTH_DOMAIN__: string;
declare const __FIREBASE_DATABASE_URL__: string;
declare const __FIREBASE_PROJECT_ID__: string;
declare const __FIREBASE_STORAGE_BUCKET__: string;
declare const __FIREBASE_MESSAGING_SENDER_ID__: string;
declare const __FIREBASE_APP_ID__: string;
declare const __FIREBASE_MEASUREMENT_ID__: string;

export const firebaseConfig: FirebaseOptions = {
  apiKey: __FIREBASE_API_KEY__,
  authDomain: __FIREBASE_AUTH_DOMAIN__,
  databaseURL: __FIREBASE_DATABASE_URL__,
  projectId: __FIREBASE_PROJECT_ID__,
  storageBucket: __FIREBASE_STORAGE_BUCKET__,
  messagingSenderId: __FIREBASE_MESSAGING_SENDER_ID__,
  appId: __FIREBASE_APP_ID__,
  measurementId: __FIREBASE_MEASUREMENT_ID__,
};

const requiredValues = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.databaseURL,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.appId,
];

export const firebaseAvailable = requiredValues.every(
  value => typeof value === 'string' && value.length > 0,
);
