import {
  Call,
  CallEndedReason,
  CallId,
  CallLogLevel,
  CallSettings,
  CallState,
  DeviceId,
  RingRTC,
  UserId,
  VideoCapturer,
  VideoRenderer,
} from 'ringrtc';
import {
  ActionsType as UxActionsType,
  CallDetailsType,
} from '../state/ducks/calling';
import { CallingMessageClass, EnvelopeClass } from '../textsecure.d';
import { ConversationModelType } from '../model-types.d';
import is from '@sindresorhus/is';

export {
  CallState,
  CanvasVideoRenderer,
  GumVideoCapturer,
  VideoCapturer,
  VideoRenderer,
} from 'ringrtc';

export type CallHistoryDetailsType = {
  wasIncoming: boolean;
  wasVideoCall: boolean;
  wasDeclined: boolean;
  acceptedTime?: number;
  endedTime: number;
};

export class CallingClass {
  private uxActions?: UxActionsType;

  initialize(uxActions: UxActionsType): void {
    this.uxActions = uxActions;
    if (!uxActions) {
      throw new Error('CallingClass.initialize: Invalid uxActions.');
    }
    if (!is.function_(uxActions.incomingCall)) {
      throw new Error(
        'CallingClass.initialize: Invalid uxActions.incomingCall'
      );
    }
    if (!is.function_(uxActions.outgoingCall)) {
      throw new Error(
        'CallingClass.initialize: Invalid uxActions.outgoingCall'
      );
    }
    if (!is.function_(uxActions.callStateChange)) {
      throw new Error(
        'CallingClass.initialize: Invalid uxActions.callStateChange'
      );
    }
    if (!is.function_(uxActions.remoteVideoChange)) {
      throw new Error(
        'CallingClass.initialize: Invalid uxActions.remoteVideoChange'
      );
    }
    RingRTC.handleOutgoingSignaling = this.handleOutgoingSignaling.bind(this);
    RingRTC.handleIncomingCall = this.handleIncomingCall.bind(this);
    RingRTC.handleAutoEndedIncomingCallRequest = this.handleAutoEndedIncomingCallRequest.bind(
      this
    );
    RingRTC.handleLogMessage = this.handleLogMessage.bind(this);
  }

