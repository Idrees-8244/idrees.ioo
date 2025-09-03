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
    },
    { 
      urls: 'turn:openrelay.metered.ca:443?transport=tcp', 
      username: 'openrelayproject', 
      credential: 'openrelayproject' 
    },
    {
      urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
      username: 'webrtc',
      credential: 'webrtc'
    },
    {
      urls: 'turn:relay1.expressturn.com:3478',
      username: 'efTAJF7M2TAqVIBR3T',
      credential: 'uxXXDrkXYdkVBdkl'
    }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

// ----- AGENT -----
async function startSharing(sessionCode) {
  localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const previewEl = document.getElementById('preview');
  if (previewEl) previewEl.srcObject = localStream;

  hostPC = new RTCPeerConnection(pcConfig);

  hostPC.onicecandidate = (evt) => {
    if (evt.candidate) {
      const hostCandidatesRef = ref(db, `signaling/${sessionCode}/hostCandidates`);
      push(hostCandidatesRef, evt.candidate.toJSON());
    }
  };

  localStream.getTracks().forEach(track => hostPC.addTrack(track, localStream));

  const offer = await hostPC.createOffer();
  await hostPC.setLocalDescription(offer);
  await set(ref(db, `signaling/${sessionCode}/offer`), {
    sdp: offer.sdp,
    type: offer.type
  });

  const answerRef = ref(db, `signaling/${sessionCode}/answer`);
  onValue(answerRef, async (snap) => {
    const val = snap.val();
    if (val && hostPC && !hostPC.remoteDescription) {
      await hostPC.setRemoteDescription(new RTCSessionDescription(val));
    }
  });

  const viewerCandidatesRef = ref(db, `signaling/${sessionCode}/viewerCandidates`);
  onChildAdded(viewerCandidatesRef, async (snap) => {
    const val = snap.val();
    if (val) {
      await hostPC.addIceCandidate(new RTCIceCandidate(val));
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

  const hostCandidatesRef = ref(db, `signaling/${sessionCode}/hostCandidates`);
  onChildAdded(hostCandidatesRef, async (snap) => {
    const val = snap.val();
    if (val) {
      await hostPC.addIceCandidate(new RTCIceCandidate(val));
    }
  });

  console.log('Joined session:', sessionCode);
}
