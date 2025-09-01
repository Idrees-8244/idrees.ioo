// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyClRGnFk5duOztjsuOaUAWXZSF5j0acvVY",
  authDomain: "screen-share-bcd1f.firebaseapp.com",
  databaseURL: "https://screen-share-bcd1f-default-rtdb.firebaseio.com",
  projectId: "screen-share-bcd1f",
  storageBucket: "screen-share-bcd1f.appspot.com",
  messagingSenderId: "407756033348",
  appId: "1:407756033348:web:76ba2ce5bb2d29ab9fdb11"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export { app, db, auth };
