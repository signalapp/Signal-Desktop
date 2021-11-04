import _ from 'lodash';
import { MessageUtils, ToastUtils } from '.';
import { getCallMediaPermissionsSettings } from '../../components/session/settings/SessionSettings';
import { getConversationById } from '../../data/data';
import { ConversationModel } from '../../models/conversation';
import { MessageModelType } from '../../models/messageType';
import { SignalService } from '../../protobuf';
import {
  answerCall,
  callConnected,
  endCall,
  incomingCall,
  setFullScreenCall,
  startingCallWith,
} from '../../state/ducks/conversations';
import { getConversationController } from '../conversations';
import { CallMessage } from '../messages/outgoing/controlMessage/CallMessage';
import { ed25519Str } from '../onions/onionPath';
import { getMessageQueue, MessageSender } from '../sending';
import { PubKey } from '../types';

import { v4 as uuidv4 } from 'uuid';
import { PnServer } from '../../pushnotification';

export type InputItem = { deviceId: string; label: string };

let currentCallUUID: string | undefined;

// const VIDEO_WIDTH = 640;
// const VIDEO_RATIO = 16 / 9;

export type CallManagerOptionsType = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  camerasList: Array<InputItem>;
  audioInputsList: Array<InputItem>;
  isLocalVideoStreamMuted: boolean;
  isRemoteVideoStreamMuted: boolean;
  isAudioMuted: boolean;
};

export type CallManagerListener = ((options: CallManagerOptionsType) => void) | null;
const videoEventsListeners: Array<{ id: string; listener: CallManagerListener }> = [];

function callVideoListeners() {
  if (videoEventsListeners.length) {
    videoEventsListeners.forEach(item => {
      item.listener?.({
        localStream: mediaDevices,
        remoteStream,
        camerasList,
        audioInputsList,
        isRemoteVideoStreamMuted: remoteVideoStreamIsMuted,
        isLocalVideoStreamMuted: selectedCameraId === INPUT_DISABLED_DEVICE_ID,
        isAudioMuted: selectedAudioInputId === INPUT_DISABLED_DEVICE_ID,
      });
    });
  }
}

export function addVideoEventsListener(uniqueId: string, listener: CallManagerListener) {
  const indexFound = videoEventsListeners.findIndex(m => m.id === uniqueId);
  if (indexFound === -1) {
    videoEventsListeners.push({ id: uniqueId, listener });
  } else {
    videoEventsListeners[indexFound].listener = listener;
  }
  callVideoListeners();
}

export function removeVideoEventsListener(uniqueId: string) {
  const indexFound = videoEventsListeners.findIndex(m => m.id === uniqueId);
  if (indexFound !== -1) {
    videoEventsListeners.splice(indexFound);
  }
  callVideoListeners();
}

/**
 * This field stores all the details received about a specific call with the same uuid. It is a per pubkey and per device cache.
 */
const callCache = new Map<string, Map<string, Array<SignalService.CallMessage>>>();

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

const configuration: RTCConfiguration = {
  iceServers: [
    {
      urls: 'turn:freyr.getsession.org',
      username: 'webrtc',
      credential: 'webrtc',
    },
  ],
  // iceTransportPolicy: 'relay', // for now, this cause the connection to break after 30-40 sec if we enable this
};

let selectedCameraId: string = INPUT_DISABLED_DEVICE_ID;
let selectedAudioInputId: string = INPUT_DISABLED_DEVICE_ID;
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
    callVideoListeners();
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
  const videoEnabledLocally = selectedCameraId !== INPUT_DISABLED_DEVICE_ID;
  const stringToSend = JSON.stringify({
    video: videoEnabledLocally,
  });
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel?.send(stringToSend);
  }
}

function sendHangupViaDataChannel() {
  const stringToSend = JSON.stringify({
    hangup: true,
  });
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel?.send(stringToSend);
  }
}

