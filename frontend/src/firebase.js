// Configuration Firebase pour le frontend
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB7jwAfD4HiB8caGqXSoSCG8NhiC2yAylI",
  authDomain: "erastebusiness.firebaseapp.com",
  projectId: "erastebusiness",
  storageBucket: "erastebusiness.firebasestorage.app",
  messagingSenderId: "170945354098",
  appId: "1:170945354098:web:61ce925decfcd4e2e865eb",
  measurementId: "G-3LDTQXER3S"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Exporter les services Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
