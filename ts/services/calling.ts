// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable class-methods-use-this */

import {
  Call,
  CallEndedReason,
  CallId,
  CallingMessage,
  CallLogLevel,
  CallSettings,
  CallState,
  CanvasVideoRenderer,
  DeviceId,
  GumVideoCapturer,
  HangupMessage,
  HangupType,
  OfferType,
  RingRTC,
  UserId,
} from 'ringrtc';

import { ActionsType as UxActionsType } from '../state/ducks/calling';
import { EnvelopeClass } from '../textsecure.d';
import { AudioDevice, MediaDeviceSettings } from '../types/Calling';
import { ConversationModel } from '../models/conversations';

export {
  CallState,
  CanvasVideoRenderer,
  GumVideoCapturer,
  VideoCapturer,
  VideoRenderer,
} from 'ringrtc';

export class CallingClass {
  readonly videoCapturer: GumVideoCapturer;

  readonly videoRenderer: CanvasVideoRenderer;

  private uxActions?: UxActionsType;

  private lastMediaDeviceSettings?: MediaDeviceSettings;

  private deviceReselectionTimer?: NodeJS.Timeout;

  private callsByConversation: { [conversationId: string]: Call };

  constructor() {
    this.videoCapturer = new GumVideoCapturer(640, 480, 30);
    this.videoRenderer = new CanvasVideoRenderer();

    this.callsByConversation = {};
  }

  initialize(uxActions: UxActionsType): void {
    this.uxActions = uxActions;
    if (!uxActions) {
      throw new Error('CallingClass.initialize: Invalid uxActions.');
    }
    RingRTC.handleOutgoingSignaling = this.handleOutgoingSignaling.bind(this);
    RingRTC.handleIncomingCall = this.handleIncomingCall.bind(this);
    RingRTC.handleAutoEndedIncomingCallRequest = this.handleAutoEndedIncomingCallRequest.bind(
      this
    );
    RingRTC.handleLogMessage = this.handleLogMessage.bind(this);
  }

  async startCallingLobby(
    conversation: ConversationModel,
    isVideoCall: boolean
  ): Promise<void> {
    window.log.info('CallingClass.startCallingLobby()');

    if (!this.uxActions) {
      window.log.error('Missing uxActions, new call not allowed.');
      return;
    }

    const remoteUserId = this.getRemoteUserIdFromConversation(conversation);
    if (!remoteUserId || !this.localDeviceId) {
      window.log.error('Missing identifier, new call not allowed.');
      return;
    }

    const haveMediaPermissions = await this.requestPermissions(isVideoCall);
    if (!haveMediaPermissions) {
      window.log.info('Permissions were denied, new call not allowed.');
      return;
    }

    window.log.info('CallingClass.startCallingLobby(): Getting call settings');

    // Check state after awaiting to debounce call button.
    if (RingRTC.call && RingRTC.call.state !== CallState.Ended) {
      window.log.info('Call already in progress, new call not allowed.');
      return;
    }

    const conversationProps = conversation.format();

    window.log.info('CallingClass.startCallingLobby(): Starting lobby');
    this.uxActions.showCallLobby({
      conversationId: conversationProps.id,
      isVideoCall,
    });

    await this.startDeviceReselectionTimer();

    if (isVideoCall) {
      this.enableLocalCamera();
    }
  }

  stopCallingLobby(): void {
    this.disableLocalCamera();
    this.stopDeviceReselectionTimer();
    this.lastMediaDeviceSettings = undefined;
  }

