import _ from 'lodash';
import { SignalService } from '../../protobuf';
import {
  answerCall,
  callConnected,
  endCall,
  incomingCall,
  startingCallWith,
} from '../../state/ducks/conversations';
import { CallMessage } from '../messages/outgoing/controlMessage/CallMessage';
import { ed25519Str } from '../onions/onionPath';
import { getMessageQueue } from '../sending';
import { PubKey } from '../types';

type CallManagerListener =
  | ((localStream: MediaStream | null, remoteStream: MediaStream | null) => void)
  | null;
let videoEventsListener: CallManagerListener;

export function setVideoEventsListener(listener: CallManagerListener) {
  videoEventsListener = listener;
}

/**
 * This field stores all the details received by a sender about a call in separate messages.
 */
const callCache = new Map<string, Array<SignalService.CallMessage>>();

let peerConnection: RTCPeerConnection | null;

const ENABLE_VIDEO = true;

const configuration = {
  configuration: {
    offerToReceiveAudio: true,
    offerToReceiveVideo: ENABLE_VIDEO,
  },
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

// tslint:disable-next-line: function-name
export async function USER_callRecipient(recipient: string) {
  window?.log?.info(`starting call with ${ed25519Str(recipient)}..`);
  window.inboxStore?.dispatch(startingCallWith({ pubkey: recipient }));
  if (peerConnection) {
    window.log.info('closing existing peerconnection');
    peerConnection.close();
    peerConnection = null;
  }
  peerConnection = new RTCPeerConnection(configuration);

  const mediaDevices = await openMediaDevices();
  mediaDevices.getTracks().map(track => {
    peerConnection?.addTrack(track, mediaDevices);
  });
  peerConnection.addEventListener('connectionstatechange', _event => {
    window.log.info('peerConnection?.connectionState caller :', peerConnection?.connectionState);
    if (peerConnection?.connectionState === 'connected') {
      window.inboxStore?.dispatch(callConnected({ pubkey: recipient }));
    }
  });
  peerConnection.addEventListener('ontrack', event => {
    console.warn('ontrack:', event);
  });
  peerConnection.addEventListener('icecandidate', event => {
    // window.log.warn('event.candidate', event.candidate);

    if (event.candidate) {
      iceCandidates.push(event.candidate);
      void iceSenderDebouncer(recipient);
    }
  });
  const remoteStream = new MediaStream();

  if (videoEventsListener) {
    videoEventsListener(mediaDevices, remoteStream);
  }

  peerConnection.addEventListener('track', event => {
    if (videoEventsListener) {
      videoEventsListener(mediaDevices, remoteStream);
    }
    remoteStream.addTrack(event.track);
  });

  const offerDescription = await peerConnection.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: ENABLE_VIDEO,
  });

  if (!offerDescription || !offerDescription.sdp || !offerDescription.sdp.length) {
    window.log.warn(`failed to createOffer for recipient ${ed25519Str(recipient)}`);
    return;
  }
  await peerConnection.setLocalDescription(offerDescription);
  const callOfferMessage = new CallMessage({
    timestamp: Date.now(),
    type: SignalService.CallMessage.Type.OFFER,
    sdps: [offerDescription.sdp],
  });

  window.log.info('sending OFFER MESSAGE');
  await getMessageQueue().sendToPubKeyNonDurably(PubKey.cast(recipient), callOfferMessage);
  // FIXME audric dispatch UI update to show the calling UI
}