export async function selectCameraByDeviceId(cameraDeviceId: string) {
  if (cameraDeviceId === INPUT_DISABLED_DEVICE_ID) {
    selectedCameraId = INPUT_DISABLED_DEVICE_ID;

    const sender = peerConnection?.getSenders().find(s => {
      return s.track?.kind === 'video';
    });
    if (sender?.track) {
      sender.track.enabled = false;
    }
    sendVideoStatusViaDataChannel();
    callVideoListeners();
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
        callVideoListeners();
      } else {
        throw new Error('Failed to get sender for selectCameraByDeviceId ');
      }
    } catch (e) {
      window.log.warn('selectCameraByDeviceId failed with', e.message);
      callVideoListeners();
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
    callVideoListeners();
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

    callVideoListeners();
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

    if (!currentCallUUID) {
      window.log.warn('cannot send offer without a currentCallUUID');
      throw new Error('cannot send offer without a currentCallUUID');
    }

    if (offer && offer.sdp) {
      const offerMessage = new CallMessage({
        timestamp: Date.now(),
        type: SignalService.CallMessage.Type.OFFER,
        sdps: [offer.sdp],
        uuid: currentCallUUID,
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

    selectedAudioInputId = audioInputsList[0].deviceId;
    selectedCameraId = INPUT_DISABLED_DEVICE_ID;
    window.log.info(
      `openMediaDevices videoDevice:${selectedCameraId}:${camerasList[0].label}   audioDevice:${selectedAudioInputId}`
    );

    const devicesConfig = {
      audio: {
        deviceId: selectedAudioInputId,

        echoCancellation: true,
      },
      video: {
        deviceId: selectedCameraId,
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
    ToastUtils.pushVideoCallPermissionNeeded();
    closeVideoCall();
  }
  callVideoListeners();
}

// tslint:disable-next-line: function-name
export async function USER_callRecipient(recipient: string) {
  if (!getCallMediaPermissionsSettings()) {
    ToastUtils.pushVideoCallPermissionNeeded();
    return;
  }
  if (currentCallUUID) {
    window.log.warn(
      'Looks like we are already in a call as in USER_callRecipient is not undefined'
    );
    return;
  }
  await updateInputLists();
  window?.log?.info(`starting call with ${ed25519Str(recipient)}..`);
  window.inboxStore?.dispatch(startingCallWith({ pubkey: recipient }));
  if (peerConnection) {
    throw new Error('USER_callRecipient peerConnection is already initialized ');
  }
  currentCallUUID = uuidv4();
  peerConnection = createOrGetPeerConnection(recipient, true);
  // send a pre offer just to wake up the device on the remote side
  const preOfferMsg = new CallMessage({
    timestamp: Date.now(),
    type: SignalService.CallMessage.Type.PRE_OFFER,
    uuid: currentCallUUID,
  });

  window.log.info('Sending preOffer message to ', ed25519Str(recipient));
  const rawMessage = await MessageUtils.toRawMessage(PubKey.cast(recipient), preOfferMsg);
  const { wrappedEnvelope } = await MessageSender.send(rawMessage);
  await PnServer.notifyPnServer(wrappedEnvelope, recipient);

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
  if (!currentCallUUID) {
    window.log.warn('Cannot send ice candidates without a currentCallUUID');
    return;
  }
  const callIceCandicates = new CallMessage({
    timestamp: Date.now(),
    type: SignalService.CallMessage.Type.ICE_CANDIDATES,
    sdpMLineIndexes: validCandidates.map(c => c.sdpMLineIndex),
    sdpMids: validCandidates.map(c => c.sdpMid),
    sdps: validCandidates.map(c => c.candidate),
    uuid: currentCallUUID,
  });

  window.log.info('sending ICE CANDIDATES MESSAGE to ', recipient);

  await getMessageQueue().sendToPubKeyNonDurably(PubKey.cast(recipient), callIceCandicates);
}, 2000);

const findLastMessageTypeFromSender = (sender: string, msgType: SignalService.CallMessage.Type) => {
  const msgCacheFromSenderWithDevices = callCache.get(sender);
  if (!msgCacheFromSenderWithDevices) {
    return undefined;
  }

  // FIXME this does not sort by timestamp as we do not have a timestamp stored in the SignalService.CallMessage object...
  const allMsg = _.flattenDeep([...msgCacheFromSenderWithDevices.values()]);
  const allMsgFromType = allMsg.filter(m => m.type === msgType);
  const lastOfferMessage = _.last(allMsgFromType);

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
  window.log.info('closingVideoCall ');
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
  selectedCameraId = INPUT_DISABLED_DEVICE_ID;
  selectedAudioInputId = INPUT_DISABLED_DEVICE_ID;
  currentCallUUID = undefined;
  callVideoListeners();
  window.inboxStore?.dispatch(setFullScreenCall(false));
}

function onDataChannelReceivedMessage(ev: MessageEvent<string>) {
  try {
    const parsed = JSON.parse(ev.data);

    if (parsed.hangup !== undefined) {
      const foundEntry = getConversationController()
        .getConversations()
        .find(
          (convo: ConversationModel) =>
            convo.callState === 'connecting' ||
            convo.callState === 'offering' ||
            convo.callState === 'ongoing'
        );

      if (!foundEntry || !foundEntry.id) {
        return;
      }
      handleCallTypeEndCall(foundEntry.id);

      return;
    }

    if (parsed.video !== undefined) {
      remoteVideoStreamIsMuted = !Boolean(parsed.video);
    }
  } catch (e) {
    window.log.warn('onDataChannelReceivedMessage Could not parse data in event', ev);
  }
  callVideoListeners();
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
    dataChannel = peerConnection.createDataChannel('session-datachannel');

    dataChannel.onmessage = onDataChannelReceivedMessage;
    dataChannel.onopen = onDataChannelOnOpen;
  }
  peerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;

  peerConnection.ontrack = event => {
    event.track.onunmute = () => {
      remoteStream?.addTrack(event.track);
      callVideoListeners();
    };
    event.track.onmute = () => {
      remoteStream?.removeTrack(event.track);
      callVideoListeners();
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
  if (currentCallUUID) {
    window.log.warn(
      'Looks like we are already in a call as in USER_acceptIncomingCallRequest is not undefined'
    );
    return;
  }
  await updateInputLists();

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
  currentCallUUID = uuidv4();

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
    uuid: uuidv4(), // just send a random thing, we just want to reject the call
  });
  // delete all msg not from that uuid only but from that sender pubkey

  window.inboxStore?.dispatch(
    endCall({
      pubkey: fromSender,
    })
  );
  window.log.info('USER_rejectIncomingCallRequest');
  clearCallCacheFromPubkey(fromSender);

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

// tslint:disable-next-line: function-name
export async function USER_hangup(fromSender: string) {
  if (!currentCallUUID) {
    window.log.warn('cannot hangup without a currentCallUUID');
    return;
  }
  const endCallMessage = new CallMessage({
    type: SignalService.CallMessage.Type.END_CALL,
    timestamp: Date.now(),
    uuid: currentCallUUID,
  });

  window.inboxStore?.dispatch(endCall({ pubkey: fromSender }));
  window.log.info('sending hangup with an END_CALL MESSAGE');

  sendHangupViaDataChannel();

  await getMessageQueue().sendToPubKeyNonDurably(PubKey.cast(fromSender), endCallMessage);
  clearCallCacheFromPubkey(fromSender);

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
  clearCallCacheFromPubkey(sender);

  window.log.info('handling callMessage END_CALL');

  const convos = getConversationController().getConversations();
  const callingConvos = convos.filter(convo => convo.callState !== undefined);
  if (callingConvos.length > 0) {
    // we just got a end call event from whoever we are in a call with
    if (callingConvos.length === 1 && callingConvos[0].id === sender) {
      closeVideoCall();

      window.inboxStore?.dispatch(endCall({ pubkey: sender }));
    }
  }
}

async function buildAnswerAndSendIt(sender: string) {
  if (peerConnection) {
    if (!currentCallUUID) {
      window.log.warn('cannot send answer without a currentCallUUID');
      return;
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
      uuid: currentCallUUID,
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
    const remoteCallUUID = callMessage.uuid;
    if (!remoteCallUUID || remoteCallUUID.length === 0) {
      throw new Error('incoming offer call has no valid uuid');
    }
    window.log.info('handling callMessage OFFER with uuid: ', remoteCallUUID);

    const convos = getConversationController().getConversations();
    const callingConvos = convos.filter(convo => convo.callState !== undefined);

    if (!getCallMediaPermissionsSettings()) {
      await handleMissedCall(sender, incomingOfferTimestamp, true);
      return;
    }

    if (callingConvos.length > 0) {
      // we just got a new offer from someone we are NOT already in a call with
      if (callingConvos.length !== 1 || callingConvos[0].id !== sender) {
        await handleMissedCall(sender, incomingOfferTimestamp, false);
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
    window.inboxStore?.dispatch(incomingCall({ pubkey: sender }));

    pushCallMessageToCallCache(sender, remoteCallUUID, callMessage);
  } catch (err) {
    window.log?.error(`Error handling offer message ${err}`);
  }
}

async function handleMissedCall(
  sender: string,
  incomingOfferTimestamp: number,
  isBecauseOfCallPermission: boolean
) {
  const incomingCallConversation = await getConversationById(sender);

  if (!isBecauseOfCallPermission) {
    ToastUtils.pushedMissedCall(
      incomingCallConversation?.getNickname() ||
        incomingCallConversation?.getProfileName() ||
        'Unknown'
    );
  } else {
    ToastUtils.pushedMissedCallCauseOfPermission(
      incomingCallConversation?.getNickname() ||
        incomingCallConversation?.getProfileName() ||
        'Unknown'
    );
  }

  await incomingCallConversation?.addSingleMessage({
    conversationId: incomingCallConversation.id,
    source: sender,
    type: 'incoming' as MessageModelType,
    sent_at: incomingOfferTimestamp,
    received_at: Date.now(),
    expireTimer: 0,
    isMissedCall: true,
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
  const remoteCallUUID = callMessage.uuid;
  if (!remoteCallUUID || remoteCallUUID.length === 0) {
    window.log.warn('handleCallTypeAnswer has no valid uuid');
    return;
  }

  window.log.info('handling callMessage ANSWER');

  pushCallMessageToCallCache(sender, remoteCallUUID, callMessage);

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
  const remoteCallUUID = callMessage.uuid;
  if (!remoteCallUUID || remoteCallUUID.length === 0) {
    window.log.warn('handleCallTypeIceCandidates has no valid uuid');
    return;
  }
  window.log.info('handling callMessage ICE_CANDIDATES');

  pushCallMessageToCallCache(sender, remoteCallUUID, callMessage);
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
  const remoteCallUUID = callMessage.uuid;
  if (!remoteCallUUID || remoteCallUUID.length === 0) {
    window.log.warn('handleOtherCallTypes has no valid uuid');
    return;
  }
  pushCallMessageToCallCache(sender, remoteCallUUID, callMessage);
}

function clearCallCacheFromPubkey(sender: string) {
  callCache.delete(sender);
}

function createCallCacheForPubkeyAndUUID(sender: string, uuid: string) {
  if (!callCache.has(sender)) {
    callCache.set(sender, new Map());
  }

  if (!callCache.get(sender)?.has(uuid)) {
    callCache.get(sender)?.set(uuid, new Array());
  }
}

function pushCallMessageToCallCache(
  sender: string,
  uuid: string,
  callMessage: SignalService.CallMessage
) {
  createCallCacheForPubkeyAndUUID(sender, uuid);
  callCache
    .get(sender)
    ?.get(uuid)
    ?.push(callMessage);
}
