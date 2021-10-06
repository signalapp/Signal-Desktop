import _ from 'lodash';
import { ToastUtils } from '.';
import { SessionSettingCategory } from '../../components/session/settings/SessionSettings';
import { getConversationById } from '../../data/data';
import { MessageModelType } from '../../models/messageType';
import { SignalService } from '../../protobuf';
import {
  answerCall,
  callConnected,
  endCall,
  incomingCall,
  startingCallWith,
} from '../../state/ducks/conversations';
import { SectionType, showLeftPaneSection, showSettingsSection } from '../../state/ducks/section';
import { getConversationController } from '../conversations';
import { CallMessage } from '../messages/outgoing/controlMessage/CallMessage';
import { ed25519Str } from '../onions/onionPath';
import { getMessageQueue } from '../sending';
import { PubKey } from '../types';
export type InputItem = { deviceId: string; label: string };

type CallManagerListener =
  | ((
      localStream: MediaStream | null,
      remoteStream: MediaStream | null,
      camerasList: Array<InputItem>,
      audioInputsList: Array<InputItem>
    ) => void)
  | null;
let videoEventsListener: CallManagerListener;

function callVideoListener() {
  if (videoEventsListener) {
    videoEventsListener(mediaDevices, remoteStream, camerasList, audioInputsList);
  }
}

export function setVideoEventsListener(listener: CallManagerListener) {
  videoEventsListener = listener;
  callVideoListener();
}

/**
 * This field stores all the details received by a sender about a call in separate messages.
 */
const callCache = new Map<string, Array<SignalService.CallMessage>>();

let peerConnection: RTCPeerConnection | null;
let remoteStream: MediaStream | null;
let mediaDevices: MediaStream | null;

let makingOffer = false;
let ignoreOffer = false;
let isSettingRemoteAnswerPending = false;
let lastOutgoingOfferTimestamp = -Infinity;

