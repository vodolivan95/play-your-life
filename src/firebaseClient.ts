import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
// Public web configuration; private credentials never belong in this client.
const app = initializeApp({
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyBsBONKueq81Eexs_I2rfyfal-RMujpR4A',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'play-your-life-872b1.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'play-your-life-872b1',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'play-your-life-872b1.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '160735967041',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:160735967041:web:0c6a59721e37a5950493c0',
});
export const auth = getAuth(app);
export const database = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