  async startOutgoingCall(
    conversation: ConversationModelType,
    isVideoCall: boolean
  ) {
    if (!this.uxActions) {
      window.log.error('Missing uxActions, new call not allowed.');
      return;
    }

    if (RingRTC.call && RingRTC.call.state !== CallState.Ended) {
      window.log.info('Call already in progress, new call not allowed.');
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

    // We could make this faster by getting the call object
    // from the RingRTC before we lookup the ICE servers.
    const call = RingRTC.startOutgoingCall(
      remoteUserId,
      isVideoCall,
      this.localDeviceId,
      await this.getCallSettings(conversation)
    );

    this.attachToCall(conversation, call);

    this.uxActions.outgoingCall({
      callDetails: this.getUxCallDetails(conversation, call),
    });
  }

  async accept(callId: CallId, asVideoCall: boolean) {
    const haveMediaPermissions = await this.requestPermissions(asVideoCall);
    if (haveMediaPermissions) {
      RingRTC.accept(callId, asVideoCall);
    } else {
      window.log.info('Permissions were denied, call not allowed, hanging up.');
      RingRTC.hangup(callId);
    }
  }

  decline(callId: CallId) {
    RingRTC.decline(callId);
  }

  hangup(callId: CallId) {
    RingRTC.hangup(callId);
  }

  setOutgoingAudio(callId: CallId, enabled: boolean) {
    RingRTC.setOutgoingAudio(callId, enabled);
  }

  setOutgoingVideo(callId: CallId, enabled: boolean) {
    RingRTC.setOutgoingVideo(callId, enabled);
  }

  setVideoCapturer(callId: CallId, capturer: VideoCapturer | null) {
    RingRTC.setVideoCapturer(callId, capturer);
  }

  setVideoRenderer(callId: CallId, renderer: VideoRenderer | null) {
    RingRTC.setVideoRenderer(callId, renderer);
  }

  async handleCallingMessage(
    envelope: EnvelopeClass,
    callingMessage: CallingMessageClass
  ) {
    const enableIncomingCalls = await window.getIncomingCallNotification();
    if (callingMessage.offer && !enableIncomingCalls) {
      // Drop offers silently if incoming call notifications are disabled.
      window.log.info('Incoming calls are disabled, ignoring call offer.');
      return;
    }

    const remoteUserId = envelope.source || envelope.sourceUuid;
    const remoteDeviceId = this.parseDeviceId(envelope.sourceDevice);
    if (!remoteUserId || !remoteDeviceId || !this.localDeviceId) {
      window.log.error('Missing identifier, ignoring call message.');
      return;
    }

    const messageAgeSec = envelope.messageAgeSec ? envelope.messageAgeSec : 0;

    RingRTC.handleCallingMessage(
      remoteUserId,
      remoteDeviceId,
      this.localDeviceId,
      messageAgeSec,
      callingMessage
    );
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
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  private async handleOutgoingSignaling(
    remoteUserId: UserId,
    message: CallingMessageClass
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

  private async handleIncomingCall(call: Call): Promise<CallSettings | null> {
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
        this.addCallHistoryForFailedIncomingCall(conversation, call);
        return null;
      }

      // Simple Call Requests: Ensure that the conversation is accepted.
      // If not, do not allow the call.
      if (!conversation.getAccepted()) {
        window.log.info(
          `Messaging is not accepted, ignoring incoming call for conversation: ${conversation.idForLogging()}`
        );
        this.addCallHistoryForFailedIncomingCall(conversation, call);
        return null;
      }

      this.attachToCall(conversation, call);

      this.uxActions.incomingCall({
        callDetails: this.getUxCallDetails(conversation, call),
      });

      return await this.getCallSettings(conversation);
    } catch (err) {
      window.log.error(`Ignoring incoming call: ${err.stack}`);
      this.addCallHistoryForFailedIncomingCall(conversation, call);
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

  private attachToCall(conversation: ConversationModelType, call: Call): void {
    const { uxActions } = this;
    if (!uxActions) {
      return;
    }

    let acceptedTime: number | undefined;

    call.handleStateChanged = () => {
      if (call.state === CallState.Accepted) {
        acceptedTime = Date.now();
      } else if (call.state === CallState.Ended) {
        this.addCallHistoryForEndedCall(conversation, call, acceptedTime);
      }
      uxActions.callStateChange({
        callState: call.state,
        callDetails: this.getUxCallDetails(conversation, call),
      });
    };

    call.handleRemoteVideoEnabled = () => {
      uxActions.remoteVideoChange({
        remoteVideoEnabled: call.remoteVideoEnabled,
      });
    };
  }

  private async handleLogMessage(
    level: CallLogLevel,
    fileName: string,
    line: number,
    message: string
  ) {
    // info/warn/error are only needed to be logged for now.
    // tslint:disable-next-line switch-default
    switch (level) {
      case CallLogLevel.Info:
        window.log.info(`${fileName}:${line} ${message}`);
        break;
      case CallLogLevel.Warn:
        window.log.warn(`${fileName}:${line} ${message}`);
        break;
      case CallLogLevel.Error:
        window.log.error(`${fileName}:${line} ${message}`);
    }
  }

  private getRemoteUserIdFromConversation(
    conversation: ConversationModelType
  ): UserId | undefined {
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
    conversation: ConversationModelType
  ): Promise<CallSettings> {
    if (!window.textsecure.messaging) {
      throw new Error('getCallSettings: offline!');
    }

    const iceServerJson = await window.textsecure.messaging.server.getIceServers();

    const shouldRelayCalls = Boolean(await window.getAlwaysRelayCalls());

    // If the peer is 'unknown', i.e. not in the contact list, force IP hiding.
    const isContactUnknown = !conversation.getIsAddedByContact();

    return {
      iceServer: JSON.parse(iceServerJson),
      hideIp: shouldRelayCalls || isContactUnknown,
    };
  }

  private getUxCallDetails(
    conversation: ConversationModelType,
    call: Call
  ): CallDetailsType {
    return {
      ...conversation.cachedProps,

      callId: call.callId,
      isIncoming: call.isIncoming,
      isVideoCall: call.isVideoCall,
    };
  }

  private addCallHistoryForEndedCall(
    conversation: ConversationModelType,
    call: Call,
    acceptedTime: number | undefined
  ) {
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
      // tslint:disable-next-line no-parameter-reassignment
      acceptedTime = Date.now();
    }

    const callHistoryDetails: CallHistoryDetailsType = {
      wasIncoming: call.isIncoming,
      wasVideoCall: call.isVideoCall,
      wasDeclined,
      acceptedTime,
      endedTime: Date.now(),
    };
    conversation.addCallHistory(callHistoryDetails);
  }

  private addCallHistoryForFailedIncomingCall(
    conversation: ConversationModelType,
    call: Call
  ) {
    const callHistoryDetails: CallHistoryDetailsType = {
      wasIncoming: true,
      wasVideoCall: call.isVideoCall,
      // Since the user didn't decline, make sure it shows up as a missed call instead
      wasDeclined: false,
      acceptedTime: undefined,
      endedTime: Date.now(),
    };
    conversation.addCallHistory(callHistoryDetails);
  }

  private addCallHistoryForAutoEndedIncomingCall(
    conversation: ConversationModelType,
    _reason: CallEndedReason
  ) {
    const callHistoryDetails: CallHistoryDetailsType = {
      wasIncoming: true,
      // We don't actually know, but it doesn't seem that important in this case,
      // but we could maybe plumb this info through RingRTC
      wasVideoCall: false,
      // Since the user didn't decline, make sure it shows up as a missed call instead
      wasDeclined: false,
      acceptedTime: undefined,
      endedTime: Date.now(),
    };
    conversation.addCallHistory(callHistoryDetails);
  }
}

export const calling = new CallingClass();
