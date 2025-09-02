// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyClRGnFk5duOztjsuOaUAWXZSF5j0acvVY",
  authDomain: "screen-share-bcd1f.firebaseapp.com",
  databaseURL: "https://screen-share-bcd1f-default-rtdb.firebaseio.com",
  projectId: "screen-share-bcd1f",
  storageBucket: "screen-share-bcd1f.firebasestorage.app",
  messagingSenderId: "407756033348",
  appId: "1:407756033348:web:76ba2ce5bb2d29ab9fdb11"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
