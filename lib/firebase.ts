import {
  initializeApp,
  getApp as getInitializedApp,
  getApps,
  type FirebaseApp,
} from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

function getOrCreateApp(): FirebaseApp {
  if (appInstance) return appInstance;
  if (getApps().length > 0) {
    appInstance = getInitializedApp();
    return appInstance;
  }
  appInstance = initializeApp(firebaseConfig);
  return appInstance;
}

function getLazyAuth(): Auth {
  if (!authInstance) authInstance = getAuth(getOrCreateApp());
  return authInstance;
}

function getLazyDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(getOrCreateApp());
  return dbInstance;
}

/** Avoid initializing Firebase at import time so `next build` can complete without valid client keys. */
function createSdkProxy<T extends object>(getReal: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const real = getReal();
      const value = Reflect.get(real as object, prop, receiver);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(real)
        : value;
    },
  });
}

export const auth = createSdkProxy<Auth>(getLazyAuth);
export const db = createSdkProxy<Firestore>(getLazyDb);
