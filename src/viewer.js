import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const connectForm = document.querySelector('#connectForm');
const sessionIdInput = document.querySelector('#sessionIdInput');
const connectBtn = document.querySelector('#connectBtn');
const statusEl = document.querySelector('#status');
const remoteVideo = document.querySelector('#remoteVideo');

let pc = null;
let unsubscribeOfferCandidates = null;
let isConnecting = false;

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function setStatus(message) {
  statusEl.textContent = message;
}

function cleanupConnection() {
  if (unsubscribeOfferCandidates) {
    unsubscribeOfferCandidates();
    unsubscribeOfferCandidates = null;
  }

  if (pc) {
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.close();
    pc = null;
  }

  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach((track) => track.stop());
    remoteVideo.srcObject = null;
  }
}

async function connectAsViewer() {
  const sessionId = sessionIdInput.value.trim();
  if (!sessionId) {
    setStatus('sessionId を入力してください。');
    return;
  }

  cleanupConnection();
  setStatus('接続準備中...');

  const sessionRef = doc(db, 'screenShareSessions', sessionId);
  const offerCandidatesRef = collection(sessionRef, 'offerCandidates');
  const answerCandidatesRef = collection(sessionRef, 'answerCandidates');

  const sessionSnapshot = await getDoc(sessionRef);
  if (!sessionSnapshot.exists()) {
    setStatus('セッションが見つかりません。sessionId を確認してください。');
    return;
  }

  const sessionData = sessionSnapshot.data();
  if (!sessionData.offer) {
    setStatus('offer がまだ作成されていません。送信側の開始を待ってください。');
    return;
  }

  pc = new RTCPeerConnection(rtcConfig);

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      remoteVideo.srcObject = stream;
      remoteVideo.play().catch((error) => {
        setStatus(`映像の自動再生に失敗しました: ${error.message}`);
      });
      setStatus('受信映像を再生中です。');
    }
  };

  pc.onicecandidate = async (event) => {
    if (!event.candidate) {
      return;
    }

    await addDoc(answerCandidatesRef, {
      ...event.candidate.toJSON(),
      sessionCreatedAt: sessionData.createdAt,
    });
  };

  pc.onconnectionstatechange = () => {
    if (!pc) {
      return;
    }

    if (pc.connectionState === 'connected') {
      setStatus('接続完了。');
    } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
      setStatus(`接続状態: ${pc.connectionState}`);
    }
  };

  await pc.setRemoteDescription(new RTCSessionDescription(sessionData.offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await setDoc(sessionRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });

  unsubscribeOfferCandidates = onSnapshot(offerCandidatesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added') {
        return;
      }

      const { sessionCreatedAt, ...candidate } = change.doc.data();
      if (sessionCreatedAt !== sessionData.createdAt) {
        return;
      }

      pc
        ?.addIceCandidate(new RTCIceCandidate(candidate))
        .catch((error) => setStatus(`offer ICE candidate 追加失敗: ${error.message}`));
    });
  });

  setStatus('answer を送信しました。接続確立を待っています...');
}

connectForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isConnecting) {
    setStatus('接続処理中です。');
    return;
  }

  try {
    isConnecting = true;
    connectBtn.disabled = true;
    await connectAsViewer();
  } catch (error) {
    setStatus(`接続に失敗しました: ${error.message}`);
    cleanupConnection();
  } finally {
    isConnecting = false;
    connectBtn.disabled = false;
  }
});