  async startOutgoingCall(
    conversationId: string,
    hasLocalAudio: boolean,
    hasLocalVideo: boolean
  ): Promise<void> {
    window.log.info('CallingClass.startCallingLobby()');

    if (!this.uxActions) {
      throw new Error('Redux actions not available');
    }

    const conversation = window.ConversationController.get(conversationId);

    if (!conversation) {
      window.log.error('Could not find conversation, cannot start call');
      this.stopCallingLobby();
      return;
    }

    const remoteUserId = this.getRemoteUserIdFromConversation(conversation);
    if (!remoteUserId || !this.localDeviceId) {
      window.log.error('Missing identifier, new call not allowed.');
      this.stopCallingLobby();
      return;
    }

    const haveMediaPermissions = await this.requestPermissions(hasLocalVideo);
    if (!haveMediaPermissions) {
      window.log.info('Permissions were denied, new call not allowed.');
      this.stopCallingLobby();
      return;
    }

    window.log.info('CallingClass.startOutgoingCall(): Getting call settings');

    const callSettings = await this.getCallSettings(conversation);

    // Check state after awaiting to debounce call button.
    if (RingRTC.call && RingRTC.call.state !== CallState.Ended) {
      window.log.info('Call already in progress, new call not allowed.');
      this.stopCallingLobby();
      return;
    }

    window.log.info('CallingClass.startOutgoingCall(): Starting in RingRTC');

    // We could make this faster by getting the call object
    // from the RingRTC before we lookup the ICE servers.
    const call = RingRTC.startOutgoingCall(
      remoteUserId,
      hasLocalVideo,
      this.localDeviceId,
      callSettings
    );

    RingRTC.setOutgoingAudio(call.callId, hasLocalAudio);
    RingRTC.setVideoCapturer(call.callId, this.videoCapturer);
    RingRTC.setVideoRenderer(call.callId, this.videoRenderer);
    this.attachToCall(conversation, call);

    this.uxActions.outgoingCall({
      conversationId: conversation.id,
      hasLocalAudio,
      hasLocalVideo,
    });

    await this.startDeviceReselectionTimer();
  }

  private getCallIdForConversation(conversationId: string): undefined | CallId {
    return this.callsByConversation[conversationId]?.callId;
  }

  async accept(conversationId: string, asVideoCall: boolean): Promise<void> {
    window.log.info('CallingClass.accept()');

    const callId = this.getCallIdForConversation(conversationId);
    if (!callId) {
      window.log.warn('Trying to accept a non-existent call');
      return;
    }

    const haveMediaPermissions = await this.requestPermissions(asVideoCall);
    if (haveMediaPermissions) {
      await this.startDeviceReselectionTimer();
      RingRTC.setVideoCapturer(callId, this.videoCapturer);
      RingRTC.setVideoRenderer(callId, this.videoRenderer);
      RingRTC.accept(callId, asVideoCall);
    } else {
      window.log.info('Permissions were denied, call not allowed, hanging up.');
      RingRTC.hangup(callId);
    }
  }

  decline(conversationId: string): void {
    window.log.info('CallingClass.decline()');

    const callId = this.getCallIdForConversation(conversationId);
    if (!callId) {
      window.log.warn('Trying to decline a non-existent call');
      return;
    }

    RingRTC.decline(callId);
  }

  hangup(conversationId: string): void {
    window.log.info('CallingClass.hangup()');

    const callId = this.getCallIdForConversation(conversationId);
    if (!callId) {
      window.log.warn('Trying to hang up a non-existent call');
      return;
    }

    RingRTC.hangup(callId);
  }

  setOutgoingAudio(conversationId: string, enabled: boolean): void {
    const callId = this.getCallIdForConversation(conversationId);
    if (!callId) {
      window.log.warn('Trying to set outgoing audio for a non-existent call');
      return;
    }

    RingRTC.setOutgoingAudio(callId, enabled);
  }

  setOutgoingVideo(conversationId: string, enabled: boolean): void {
    const callId = this.getCallIdForConversation(conversationId);
    if (!callId) {
      window.log.warn('Trying to set outgoing video for a non-existent call');
      return;
    }

    RingRTC.setOutgoingVideo(callId, enabled);
  }

