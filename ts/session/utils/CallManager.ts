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

// const VIDEO_WIDTH = 640;
// const VIDEO_RATIO = 16 / 9;

type CallManagerListener =
  | ((
      localStream: MediaStream | null,
      remoteStream: MediaStream | null,
      camerasList: Array<InputItem>,
      audioInputsList: Array<InputItem>,
      isRemoteVideoStreamMuted: boolean
    ) => void)
  | null;
let videoEventsListener: CallManagerListener;

function callVideoListener() {
  if (videoEventsListener) {
    videoEventsListener(
      mediaDevices,
      remoteStream,
      camerasList,
      audioInputsList,
      remoteVideoStreamIsMuted
    );
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
let dataChannel: RTCDataChannel | null;
let remoteStream: MediaStream | null;
let mediaDevices: MediaStream | null;
let remoteVideoStreamIsMuted = true;

export const INPUT_DISABLED_DEVICE_ID = 'off';

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
    {
      urls: 'turn:freyr.getsession.org',
      username: 'webrtc',
      credential: 'webrtc',
    },
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
// tslint:disable-next-line: no-typeof-undefined
if (typeof navigator !== 'undefined') {
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    await updateInputLists();
    callVideoListener();
  });
}
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

function sendVideoStatusViaDataChannel() {
  const videoEnabledLocally =
    selectedCameraId !== undefined && selectedCameraId !== INPUT_DISABLED_DEVICE_ID;
  const stringToSend = JSON.stringify({
    video: videoEnabledLocally,
  });
  dataChannel?.send(stringToSend);
}

export async function selectCameraByDeviceId(cameraDeviceId: string) {
  if (cameraDeviceId === INPUT_DISABLED_DEVICE_ID) {
    selectedCameraId = cameraDeviceId;

    const sender = peerConnection?.getSenders().find(s => {
      return s.track?.kind === 'video';
    });
    if (sender?.track) {
      sender.track.enabled = false;
    }
    sendVideoStatusViaDataChannel();
    return;
  }
  if (camerasList.some(m => m.deviceId === cameraDeviceId)) {
    selectedCameraId = cameraDeviceId;

    const devicesConfig = {
      video: {
        deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
      },
    };

    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia(devicesConfig);
      const videoTrack = newVideoStream.getVideoTracks()[0];
      if (!peerConnection) {
        throw new Error('cannot selectCameraByDeviceId without a peer connection');
      }
      const sender = peerConnection.getSenders().find(s => {
        return s.track?.kind === videoTrack.kind;
      });
      if (sender) {
        await sender.replaceTrack(videoTrack);
        videoTrack.enabled = true;
        mediaDevices?.getVideoTracks().forEach(t => {
          t.stop();
          mediaDevices?.removeTrack(t);
        });
        mediaDevices?.addTrack(videoTrack);
        sendVideoStatusViaDataChannel();
      } else {
        throw new Error('Failed to get sender for selectCameraByDeviceId ');
      }
    } catch (e) {
      window.log.warn('selectCameraByDeviceId failed with', e.message);
    }
  }
}
export async function selectAudioInputByDeviceId(audioInputDeviceId: string) {
  if (audioInputDeviceId === INPUT_DISABLED_DEVICE_ID) {
    selectedAudioInputId = audioInputDeviceId;

    const sender = peerConnection?.getSenders().find(s => {
      return s.track?.kind === 'audio';
    });
    if (sender?.track) {
      sender.track.enabled = false;
    }
    return;
  }
  if (audioInputsList.some(m => m.deviceId === audioInputDeviceId)) {
    selectedAudioInputId = audioInputDeviceId;

    const devicesConfig = {
      audio: {
        deviceId: selectedAudioInputId ? { exact: selectedAudioInputId } : undefined,
      },
    };

    try {
      const newAudioStream = await navigator.mediaDevices.getUserMedia(devicesConfig);
      const audioTrack = newAudioStream.getAudioTracks()[0];
      if (!peerConnection) {
        throw new Error('cannot selectAudioInputByDeviceId without a peer connection');
      }
      const sender = peerConnection.getSenders().find(s => {
        return s.track?.kind === audioTrack.kind;
      });

      if (sender) {
        await sender.replaceTrack(audioTrack);
        // we actually do not need to toggle the track here, as toggling it here unmuted here locally (so we start to hear ourselves)
      } else {
        throw new Error('Failed to get sender for selectAudioInputByDeviceId ');
      }
    } catch (e) {
      window.log.warn('selectAudioInputByDeviceId failed with', e.message);
    }
  }
}