const iceCandidates: Array<RTCIceCandidate> = new Array();
const iceSenderDebouncer = _.debounce(async (recipient: string) => {
  if (!iceCandidates) {
    return;
  }
  const validCandidates = _.compact(
    iceCandidates.map(c => {
      if (
        c.sdpMLineIndex !== null &&
        c.sdpMLineIndex !== undefined &&
        c.sdpMid !== null &&
        c.candidate
      ) {
        return {
          sdpMLineIndex: c.sdpMLineIndex,
          sdpMid: c.sdpMid,
          candidate: c.candidate,
        };
      }
      return null;
    })
  );
  const callIceCandicates = new CallMessage({
    timestamp: Date.now(),
    type: SignalService.CallMessage.Type.ICE_CANDIDATES,
    sdpMLineIndexes: validCandidates.map(c => c.sdpMLineIndex),
    sdpMids: validCandidates.map(c => c.sdpMid),
    sdps: validCandidates.map(c => c.candidate),
  });
  window.log.info('sending ICE CANDIDATES MESSAGE to ', recipient);

  await getMessageQueue().sendToPubKeyNonDurably(PubKey.cast(recipient), callIceCandicates);
}, 2000);

const openMediaDevices = async () => {
  return navigator.mediaDevices.getUserMedia({
    video: ENABLE_VIDEO,
    audio: true,
  });
};

const findLastMessageTypeFromSender = (sender: string, msgType: SignalService.CallMessage.Type) => {
  const msgCacheFromSender = callCache.get(sender);
  if (!msgCacheFromSender) {
    return undefined;
  }
  const lastOfferMessage = _.findLast(msgCacheFromSender, m => m.type === msgType);

  if (!lastOfferMessage) {
    return undefined;
  }
  return lastOfferMessage;
};

// tslint:disable-next-line: function-name
export async function USER_acceptIncomingCallRequest(fromSender: string) {
  const msgCacheFromSender = callCache.get(fromSender);
  if (!msgCacheFromSender) {
    window?.log?.info(
      'incoming call request cannot be accepted as the corresponding message is not found'
    );
    return;
  }
  const lastOfferMessage = findLastMessageTypeFromSender(
    fromSender,
    SignalService.CallMessage.Type.OFFER
  );

  if (!lastOfferMessage) {
    window?.log?.info(
      'incoming call request cannot be accepted as the corresponding message is not found'
    );
    return;
  }
  window.inboxStore?.dispatch(answerCall({ pubkey: fromSender }));

  if (peerConnection) {
    window.log.info('closing existing peerconnection');
    peerConnection.close();
    peerConnection = null;
  }
  peerConnection = new RTCPeerConnection(configuration);
  const mediaDevices = await openMediaDevices();
  mediaDevices.getTracks().map(track => {
    // window.log.info('USER_acceptIncomingCallRequest adding track ', track);
    peerConnection?.addTrack(track, mediaDevices);
  });
  const remoteStream = new MediaStream();

  if (videoEventsListener) {
    videoEventsListener(mediaDevices, remoteStream);
  }

  peerConnection.addEventListener('track', event => {
    if (videoEventsListener) {
      videoEventsListener(mediaDevices, remoteStream);
    }
    remoteStream.addTrack(event.track);
  });
  peerConnection.addEventListener('connectionstatechange', _event => {
    window.log.info(
      'peerConnection?.connectionState recipient:',
      peerConnection?.connectionState,
      'with: ',
      fromSender
    );
    if (peerConnection?.connectionState === 'connected') {
      window.inboxStore?.dispatch(callConnected({ pubkey: fromSender }));
    }
  });

  const { sdps } = lastOfferMessage;
  if (!sdps || sdps.length === 0) {
    window?.log?.info(
      'incoming call request cannot be accepted as the corresponding sdps is empty'
    );
    return;
  }
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription({ sdp: sdps[0], type: 'offer' })
  );

  const answer = await peerConnection.createAnswer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: ENABLE_VIDEO,
  });
  if (!answer?.sdp || answer.sdp.length === 0) {
    window.log.warn('failed to create answer');
    return;
  }
  await peerConnection.setLocalDescription(answer);
  const answerSdp = answer.sdp;
  const callAnswerMessage = new CallMessage({
    timestamp: Date.now(),
    type: SignalService.CallMessage.Type.ANSWER,
    sdps: [answerSdp],
  });

  const lastCandidatesFromSender = findLastMessageTypeFromSender(
    fromSender,
    SignalService.CallMessage.Type.ICE_CANDIDATES
  );

  if (lastCandidatesFromSender) {
    window.log.info('found sender ice candicate message already sent. Using it');
    for (let index = 0; index < lastCandidatesFromSender.sdps.length; index++) {
      const sdp = lastCandidatesFromSender.sdps[index];
      const sdpMLineIndex = lastCandidatesFromSender.sdpMLineIndexes[index];
      const sdpMid = lastCandidatesFromSender.sdpMids[index];
      const candicate = new RTCIceCandidate({ sdpMid, sdpMLineIndex, candidate: sdp });
      await peerConnection.addIceCandidate(candicate);
    }
  }
  window.log.info('sending ANSWER MESSAGE');

  await getMessageQueue().sendToPubKeyNonDurably(PubKey.cast(fromSender), callAnswerMessage);
}

