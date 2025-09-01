// STUN server
const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let hostPC = null, viewerPC = null, localStream = null;

// ----- AGENT -----
async function startSharing(sessionCode) {
  localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const previewEl = document.getElementById('preview');
  if (previewEl) previewEl.srcObject = localStream;

  hostPC = new RTCPeerConnection(ICE_SERVERS);

  hostPC.onicecandidate = (evt) => {
    if (evt.candidate) db.ref(`signaling/${sessionCode}/hostCandidates`).push(JSON.stringify(evt.candidate));
  };

  localStream.getTracks().forEach(track => hostPC.addTrack(track, localStream));

  const offer = await hostPC.createOffer();
  await hostPC.setLocalDescription(offer);
  await db.ref(`signaling/${sessionCode}/offer`).set(JSON.stringify(offer));

  db.ref(`signaling/${sessionCode}/answer`).on('value', async snap => {
    const val = snap.val();
    if (val && hostPC && !hostPC.currentRemoteDescription) {
      await hostPC.setRemoteDescription(new RTCSessionDescription(JSON.parse(val)));
    }
  });

  db.ref(`signaling/${sessionCode}/viewerCandidates`).on('child_added', async snap => {
    const val = snap.val();
    if (!val) return;
    await hostPC.addIceCandidate(new RTCIceCandidate(JSON.parse(val)));
  });

  console.log('Screen sharing started. Code:', sessionCode);
}

// ----- VIEWER -----
async function joinSession(sessionCode) {
  viewerPC = new RTCPeerConnection(ICE_SERVERS);

  viewerPC.ontrack = (evt) => {
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) remoteVideo.srcObject = evt.streams[0];
  };

  viewerPC.onicecandidate = (evt) => {
    if (evt.candidate) db.ref(`signaling/${sessionCode}/viewerCandidates`).push(JSON.stringify(evt.candidate));
  };

  const offerSnap = await db.ref(`signaling/${sessionCode}/offer`).once('value');
  const offerVal = offerSnap.val();
  if (!offerVal) return alert('No active session with that code.');
  await viewerPC.setRemoteDescription(new RTCSessionDescription(JSON.parse(offerVal)));

  const answer = await viewerPC.createAnswer();
  await viewerPC.setLocalDescription(answer);
  await db.ref(`signaling/${sessionCode}/answer`).set(JSON.stringify(answer));

  db.ref(`signaling/${sessionCode}/hostCandidates`).on('child_added', async snap => {
    const val = snap.val();
    if (!val) return;
    await viewerPC.addIceCandidate(new RTCIceCandidate(JSON.parse(val)));
  });

  console.log('Joined session:', sessionCode);
}