async function handleNegotiationNeededEvent(_event: Event, recipient: string) {
  try {
    makingOffer = true;
    window.log.info('got handleNegotiationNeeded event. creating offer');
    const offer = await peerConnection?.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    if (!offer) {
      throw new Error('Could not create an offer');
    }
    await peerConnection?.setLocalDescription(offer);

    if (offer && offer.sdp) {
      const offerMessage = new CallMessage({
        timestamp: Date.now(),
        type: SignalService.CallMessage.Type.OFFER,
        sdps: [offer.sdp],
      });

      window.log.info('sending OFFER MESSAGE');
      const negotationOfferSendResult = await getMessageQueue().sendToPubKeyNonDurably(
        PubKey.cast(recipient),
        offerMessage
      );
      if (typeof negotationOfferSendResult === 'number') {
        // window.log?.warn('setting last sent timestamp');
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

async function openMediaDevicesAndAddTracks() {
  try {
    await updateInputLists();
    if (!camerasList.length) {
      ToastUtils.pushNoCameraFound();
      return;
    }
    if (!audioInputsList.length) {
      ToastUtils.pushNoAudioInputFound();
      return;
    }

    const firstAudio = audioInputsList[0].deviceId;
    const firstVideo = camerasList[0].deviceId;
    window.log.info(`openMediaDevices video:${firstVideo}   audio:${firstAudio}`);

    const devicesConfig = {
      audio: {
        deviceId: firstAudio,

        echoCancellation: true,
      },
      video: {
        deviceId: firstVideo,
        // width: VIDEO_WIDTH,
        // height: Math.floor(VIDEO_WIDTH * VIDEO_RATIO),
      },
    };

    mediaDevices = await navigator.mediaDevices.getUserMedia(devicesConfig);
    mediaDevices.getTracks().map(track => {
      if (track.kind === 'video') {
        track.enabled = false;
      }
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
  callVideoListener();
}

// tslint:disable-next-line: function-name
export async function USER_callRecipient(recipient: string) {
  await updateInputLists();
  window?.log?.info(`starting call with ${ed25519Str(recipient)}..`);
  window.inboxStore?.dispatch(startingCallWith({ pubkey: recipient }));
  if (peerConnection) {
    throw new Error('USER_callRecipient peerConnection is already initialized ');
  }
  peerConnection = createOrGetPeerConnection(recipient, true);
  await openMediaDevicesAndAddTracks();
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
  window.log.info('closingVideoCall ', peerConnection);
  if (peerConnection) {
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.onsignalingstatechange = null;
    peerConnection.onicegatheringstatechange = null;
    peerConnection.onnegotiationneeded = null;

    if (dataChannel) {
      dataChannel.close();
      dataChannel = null;
    }
    if (mediaDevices) {
      mediaDevices.getTracks().forEach(track => {
        track.stop();
      });
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => {
        remoteStream?.removeTrack(track);
      });
    }

    peerConnection.close();
    peerConnection = null;
  }

  mediaDevices = null;
  remoteStream = null;
  if (videoEventsListener) {
    videoEventsListener(null, null, [], [], true);
  }
}

function onDataChannelReceivedMessage(ev: MessageEvent<string>) {
  try {
    const parsed = JSON.parse(ev.data);

    if (parsed.video !== undefined) {
      remoteVideoStreamIsMuted = !Boolean(parsed.video);
    }
    callVideoListener();
  } catch (e) {
    window.log.warn('onDataChannelReceivedMessage Could not parse data in event', ev);
  }
}
function onDataChannelOnOpen() {
  window.log.info('onDataChannelOnOpen: sending video status');

  sendVideoStatusViaDataChannel();
}

function createOrGetPeerConnection(withPubkey: string, createDataChannel: boolean) {
  if (peerConnection) {
    return peerConnection;
  }
  remoteStream = new MediaStream();
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onnegotiationneeded = async (event: Event) => {
    await handleNegotiationNeededEvent(event, withPubkey);
  };

  peerConnection.ondatachannel = e => {
    if (!createDataChannel) {
      dataChannel = e.channel;
      window.log.info('Got our datachannel setup');

      onDataChannelOnOpen();

      dataChannel.onmessage = onDataChannelReceivedMessage;
    }
  };

  if (createDataChannel) {
    // console.warn('createOrGetPeerConnection: createDataChannel');

    dataChannel = peerConnection.createDataChannel('session-datachannel');

    dataChannel.onmessage = onDataChannelReceivedMessage;
    dataChannel.onopen = onDataChannelOnOpen;
  }
  peerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;

  peerConnection.ontrack = event => {
    event.track.onunmute = () => {
      remoteStream?.addTrack(event.track);
      callVideoListener();
    };
    event.track.onmute = () => {
      remoteStream?.removeTrack(event.track);
      callVideoListener();
    };
  };
  peerConnection.onconnectionstatechange = () => {
    handleConnectionStateChanged(withPubkey);
  };

  peerConnection.onicecandidate = event => {
    handleIceCandidates(event, withPubkey);
  };

  return peerConnection;
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
    throw new Error('USER_acceptIncomingCallRequest: peerConnection is already set.');
  }

  peerConnection = createOrGetPeerConnection(fromSender, false);

  await openMediaDevicesAndAddTracks();

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
  await buildAnswerAndSendIt(fromSender);
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

  const convos = getConversationController().getConversations();
  const callingConvos = convos.filter(convo => convo.callState !== undefined);
  if (callingConvos.length > 0) {
    // we just got a new offer from someone we are already in a call with
    if (callingConvos.length === 1 && callingConvos[0].id === fromSender) {
      closeVideoCall();
    }
  }
}

export function handleCallTypeEndCall(sender: string) {
  callCache.delete(sender);
  window.log.info('handling callMessage END_CALL');

  if (videoEventsListener) {
    videoEventsListener(null, null, [], [], true);
  }
  closeVideoCall();
  //
  // FIXME audric trigger UI cleanup
  window.inboxStore?.dispatch(endCall({ pubkey: sender }));
}

async function buildAnswerAndSendIt(sender: string) {
  if (peerConnection) {
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

    window.log.info('sending ANSWER MESSAGE');

    await getMessageQueue().sendToPubKeyNonDurably(PubKey.cast(sender), callAnswerMessage);
  }
}

export async function handleCallTypeOffer(
  sender: string,
  callMessage: SignalService.CallMessage,
  incomingOfferTimestamp: number
) {
  try {
    window.log.info('handling callMessage OFFER');

    const convos = getConversationController().getConversations();
    const callingConvos = convos.filter(convo => convo.callState !== undefined);
    if (callingConvos.length > 0) {
      // we just got a new offer from someone we are NOT already in a call with
      if (callingConvos.length !== 1 || callingConvos[0].id !== sender) {
        await handleMissedCall(sender, incomingOfferTimestamp);
        return;
      }
    }

    const readyForOffer =
      !makingOffer && (peerConnection?.signalingState === 'stable' || isSettingRemoteAnswerPending);
    const polite = lastOutgoingOfferTimestamp < incomingOfferTimestamp;
    const offerCollision = !readyForOffer;

    ignoreOffer = !polite && offerCollision;
    if (ignoreOffer) {
      window.log?.warn('Received offer when unready for offer; Ignoring offer.');
      return;
    }

    if (callingConvos.length === 1 && callingConvos[0].id === sender) {
      window.log.info('Got a new offer message from our ongoing call');
      isSettingRemoteAnswerPending = false;
      const remoteDesc = new RTCSessionDescription({
        type: 'offer',
        sdp: callMessage.sdps[0],
      });
      isSettingRemoteAnswerPending = false;
      if (peerConnection) {
        await peerConnection.setRemoteDescription(remoteDesc); // SRD rolls back as needed
        await buildAnswerAndSendIt(sender);
      }
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

export async function handleCallTypeAnswer(sender: string, callMessage: SignalService.CallMessage) {
  if (!callMessage.sdps || callMessage.sdps.length === 0) {
    window.log.warn('cannot handle answered message without signal description protols');
    return;
  }

  window.log.info('handling callMessage ANSWER');

  if (!callCache.has(sender)) {
    callCache.set(sender, new Array());
  }

  callCache.get(sender)?.push(callMessage);

  if (!peerConnection) {
    window.log.info('handleCallTypeAnswer without peer connection. Dropping');
    return;
  }
  window.inboxStore?.dispatch(answerCall({ pubkey: sender }));
  const remoteDesc = new RTCSessionDescription({ type: 'answer', sdp: callMessage.sdps[0] });

  // window.log?.info('Setting remote answer pending');
  isSettingRemoteAnswerPending = true;
  await peerConnection?.setRemoteDescription(remoteDesc); // SRD rolls back as needed
  isSettingRemoteAnswerPending = false;
}

export async function handleCallTypeIceCandidates(
  sender: string,
  callMessage: SignalService.CallMessage
) {
  if (!callMessage.sdps || callMessage.sdps.length === 0) {
    window.log.warn('cannot handle iceCandicates message without candidates');
    return;
  }
  window.log.info('handling callMessage ICE_CANDIDATES');

  if (!callCache.has(sender)) {
    callCache.set(sender, new Array());
  }

  callCache.get(sender)?.push(callMessage);
  await addIceCandidateToExistingPeerConnection(callMessage);
}

async function addIceCandidateToExistingPeerConnection(callMessage: SignalService.CallMessage) {
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
export async function handleOtherCallTypes(sender: string, callMessage: SignalService.CallMessage) {
  callCache.get(sender)?.push(callMessage);
}
