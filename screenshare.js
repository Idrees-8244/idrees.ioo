import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, set, push, onChildAdded, get, child } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyClRGnFk5duOztjsuOaUAWXZSF5j0acvVY",
  authDomain: "screen-share-bcd1f.firebaseapp.com",
  databaseURL: "https://screen-share-bcd1f-default-rtdb.firebaseio.com",
  projectId: "screen-share-bcd1f",
  storageBucket: "screen-share-bcd1f.appspot.com",
  messagingSenderId: "16113178925",
  appId: "1:16113178925:web:fbd71b9d357ab74406459d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const startBtn = document.getElementById("startBtn");
const sessionCodeEl = document.getElementById("sessionCode");

let localStream;
let peerConnection;
let sessionCode;

startBtn.onclick = async () => {
  sessionCode = Math.random().toString(36).substring(2, 8);
  sessionCodeEl.textContent = sessionCode;

  localStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true
  });

  peerConnection = new RTCPeerConnection();
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = (evt) => {
    if (evt.candidate) {
      push(ref(db, `signaling/${sessionCode}/hostCandidates`), JSON.stringify(evt.candidate));
    }
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await set(ref(db, `signaling/${sessionCode}/offer`), offer);

  // Watch for viewer answer
  const ansSnap = ref(db, `signaling/${sessionCode}/answer`);
  onChildAdded(ref(db, `signaling/${sessionCode}/viewerCandidates`), async (snap) => {
    try {
      const val = snap.val();
      const cand = typeof val === "string" ? JSON.parse(val) : val;
      await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
    } catch (e) {
      console.error("Error adding viewer candidate:", e);
    }
  });

  get(child(ref(db), `signaling/${sessionCode}/answer`)).then(async (snap) => {
    if (snap.exists()) {
      const answer = snap.val();
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });
};
