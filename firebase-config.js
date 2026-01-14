// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfT1UFmoGSAanbIDTLYGeFfPE7uCa74Fw",
  authDomain: "nexchat-47326.firebaseapp.com",
  projectId: "nexchat-47326",
  storageBucket: "nexchat-47326.appspot.com",
  messagingSenderId: "327330605104",
  appId: "1:327330605104:web:ac43bb9adf7e4f1f1065f5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth and Firestore exports for other modules
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence disabled');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistence not supported in this browser');
    }
  });