const configuration = {
  configuration: {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  },
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

let selectedCameraId: string | undefined;
let selectedAudioInputId: string | undefined;
let camerasList: Array<InputItem> = [];
let audioInputsList: Array<InputItem> = [];

async function getConnectedDevices(type: 'videoinput' | 'audioinput') {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(device => device.kind === type);
}

// Listen for changes to media devices and update the list accordingly
navigator.mediaDevices.addEventListener('devicechange', async () => {
  await updateInputLists();
  callVideoListener();
});

async function updateInputLists() {
  // Get the set of cameras connected
  const videoCameras = await getConnectedDevices('videoinput');
  camerasList = videoCameras.map(m => ({
    deviceId: m.deviceId,
    label: m.label,
  }));
  // Get the set of audio inputs connected
  const audiosInput = await getConnectedDevices('audioinput');
  audioInputsList = audiosInput.map(m => ({
    deviceId: m.deviceId,
    label: m.label,
  }));
}

export async function selectCameraByDeviceId(cameraDeviceId: string) {
  console.warn('selecting cameraDeviceId ', cameraDeviceId);

  if (camerasList.some(m => m.deviceId === cameraDeviceId)) {
    selectedCameraId = cameraDeviceId;

    try {
      mediaDevices = await openMediaDevices({
        audioInputId: selectedAudioInputId,
        cameraId: selectedCameraId,
      });

      mediaDevices.getTracks().map((track: MediaStreamTrack) => {
        window.log.info('selectCameraByDeviceId adding track: ', track);
        if (mediaDevices) {
          peerConnection?.addTrack(track, mediaDevices);
        }
      });
      callVideoListener();
    } catch (err) {
      console.warn('err', err);
    }
  }
}
export async function selectAudioInputByDeviceId(audioInputDeviceId: string) {
  console.warn('selecting audioInputDeviceId', audioInputDeviceId);
  if (audioInputsList.some(m => m.deviceId === audioInputDeviceId)) {
    selectedAudioInputId = audioInputDeviceId;
    try {
      mediaDevices = await openMediaDevices({
        audioInputId: selectedAudioInputId,
        cameraId: selectedCameraId,
      });

      mediaDevices.getTracks().map((track: MediaStreamTrack) => {
        window.log.info('selectAudioInputByDeviceId adding track: ', track);
        if (mediaDevices) {
          peerConnection?.addTrack(track, mediaDevices);
        }
      });
      callVideoListener();
    } catch (err) {
      console.warn('err', err);
    }
  }
}

async function handleNegotiationNeededEvent(event: Event, recipient: string) {
  window.log?.warn('negotiationneeded:', event);
  try {
    makingOffer = true;
    const offer = await peerConnection?.createOffer();

    if (!offer) {
      throw new Error('Could not create offer in handleNegotiationNeededEvent');
    }
    await peerConnection?.setLocalDescription(offer);

    if (offer && offer.sdp) {
      const negotationOfferMessage = new CallMessage({
        timestamp: Date.now(),
        type: SignalService.CallMessage.Type.OFFER,
        sdps: [offer.sdp],
      });

      window.log.info('sending OFFER MESSAGE');
      const negotationOfferSendResult = await getMessageQueue().sendToPubKeyNonDurably(
        PubKey.cast(recipient),
        negotationOfferMessage
      );
      if (typeof negotationOfferSendResult === 'number') {
        window.log?.warn('setting last sent timestamp');
        lastOutgoingOfferTimestamp = negotationOfferSendResult;
      }
    }
  } catch (err) {
    window.log?.error(`Error on handling negotiation needed ${err}`);
  } finally {
    makingOffer = false;
  }
}

function handleIceCandidates(event: RTCPeerConnectionIceEvent, pubkey: string) {
  if (event.candidate) {
    iceCandidates.push(event.candidate);
    void iceSenderDebouncer(pubkey);
  }
}

// tslint:disable-next-line: function-name
export async function USER_callRecipient(recipient: string) {
  await updateInputLists();
  window?.log?.info(`starting call with ${ed25519Str(recipient)}..`);
  window.inboxStore?.dispatch(startingCallWith({ pubkey: recipient }));
  if (peerConnection) {
    window.log.info('closing existing peerconnection');
    peerConnection.close();
    peerConnection = null;
  }
  peerConnection = new RTCPeerConnection(configuration);

  try {
    mediaDevices = await openMediaDevices({});

    mediaDevices.getTracks().map((track: any) => {
      window.log.info('USER_callRecipient adding track: ', track);
      if (mediaDevices) {
        peerConnection?.addTrack(track, mediaDevices);
      }
    });
  } catch (err) {
    ToastUtils.pushMicAndCameraPermissionNeeded(() => {
      window.inboxStore?.dispatch(showLeftPaneSection(SectionType.Settings));
      window.inboxStore?.dispatch(showSettingsSection(SessionSettingCategory.Privacy));
    });
  }
  peerConnection.addEventListener('connectionstatechange', () => {
    handleConnectionStateChanged(recipient);
  });

  peerConnection.addEventListener('icecandidate', event => {
    handleIceCandidates(event, recipient);
  });
  peerConnection.onnegotiationneeded = async (event: Event) => {
    await handleNegotiationNeededEvent(event, recipient);
  };

  remoteStream = new MediaStream();

  callVideoListener();

  peerConnection.addEventListener('track', event => {
    callVideoListener();
    if (remoteStream) {
      remoteStream.addTrack(event.track);
    }
  });
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

const openMediaDevices = async ({
  audioInputId,
  cameraId,
}: {
  cameraId?: string;
  audioInputId?: string;
}) => {
  if (mediaDevices) {
    window.log.info('stopping existing tracks in openMediaDevices');
    mediaDevices.getTracks().forEach(track => {
      track.stop();
    });
  }
  window.log.info('openMediaDevices ', { audioInputId, cameraId });

  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: audioInputId ? { exact: audioInputId } : undefined,
      echoCancellation: true,
    },
    video: {
      deviceId: cameraId ? { exact: cameraId } : undefined,
    },
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

function handleSignalingStateChangeEvent() {
  if (peerConnection?.signalingState === 'closed') {
    closeVideoCall();
  }
}

function handleConnectionStateChanged(pubkey: string) {
  window.log.info('handleConnectionStateChanged :', peerConnection?.connectionState);

  if (peerConnection?.signalingState === 'closed') {
    closeVideoCall();
  } else if (peerConnection?.connectionState === 'connected') {
    window.inboxStore?.dispatch(callConnected({ pubkey }));
  }
}

function closeVideoCall() {
  if (peerConnection) {
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.onsignalingstatechange = null;
    peerConnection.onicegatheringstatechange = null;
    peerConnection.onnegotiationneeded = null;

    if (mediaDevices) {
      mediaDevices.getTracks().forEach(track => {
        track.stop();
      });
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    peerConnection.close();
    peerConnection = null;
  }

  if (videoEventsListener) {
    videoEventsListener(null, null, [], []);
  }
}

// tslint:disable-next-line: function-name
export async function USER_acceptIncomingCallRequest(fromSender: string) {
  const msgCacheFromSender = callCache.get(fromSender);
  await updateInputLists();
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
  mediaDevices = await openMediaDevices({});
  mediaDevices.getTracks().map(track => {
    // window.log.info('USER_acceptIncomingCallRequest adding track ', track);
    if (mediaDevices) {
      peerConnection?.addTrack(track, mediaDevices);
    }
  });
  remoteStream = new MediaStream();

  peerConnection.addEventListener('icecandidate', event => {
    if (event.candidate) {
      iceCandidates.push(event.candidate);
      void iceSenderDebouncer(fromSender);
    }
  });

  peerConnection.addEventListener('signalingstatechange', handleSignalingStateChangeEvent);

  callVideoListener();

  peerConnection.addEventListener('track', event => {
    callVideoListener();
    remoteStream?.addTrack(event.track);
  });
  peerConnection.addEventListener('connectionstatechange', () => {
    handleConnectionStateChanged(fromSender);
  });

  const { sdps } = lastOfferMessage;
  if (!sdps || sdps.length === 0) {
    window?.log?.info(
      'incoming call request cannot be accepted as the corresponding sdps is empty'
    );
    return;
  }
  try {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription({ sdp: sdps[0], type: 'offer' })
    );
  } catch (e) {
    window.log?.error(`Error setting RTC Session Description ${e}`);
  }

  const answer = await peerConnection.createAnswer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
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
    videoEventsListener(null, null, [], []);
  }
  mediaDevices = null;
  remoteStream = null;
  //
  // FIXME audric trigger UI cleanup
  window.inboxStore?.dispatch(endCall({ pubkey: sender }));
}

export async function handleOfferCallMessage(
  sender: string,
  callMessage: SignalService.CallMessage,
  incomingOfferTimestamp: number
) {
  try {
    const convos = getConversationController().getConversations();
    const callingConvos = convos.filter(convo => convo.callState !== undefined);
    if (callingConvos.length > 0) {
      // we just got a new offer from someone we are already in a call with
      if (callingConvos.length === 1 && callingConvos[0].id === sender) {
        window.log.info('Got a new offer message from our ongoing call');
      } else {
        await handleMissedCall(sender, incomingOfferTimestamp);
        return;
      }
    }

    const readyForOffer =
      !makingOffer && (peerConnection?.signalingState === 'stable' || isSettingRemoteAnswerPending);
    const polite = lastOutgoingOfferTimestamp < incomingOfferTimestamp;
    ignoreOffer = !polite && !readyForOffer;
    if (ignoreOffer) {
      // window.log?.warn('Received offer when unready for offer; Ignoring offer.');
      window.log?.warn('Received offer when unready for offer; Ignoring offer.');
      return;
    }
    // don't need to do the sending here as we dispatch an answer in a
  } catch (err) {
    window.log?.error(`Error handling offer message ${err}`);
  }

  if (!callCache.has(sender)) {
    callCache.set(sender, new Array());
  }
  callCache.get(sender)?.push(callMessage);
  window.inboxStore?.dispatch(incomingCall({ pubkey: sender }));
}

async function handleMissedCall(sender: string, incomingOfferTimestamp: number) {
  const incomingCallConversation = await getConversationById(sender);
  ToastUtils.pushedMissedCall(incomingCallConversation?.getNickname() || 'Unknown');

  await incomingCallConversation?.addSingleMessage({
    conversationId: incomingCallConversation.id,
    source: sender,
    type: 'incoming' as MessageModelType,
    sent_at: incomingOfferTimestamp,
    received_at: Date.now(),
    expireTimer: 0,
    body: 'Missed call',
    unread: 1,
  });
  incomingCallConversation?.updateLastMessage();
  return;
}

export async function handleCallAnsweredMessage(
  sender: string,
  callMessage: SignalService.CallMessage
) {
  if (!callMessage.sdps || callMessage.sdps.length === 0) {
    window.log.warn('cannot handle answered message without signal description protols');
    return;
  }
  if (!callCache.has(sender)) {
    callCache.set(sender, new Array());
  }

  callCache.get(sender)?.push(callMessage);
  window.inboxStore?.dispatch(answerCall({ pubkey: sender }));
  const remoteDesc = new RTCSessionDescription({ type: 'answer', sdp: callMessage.sdps[0] });
  if (peerConnection) {
    window.log?.warn('Setting remote answer pending');
    isSettingRemoteAnswerPending = true;
    await peerConnection.setRemoteDescription(remoteDesc);
    isSettingRemoteAnswerPending = false;
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
      try {
        await peerConnection.addIceCandidate(candicate);
      } catch (err) {
        if (!ignoreOffer) {
          window.log?.warn('Error handling ICE candidates message', err);
        }
      }
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
