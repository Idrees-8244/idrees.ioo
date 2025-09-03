// screenshare.js
import { db } from "./firebase-config.js";
import { ref, get, set, push, onValue, onChildAdded, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let hostPC = null, localStream = null;

const pcConfig = {
  iceServers: [
    // Google STUN Servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },

    // Cloudflare STUN Server
    { urls: 'stun:stun.cloudflare.com:3478' },

    // Metered.ca TURN Servers (public)
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

    // Anyfirewall.com TURN Servers (public)
    {
      urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
      username: 'webrtc',
      credential: 'webrtc'
    },
    {
      urls: 'turn:relay.anyfirewall.com:3478',
      username: 'webrtc',
      credential: 'webrtc'
    }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  sdpSemantics: 'unified-plan'
};

function generateSessionCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ----- HOST -----
export async function startScreenShare() {
  const sessionCode = generateSessionCode();
  const sessionCodeDisplay = document.getElementById('sessionCode');
  const preview = document.getElementById('preview');

  if (sessionCodeDisplay) {
    sessionCodeDisplay.textContent = sessionCode;
  }

  hostPC = new RTCPeerConnection(pcConfig);

  hostPC.onicecandidate = (evt) => {
    if (evt.candidate) {
      const hostCandidatesRef = ref(db, `signaling/${sessionCode}/hostCandidates`);
      push(hostCandidatesRef, evt.candidate.toJSON());
    }
  };

  hostPC.onnegotiationneeded = async () => {
    try {
      const offer = await hostPC.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false
      });
      await hostPC.setLocalDescription(offer);

      await set(ref(db, `signaling/${sessionCode}/offer`), {
        sdp: offer.sdp,
        type: offer.type
      });
      console.log('Offer created and sent to Firebase.');
    } catch (error) {
      console.error('Error during negotiation:', error);
    }
  };

  hostPC.onconnectionstatechange = () => {
    console.log(`Host connection state: ${hostPC.connectionState}`);
  };

  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });

    if (preview) {
      preview.srcObject = localStream;
      preview.muted = true;
      preview.play().catch(e => console.error('Preview play failed:', e));
    }

    localStream.getTracks().forEach(track => {
      hostPC.addTrack(track, localStream);
    });

    onValue(ref(db, `signaling/${sessionCode}/answer`), async (snap) => {
      const answer = snap.val();
      if (answer) {
        await hostPC.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Answer received and set.');
      }
    }, { onlyOnce: true });

    onChildAdded(ref(db, `signaling/${sessionCode}/viewerCandidates`), async (snap) => {
      const val = snap.val();
      if (val) {
        await hostPC.addIceCandidate(new RTCIceCandidate(val));
      }
    });

    console.log('Screen sharing started. Code:', sessionCode);
    return sessionCode;
  } catch (error) {
    console.error('Error starting screen share:', error);
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      alert("Permission to share your screen was denied. Please allow it and try again.");
    }
    return null;
  }
}

export function stopScreenShare() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  if (hostPC) {
    hostPC.close();
  }
  localStream = null;
  hostPC = null;
  console.log('Screen sharing stopped.');
}

// ----- VIEWER -----
// NOTE: Viewer logic is now self-contained in viewer.html for better separation of concerns.
//       This function remains for legacy or direct use but is not used by the new viewer.html
export async function joinSession(sessionCode) {
  if (!sessionCode) return alert('Session code is required.');
  
  const viewerPC = new RTCPeerConnection(pcConfig);

  viewerPC.ontrack = (evt) => {
    const remoteVideo = document.getElementById('remoteVideo');
    const stream = evt.streams[0];
    if (remoteVideo && stream && stream.getVideoTracks().length > 0) {
      remoteVideo.srcObject = stream;
      remoteVideo.play().catch(e => console.error('Auto-play failed:', e));
    }
  };

  viewerPC.onicecandidate = (evt) => {
    if (evt.candidate) {
      const viewerCandidatesRef = ref(db, `signaling/${sessionCode}/viewerCandidates`);
      push(viewerCandidatesRef, evt.candidate.toJSON());
    }
  };

  try {
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
  } catch (error) {
    console.error('Error joining session:', error);
    alert('Failed to join session. Check the code and try again.');
  }
}