  private async startDeviceReselectionTimer(): Promise<void> {
    // Poll once
    await this.pollForMediaDevices();
    // Start the timer
    if (!this.deviceReselectionTimer) {
      this.deviceReselectionTimer = setInterval(async () => {
        await this.pollForMediaDevices();
      }, 3000);
    }
  }

  private stopDeviceReselectionTimer() {
    if (this.deviceReselectionTimer) {
      clearInterval(this.deviceReselectionTimer);
      this.deviceReselectionTimer = undefined;
    }
  }

  private mediaDeviceSettingsEqual(
    a?: MediaDeviceSettings,
    b?: MediaDeviceSettings
  ): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    if (
      a.availableCameras.length !== b.availableCameras.length ||
      a.availableMicrophones.length !== b.availableMicrophones.length ||
      a.availableSpeakers.length !== b.availableSpeakers.length
    ) {
      return false;
    }
    for (let i = 0; i < a.availableCameras.length; i += 1) {
      if (
        a.availableCameras[i].deviceId !== b.availableCameras[i].deviceId ||
        a.availableCameras[i].groupId !== b.availableCameras[i].groupId ||
        a.availableCameras[i].label !== b.availableCameras[i].label
      ) {
        return false;
      }
    }
    for (let i = 0; i < a.availableMicrophones.length; i += 1) {
      if (
        a.availableMicrophones[i].name !== b.availableMicrophones[i].name ||
        a.availableMicrophones[i].uniqueId !==
          b.availableMicrophones[i].uniqueId
      ) {
        return false;
      }
    }
    for (let i = 0; i < a.availableSpeakers.length; i += 1) {
      if (
        a.availableSpeakers[i].name !== b.availableSpeakers[i].name ||
        a.availableSpeakers[i].uniqueId !== b.availableSpeakers[i].uniqueId
      ) {
        return false;
      }
    }
    if (
      (a.selectedCamera && !b.selectedCamera) ||
      (!a.selectedCamera && b.selectedCamera) ||
      (a.selectedMicrophone && !b.selectedMicrophone) ||
      (!a.selectedMicrophone && b.selectedMicrophone) ||
      (a.selectedSpeaker && !b.selectedSpeaker) ||
      (!a.selectedSpeaker && b.selectedSpeaker)
    ) {
      return false;
    }
    if (
      a.selectedCamera &&
      b.selectedCamera &&
      a.selectedCamera !== b.selectedCamera
    ) {
      return false;
    }
    if (
      a.selectedMicrophone &&
      b.selectedMicrophone &&
      a.selectedMicrophone.index !== b.selectedMicrophone.index
    ) {
      return false;
    }
    if (
      a.selectedSpeaker &&
      b.selectedSpeaker &&
      a.selectedSpeaker.index !== b.selectedSpeaker.index
    ) {
      return false;
    }
    return true;
  }

  private async pollForMediaDevices(): Promise<void> {
    const newSettings = await this.getMediaDeviceSettings();
    if (
      !this.mediaDeviceSettingsEqual(this.lastMediaDeviceSettings, newSettings)
    ) {
      window.log.info(
        'MediaDevice: available devices changed (from->to)',
        this.lastMediaDeviceSettings,
        newSettings
      );

      await this.selectPreferredDevices(newSettings);
      this.lastMediaDeviceSettings = newSettings;
      this.uxActions?.refreshIODevices(newSettings);
    }
  }

  async getMediaDeviceSettings(): Promise<MediaDeviceSettings> {
    const availableMicrophones = RingRTC.getAudioInputs();
    const preferredMicrophone = window.storage.get(
      'preferred-audio-input-device'
    );
    const selectedMicIndex = this.findBestMatchingDeviceIndex(
      availableMicrophones,
      preferredMicrophone
    );
    const selectedMicrophone =
      selectedMicIndex !== undefined
        ? availableMicrophones[selectedMicIndex]
        : undefined;

    const availableSpeakers = RingRTC.getAudioOutputs();
    const preferredSpeaker = window.storage.get(
      'preferred-audio-output-device'
    );
    const selectedSpeakerIndex = this.findBestMatchingDeviceIndex(
      availableSpeakers,
      preferredSpeaker
    );
    const selectedSpeaker =
      selectedSpeakerIndex !== undefined
        ? availableSpeakers[selectedSpeakerIndex]
        : undefined;

    const availableCameras = await this.videoCapturer.enumerateDevices();
    const preferredCamera = window.storage.get('preferred-video-input-device');
    const selectedCamera = this.findBestMatchingCamera(
      availableCameras,
      preferredCamera
    );

    return {
      availableMicrophones,
      availableSpeakers,
      selectedMicrophone,
      selectedSpeaker,
      availableCameras,
      selectedCamera,
    };
  }

  findBestMatchingDeviceIndex(
    available: Array<AudioDevice>,
    preferred: AudioDevice | undefined
  ): number | undefined {
    if (preferred) {
      // Match by uniqueId first, if available
      if (preferred.uniqueId) {
        const matchIndex = available.findIndex(
          d => d.uniqueId === preferred.uniqueId
        );
        if (matchIndex !== -1) {
          return matchIndex;
        }
      }
      // Match by name second
      const matchingNames = available.filter(d => d.name === preferred.name);
      if (matchingNames.length > 0) {
        return matchingNames[0].index;
      }
    }
    // Nothing matches or no preference; take the first device if there are any
    return available.length > 0 ? 0 : undefined;
  }

  findBestMatchingCamera(
    available: Array<MediaDeviceInfo>,
    preferred?: string
  ): string | undefined {
    const matchingId = available.filter(d => d.deviceId === preferred);
    const nonInfrared = available.filter(d => !d.label.includes('IR Camera'));

    // By default, pick the first non-IR camera (but allow the user to pick the
    // infrared if they so desire)
    if (matchingId.length > 0) {
      return matchingId[0].deviceId;
    }
    if (nonInfrared.length > 0) {
      return nonInfrared[0].deviceId;
    }

    return undefined;
  }

  setPreferredMicrophone(device: AudioDevice): void {
    window.log.info('MediaDevice: setPreferredMicrophone', device);
    window.storage.put('preferred-audio-input-device', device);
    RingRTC.setAudioInput(device.index);
  }

  setPreferredSpeaker(device: AudioDevice): void {
    window.log.info('MediaDevice: setPreferredSpeaker', device);
    window.storage.put('preferred-audio-output-device', device);
    RingRTC.setAudioOutput(device.index);
  }

  enableLocalCamera(): void {
    this.videoCapturer.enableCapture();
  }

  disableLocalCamera(): void {
    this.videoCapturer.disable();
  }

  async setPreferredCamera(device: string): Promise<void> {
    window.log.info('MediaDevice: setPreferredCamera', device);
    window.storage.put('preferred-video-input-device', device);
    await this.videoCapturer.setPreferredDevice(device);
  }

  async handleCallingMessage(
    envelope: EnvelopeClass,
    callingMessage: CallingMessage
  ): Promise<void> {
    window.log.info('CallingClass.handleCallingMessage()');

    const enableIncomingCalls = await window.getIncomingCallNotification();
    if (callingMessage.offer && !enableIncomingCalls) {
      // Drop offers silently if incoming call notifications are disabled.
      window.log.info('Incoming calls are disabled, ignoring call offer.');
      return;
    }

    const remoteUserId = envelope.sourceUuid || envelope.source;
    const remoteDeviceId = this.parseDeviceId(envelope.sourceDevice);
    if (!remoteUserId || !remoteDeviceId || !this.localDeviceId) {
      window.log.error('Missing identifier, ignoring call message.');
      return;
    }

    const senderIdentityRecord = window.textsecure.storage.protocol.getIdentityRecord(
      remoteUserId
    );
    if (!senderIdentityRecord) {
      window.log.error(
        'Missing sender identity record; ignoring call message.'
      );
      return;
    }
    const senderIdentityKey = senderIdentityRecord.publicKey.slice(1); // Ignore the type header, it is not used.

    const receiverIdentityRecord = window.textsecure.storage.protocol.getIdentityRecord(
      window.textsecure.storage.user.getUuid() ||
        window.textsecure.storage.user.getNumber()
    );
    if (!receiverIdentityRecord) {
      window.log.error(
        'Missing receiver identity record; ignoring call message.'
      );
      return;
    }
    const receiverIdentityKey = receiverIdentityRecord.publicKey.slice(1); // Ignore the type header, it is not used.

    const conversation = window.ConversationController.get(remoteUserId);
    if (!conversation) {
      window.log.error('Missing conversation; ignoring call message.');
      return;
    }

    if (callingMessage.offer && !conversation.getAccepted()) {
      window.log.info(
        'Conversation was not approved by user; rejecting call message.'
      );

      const hangup = new HangupMessage();
      hangup.callId = callingMessage.offer.callId;
      hangup.deviceId = remoteDeviceId;
      hangup.type = HangupType.NeedPermission;

      const message = new CallingMessage();
      message.legacyHangup = hangup;

      await this.handleOutgoingSignaling(remoteUserId, message);

      this.addCallHistoryForFailedIncomingCall(
        conversation,
        callingMessage.offer.type === OfferType.VideoCall
      );

      return;
    }

    const messageAgeSec = envelope.messageAgeSec ? envelope.messageAgeSec : 0;

    window.log.info('CallingClass.handleCallingMessage(): Handling in RingRTC');

    RingRTC.handleCallingMessage(
      remoteUserId,
      null,
      remoteDeviceId,
      this.localDeviceId,
      messageAgeSec,
      callingMessage,
      senderIdentityKey,
      receiverIdentityKey
    );
  }

  private async selectPreferredDevices(
    settings: MediaDeviceSettings
  ): Promise<void> {
    if (
      (!this.lastMediaDeviceSettings && settings.selectedCamera) ||
      (this.lastMediaDeviceSettings &&
        settings.selectedCamera &&
        this.lastMediaDeviceSettings.selectedCamera !== settings.selectedCamera)
    ) {
      window.log.info('MediaDevice: selecting camera', settings.selectedCamera);
      await this.videoCapturer.setPreferredDevice(settings.selectedCamera);
    }

    // Assume that the MediaDeviceSettings have been obtained very recently and
    // the index is still valid (no devices have been plugged in in between).
    if (settings.selectedMicrophone) {
      window.log.info(
        'MediaDevice: selecting microphone',
        settings.selectedMicrophone
      );
      RingRTC.setAudioInput(settings.selectedMicrophone.index);
    }

    if (settings.selectedSpeaker) {
      window.log.info(
        'MediaDevice: selecting speaker',
        settings.selectedMicrophone
      );
      RingRTC.setAudioOutput(settings.selectedSpeaker.index);
    }
  }

  private async requestCameraPermissions(): Promise<boolean> {
    const cameraPermission = await window.getMediaCameraPermissions();
    if (!cameraPermission) {
      await window.showCallingPermissionsPopup(true);

      // Check the setting again (from the source of truth).
      return window.getMediaCameraPermissions();
    }

    return true;
  }

  private async requestMicrophonePermissions(): Promise<boolean> {
    const microphonePermission = await window.getMediaPermissions();
    if (!microphonePermission) {
      await window.showCallingPermissionsPopup(false);

      // Check the setting again (from the source of truth).
      return window.getMediaPermissions();
    }

    return true;
  }

  private async requestPermissions(isVideoCall: boolean): Promise<boolean> {
    const microphonePermission = await this.requestMicrophonePermissions();
    if (microphonePermission) {
      if (isVideoCall) {
        return this.requestCameraPermissions();
      }

      return true;
    }

    return false;
  }

  private async handleOutgoingSignaling(
    remoteUserId: UserId,
    message: CallingMessage
  ): Promise<boolean> {
    const conversation = window.ConversationController.get(remoteUserId);
    const sendOptions = conversation
      ? conversation.getSendOptions()
      : undefined;

    if (!window.textsecure.messaging) {
      window.log.warn('handleOutgoingSignaling() returning false; offline');
      return false;
    }

    try {
      await window.textsecure.messaging.sendCallingMessage(
        remoteUserId,
        message,
        sendOptions
      );

      window.log.info('handleOutgoingSignaling() completed successfully');
      return true;
    } catch (err) {
      if (err && err.errors && err.errors.length > 0) {
        window.log.error(
          `handleOutgoingSignaling() failed: ${err.errors[0].reason}`
        );
      } else {
        window.log.error('handleOutgoingSignaling() failed');
      }
      return false;
    }
  }

  // If we return null here, we hang up the call.
  private async handleIncomingCall(call: Call): Promise<CallSettings | null> {
    window.log.info('CallingClass.handleIncomingCall()');

    if (!this.uxActions || !this.localDeviceId) {
      window.log.error('Missing required objects, ignoring incoming call.');
      return null;
    }

    const conversation = window.ConversationController.get(call.remoteUserId);
    if (!conversation) {
      window.log.error('Missing conversation, ignoring incoming call.');
      return null;
    }

    try {
      // The peer must be 'trusted' before accepting a call from them.
      // This is mostly the safety number check, unverified meaning that they were
      // verified before but now they are not.
      const verifiedEnum = await conversation.safeGetVerified();
      if (
        verifiedEnum ===
        window.textsecure.storage.protocol.VerifiedStatus.UNVERIFIED
      ) {
        window.log.info(
          `Peer is not trusted, ignoring incoming call for conversation: ${conversation.idForLogging()}`
        );
        this.addCallHistoryForFailedIncomingCall(
          conversation,
          call.isVideoCall
        );
        return null;
      }

      this.attachToCall(conversation, call);

      this.uxActions.receiveIncomingCall({
        conversationId: conversation.id,
        isVideoCall: call.isVideoCall,
      });

      window.log.info('CallingClass.handleIncomingCall(): Proceeding');

      return await this.getCallSettings(conversation);
    } catch (err) {
      window.log.error(`Ignoring incoming call: ${err.stack}`);
      this.addCallHistoryForFailedIncomingCall(conversation, call.isVideoCall);
      return null;
    }
  }

  private handleAutoEndedIncomingCallRequest(
    remoteUserId: UserId,
    reason: CallEndedReason
  ) {
    const conversation = window.ConversationController.get(remoteUserId);
    if (!conversation) {
      return;
    }
    this.addCallHistoryForAutoEndedIncomingCall(conversation, reason);
  }

  private attachToCall(conversation: ConversationModel, call: Call): void {
    this.callsByConversation[conversation.id] = call;

    const { uxActions } = this;
    if (!uxActions) {
      return;
    }

    let acceptedTime: number | undefined;

    // eslint-disable-next-line no-param-reassign
    call.handleStateChanged = () => {
      if (call.state === CallState.Accepted) {
        acceptedTime = acceptedTime || Date.now();
      } else if (call.state === CallState.Ended) {
        this.addCallHistoryForEndedCall(conversation, call, acceptedTime);
        this.stopDeviceReselectionTimer();
        this.lastMediaDeviceSettings = undefined;
        delete this.callsByConversation[conversation.id];
      }
      uxActions.callStateChange({
        conversationId: conversation.id,
        acceptedTime,
        callState: call.state,
        callEndedReason: call.endedReason,
        isIncoming: call.isIncoming,
        isVideoCall: call.isVideoCall,
        title: conversation.getTitle(),
      });
    };

    // eslint-disable-next-line no-param-reassign
    call.handleRemoteVideoEnabled = () => {
      uxActions.remoteVideoChange({
        conversationId: conversation.id,
        hasVideo: call.remoteVideoEnabled,
      });
    };
  }

  private async handleLogMessage(
    level: CallLogLevel,
    fileName: string,
    line: number,
    message: string
  ) {
    switch (level) {
      case CallLogLevel.Info:
        window.log.info(`${fileName}:${line} ${message}`);
        break;
      case CallLogLevel.Warn:
        window.log.warn(`${fileName}:${line} ${message}`);
        break;
      case CallLogLevel.Error:
        window.log.error(`${fileName}:${line} ${message}`);
        break;
      default:
        break;
    }
  }

  private getRemoteUserIdFromConversation(
    conversation: ConversationModel
  ): UserId | undefined | null {
    const recipients = conversation.getRecipients();
    if (recipients.length !== 1) {
      return undefined;
    }
    return recipients[0];
  }

  private get localDeviceId(): DeviceId | null {
    return this.parseDeviceId(window.textsecure.storage.user.getDeviceId());
  }

  private parseDeviceId(
    deviceId: number | string | undefined
  ): DeviceId | null {
    if (typeof deviceId === 'string') {
      return parseInt(deviceId, 10);
    }
    if (typeof deviceId === 'number') {
      return deviceId;
    }
    return null;
  }

  private async getCallSettings(
    conversation: ConversationModel
  ): Promise<CallSettings> {
    if (!window.textsecure.messaging) {
      throw new Error('getCallSettings: offline!');
    }

    const iceServerJson = await window.textsecure.messaging.server.getIceServers();

    const shouldRelayCalls = Boolean(await window.getAlwaysRelayCalls());

    // If the peer is 'unknown', i.e. not in the contact list, force IP hiding.
    const isContactUnknown = !conversation.isFromOrAddedByTrustedContact();

    return {
      iceServer: JSON.parse(iceServerJson),
      hideIp: shouldRelayCalls || isContactUnknown,
    };
  }

  private addCallHistoryForEndedCall(
    conversation: ConversationModel,
    call: Call,
    acceptedTimeParam: number | undefined
  ) {
    let acceptedTime = acceptedTimeParam;

    const { endedReason, isIncoming } = call;
    const wasAccepted = Boolean(acceptedTime);
    const isOutgoing = !isIncoming;
    const wasDeclined =
      !wasAccepted &&
      (endedReason === CallEndedReason.Declined ||
        endedReason === CallEndedReason.DeclinedOnAnotherDevice ||
        (isIncoming && endedReason === CallEndedReason.LocalHangup) ||
        (isOutgoing && endedReason === CallEndedReason.RemoteHangup) ||
        (isOutgoing &&
          endedReason === CallEndedReason.RemoteHangupNeedPermission));
    if (call.endedReason === CallEndedReason.AcceptedOnAnotherDevice) {
      acceptedTime = Date.now();
    }

    conversation.addCallHistory({
      wasIncoming: call.isIncoming,
      wasVideoCall: call.isVideoCall,
      wasDeclined,
      acceptedTime,
      endedTime: Date.now(),
    });
  }

  private addCallHistoryForFailedIncomingCall(
    conversation: ConversationModel,
    wasVideoCall: boolean
  ) {
    conversation.addCallHistory({
      wasIncoming: true,
      wasVideoCall,
      // Since the user didn't decline, make sure it shows up as a missed call instead
      wasDeclined: false,
      acceptedTime: undefined,
      endedTime: Date.now(),
    });
  }

  private addCallHistoryForAutoEndedIncomingCall(
    conversation: ConversationModel,
    _reason: CallEndedReason
  ) {
    conversation.addCallHistory({
      wasIncoming: true,
      // We don't actually know, but it doesn't seem that important in this case,
      // but we could maybe plumb this info through RingRTC
      wasVideoCall: false,
      // Since the user didn't decline, make sure it shows up as a missed call instead
      wasDeclined: false,
      acceptedTime: undefined,
      endedTime: Date.now(),
    });
  }
}

export const calling = new CallingClass();
