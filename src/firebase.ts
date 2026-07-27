// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBWzRLaTpy0a99V4mXnpTB9JhNEIveCBQg",
  authDomain: "quicksave-cc741.firebaseapp.com",
  projectId: "quicksave-cc741",
  storageBucket: "quicksave-cc741.firebasestorage.app",
  messagingSenderId: "831749911844",
  appId: "1:831749911844:web:7a07b11f4547a1b9422fb1",
  measurementId: "G-9GQMLHC3B5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const db = getFirestore(app);

export { app, db, analytics };