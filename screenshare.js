// screenshare.js
import { db } from "./firebase-config.js";
import { ref, get, set, push, onValue, onChildAdded } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let hostPC = null, viewerPC = null, localStream = null;

const pcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { 
      urls: 'turn:openrelay.metered.ca:80', 
      username: 'openrelayproject', 
      credential: 'openrelayproject' 
    },
    { 
      urls: 'turn:openrelay.metered.ca:443', 
      username: 'openrelayproject', 
      credential: 'openrelayproject' 
    }
  ]
};

// Functions to start and join a session remain the same
// ----- HOST -----
async function startSession() {
  const sessionCode = Math.random().toString(36).substring(2, 8);
  hostPC = new RTCPeerConnection(pcConfig);

  hostPC.onicecandidate = (evt) => {
    if (evt.candidate) {
      const hostCandidatesRef = ref(db, `signaling/${sessionCode}/hostCandidates`);
      push(hostCandidatesRef, evt.candidate.toJSON());
    }
  };

  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  localStream = stream;
  stream.getTracks().forEach(track => hostPC.addTrack(track, stream));

  const offer = await hostPC.createOffer();
  await hostPC.setLocalDescription(offer);
  await set(ref(db, `signaling/${sessionCode}/offer`), {
    sdp: offer.sdp,
    type: offer.type
  });

  onChildAdded(ref(db, `signaling/${sessionCode}/viewerCandidates`), async (snap) => {
    const val = snap.val();
    if (val) {
      await hostPC.addIceCandidate(new RTCIceCandidate(val));
    }
  });

  const answerRef = ref(db, `signaling/${sessionCode}/answer`);
  onValue(answerRef, async (snap) => {
    const val = snap.val();
    if (val) {
      await hostPC.setRemoteDescription(new RTCSessionDescription(val));
    }
  });

  console.log('Screen sharing started. Code:', sessionCode);
}

// ----- VIEWER -----
async function joinSession(sessionCode) {
  viewerPC = new RTCPeerConnection(pcConfig);

  viewerPC.ontrack = (evt) => {
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) remoteVideo.srcObject = evt.streams[0];
  };

  viewerPC.onicecandidate = (evt) => {
    if (evt.candidate) {
      const viewerCandidatesRef = ref(db, `signaling/${sessionCode}/viewerCandidates`);
      push(viewerCandidatesRef, evt.candidate.toJSON());
    }
  };

  const offerSnap = await get(ref(db, `signaling/${sessionCode}/offer`));
  const offerVal = offerSnap.val();
  if (!offerVal) return alert('No active session with that code.');
  await viewerPC.setRemoteDescription(new RTCSessionDescription(offerVal));

  const answer = await viewerPC.createAnswer();
  await viewerPC.setLocalDescription(answer);
  await set(ref(db, `signaling/${sessionCode}/answer`), {
    sdp: answer.sdp,
    type: answer.type
  });

  onChildAdded(ref(db, `signaling/${sessionCode}/hostCandidates`), async (snap) => {
    const val = snap.val();
    if (val) {
      await viewerPC.addIceCandidate(new RTCIceCandidate(val));
    }
  });

  console.log('Joined screen share session:', sessionCode);
}
