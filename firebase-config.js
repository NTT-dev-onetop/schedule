// Firebase Web App config của project t1-myschedule
// Đây là cấu hình phía client, không phải service-account private key.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBp4Iht5dmkHNVu9_bgQ8R1sfeSpH8STq8",
  authDomain: "t1-myschedule.firebaseapp.com",
  projectId: "t1-myschedule",
  storageBucket: "t1-myschedule.firebasestorage.app",
  messagingSenderId: "426393869723",
  appId: "1:426393869723:web:db2dc3ce7b02cb3e24953e",
  measurementId: "G-M09P6LRX1M"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
