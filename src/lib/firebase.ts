import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use initializeFirestore with experimentalForceLongPolling to avoid idle stream errors in iframe environments
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId);

setLogLevel('error');

export const auth = getAuth(app);