// tslint:disable-next-line: function-name
export async function USER_rejectIncomingCallRequest(fromSender: string) {
  const endCallMessage = new CallMessage({
    type: SignalService.CallMessage.Type.END_CALL,
    timestamp: Date.now(),
  });
  callCache.delete(fromSender);

  window.inboxStore?.dispatch(endCall({ pubkey: fromSender }));
  window.log.info('sending END_CALL MESSAGE');

  await getMessageQueue().sendToPubKeyNonDurably(PubKey.cast(fromSender), endCallMessage);
}

export function handleEndCallMessage(sender: string) {
  callCache.delete(sender);
  if (videoEventsListener) {
    videoEventsListener(null, null);
  }
  //
  // FIXME audric trigger UI cleanup
  window.inboxStore?.dispatch(endCall({ pubkey: sender }));
}

export function handleOfferCallMessage(sender: string, callMessage: SignalService.CallMessage) {
  if (!callCache.has(sender)) {
    callCache.set(sender, new Array());
  }
  callCache.get(sender)?.push(callMessage);
  window.inboxStore?.dispatch(incomingCall({ pubkey: sender }));
}

export async function handleCallAnsweredMessage(
  sender: string,
  callMessage: SignalService.CallMessage
) {
  if (!callMessage.sdps || callMessage.sdps.length === 0) {
    window.log.warn('cannot handle answered message without sdps');
    return;
  }
  if (!callCache.has(sender)) {
    callCache.set(sender, new Array());
  }

  callCache.get(sender)?.push(callMessage);
  window.inboxStore?.dispatch(answerCall({ pubkey: sender }));
  const remoteDesc = new RTCSessionDescription({ type: 'answer', sdp: callMessage.sdps[0] });
  if (peerConnection) {
    await peerConnection.setRemoteDescription(remoteDesc);
  } else {
    window.log.info('call answered by recipient but we do not have a peerconnection set');
  }
}

export async function handleIceCandidatesMessage(
  sender: string,
  callMessage: SignalService.CallMessage
) {
  if (!callMessage.sdps || callMessage.sdps.length === 0) {
    window.log.warn('cannot handle iceCandicates message without candidates');
    return;
  }
  if (!callCache.has(sender)) {
    callCache.set(sender, new Array());
  }

  callCache.get(sender)?.push(callMessage);
  // window.inboxStore?.dispatch(incomingCall({ pubkey: sender }));
  if (peerConnection) {
    // tslint:disable-next-line: prefer-for-of
    for (let index = 0; index < callMessage.sdps.length; index++) {
      const sdp = callMessage.sdps[index];
      const sdpMLineIndex = callMessage.sdpMLineIndexes[index];
      const sdpMid = callMessage.sdpMids[index];
      const candicate = new RTCIceCandidate({ sdpMid, sdpMLineIndex, candidate: sdp });
      await peerConnection.addIceCandidate(candicate);
    }
  } else {
    window.log.info('handleIceCandidatesMessage but we do not have a peerconnection set');
  }
}

// tslint:disable-next-line: no-async-without-await
export async function handleOtherCallMessage(
  sender: string,
  callMessage: SignalService.CallMessage
) {
  callCache.get(sender)?.push(callMessage);
}
