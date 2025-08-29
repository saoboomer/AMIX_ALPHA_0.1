import { useState, useEffect, useCallback, useRef } from 'react';
import Peer from 'simple-peer';
import io from 'socket.io-client';
import { db } from '../utils/db';
import { initializeRatchet, ratchetEncrypt, ratchetDecrypt } from '../utils/crypto';

const SIGNALING_SERVER_URL = 'https://webrtc-signal-server-a2hr.onrender.com';

export function usePeers(user, keys, onMessage) {
  const [peers, setPeers] = useState({});
  const [publicKeys, setPublicKeys] = useState({});
  const [socket, setSocket] = useState(null);
  const peerRefs = useRef({});
  const ratchetStatesRef = useRef({});

  // Effect to keep the ref updated with the latest state
  useEffect(() => {
    ratchetStatesRef.current = peers;
  }, [peers]);

  useEffect(() => {
    if (!user || !keys) return;

    const newSocket = io(SIGNALING_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to signaling server');
      newSocket.emit('join', { email: user.email });
    });

    newSocket.on('signal', async ({ from, signal }) => {
      console.log(`Received signal from ${from.email}`);
      const peerRef = peerRefs.current[from.email];

      if (signal.type === 'offer') {
        const peer = new Peer({ trickle: false });
        peerRefs.current[from.email] = peer;

        peer.on('signal', (answerSignal) => {
          newSocket.emit('signal', { to: from.email, from: { email: user.email, publicKeyJwk: keys.publicKeyJwk }, signal: answerSignal });
        });

        peer.on('connect', async () => {
          console.log(`(Receiver) Connection established with ${from.email}`);
          let state = await db.ratchetStates.get(from.email);
          if (!state) {
            state = await initializeRatchet(keys.privateKey, from.publicKeyJwk);
            await db.ratchetStates.put({ recipientEmail: from.email, ...state });
          }
          setPeers((prev) => ({ ...prev, [from.email]: { peer, ratchetState: state } }));
          setPublicKeys((prev) => ({ ...prev, [from.email]: from.publicKeyJwk }));
        });

        peer.on('data', async (data) => {
          const peerState = ratchetStatesRef.current[from.email];
          if (peerState && peerState.ratchetState) {
            try {
              const { plaintext, newRatchetState } = await ratchetDecrypt(peerState.ratchetState, JSON.parse(data.toString()));
              await db.ratchetStates.put({ recipientEmail: from.email, ...newRatchetState });
              setPeers(prev => ({ ...prev, [from.email]: { ...prev[from.email], ratchetState: newRatchetState }}));
              const message = JSON.parse(plaintext);
              if (onMessage) onMessage(message);
            } catch (error) {
              console.error('Failed to decrypt message with ratchet:', error);
            }
          }
        });

        peer.signal(signal);
      } else if (signal.type === 'answer' && peerRef) {
        peerRef.on('connect', async () => {
          console.log(`(Initiator) Connection established with ${from.email}`);
          let state = await db.ratchetStates.get(from.email);
          if (!state) {
            state = await initializeRatchet(keys.privateKey, from.publicKeyJwk);
            await db.ratchetStates.put({ recipientEmail: from.email, ...state });
          }
          setPeers((prev) => ({ ...prev, [from.email]: { peer: peerRef, ratchetState: state } }));
          setPublicKeys((prev) => ({ ...prev, [from.email]: from.publicKeyJwk }));
        });
        peerRef.signal(signal);
      }
    });

    return () => newSocket.disconnect();
  }, [user, keys, peers, onMessage]);

  const connectToPeer = useCallback((friend) => {
    if (!user || !keys || !socket) return;

    const peer = new Peer({ initiator: true, trickle: false });
    peerRefs.current[friend.email] = peer;

    peer.on('signal', (offerSignal) => {
      socket.emit('signal', { to: friend.email, from: { email: user.email, publicKeyJwk: keys.publicKeyJwk }, signal: offerSignal });
    });

    // The 'connect' event will be handled by the 'signal' listener when the answer is received.

    peer.on('data', (data) => {
      console.log('Received data:', data.toString());
    });
  }, [user, keys, socket]);

  const sendMessage = useCallback(async (friendEmail, message) => {
    const peerState = peers[friendEmail];
    if (peerState && peerState.peer.connected && peerState.ratchetState) {
      const { encryptedMessage, newRatchetState } = await ratchetEncrypt(peerState.ratchetState, message);
      await db.ratchetStates.put({ recipientEmail: friendEmail, ...newRatchetState });
      setPeers(prev => ({ ...prev, [friendEmail]: { ...prev[friendEmail], ratchetState: newRatchetState }}));
      peerState.peer.send(JSON.stringify(encryptedMessage));
    } else {
      console.error('Peer not connected or no ratchet state.');
    }
  }, [peers]);

    return { peers, publicKeys, connectToPeer, sendMessage };
}
