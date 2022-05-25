// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevice } from 'ringrtc';
import type { ConversationType } from '../state/ducks/conversations';

// These are strings (1) for the database (2) for Storybook.
export enum CallMode {
  None = 'None',
  Direct = 'Direct',
  Group = 'Group',
}

// Speaker and Presentation has the same UI, but Presentation mode will switch
// to Grid mode when the presentation is over.
export enum CallViewMode {
  Grid = 'Grid',
  Speaker = 'Speaker',
  Presentation = 'Presentation',
}

export type PresentableSource = {
  appIcon?: string;
  id: string;
  name: string;
  isScreen: boolean;
  thumbnail: string;
};

export type PresentedSource = {
  id: string;
  name: string;
};

type ActiveCallBaseType = {
  conversation: ConversationType;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  localAudioLevel: number;
  viewMode: CallViewMode;
  isSharingScreen?: boolean;
  joinedAt?: number;
  outgoingRing: boolean;
  pip: boolean;
  presentingSource?: PresentedSource;
  presentingSourcesAvailable?: Array<PresentableSource>;
  settingsDialogOpen: boolean;
  showNeedsScreenRecordingPermissionsWarning?: boolean;
  showParticipantsList: boolean;
};

type ActiveDirectCallType = ActiveCallBaseType & {
  callMode: CallMode.Direct;
  callState?: CallState;
  callEndedReason?: CallEndedReason;
  peekedParticipants: [];
  remoteParticipants: [
    {
      hasRemoteVideo: boolean;
      presenting: boolean;
      title: string;
      uuid?: string;
    }
  ];
};

type ActiveGroupCallType = ActiveCallBaseType & {
  callMode: CallMode.Group;
  connectionState: GroupCallConnectionState;
  conversationsWithSafetyNumberChanges: Array<ConversationType>;
  joinState: GroupCallJoinState;
  maxDevices: number;
  deviceCount: number;
  groupMembers: Array<Pick<ConversationType, 'id' | 'firstName' | 'title'>>;
  peekedParticipants: Array<ConversationType>;
  remoteParticipants: Array<GroupCallRemoteParticipantType>;
  remoteAudioLevels: Map<number, number>;
};

export type ActiveCallType = ActiveDirectCallType | ActiveGroupCallType;

// Ideally, we would import many of these directly from RingRTC. But because Storybook
//   cannot import RingRTC (as it runs in the browser), we have these copies. That also
//   means we have to convert the "real" enum to our enum in some cases.

// Must be kept in sync with RingRTC.CallState
export enum CallState {
  Prering = 'idle',
  Ringing = 'ringing',
  Accepted = 'connected',
  Reconnecting = 'connecting',
  Ended = 'ended',
}

// Must be kept in sync with RingRTC.CallEndedReason
export enum CallEndedReason {
  LocalHangup = 'LocalHangup',
  RemoteHangup = 'RemoteHangup',
  RemoteHangupNeedPermission = 'RemoteHangupNeedPermission',
  Declined = 'Declined',
  Busy = 'Busy',
  Glare = 'Glare',
  ReCall = 'ReCall',
  ReceivedOfferExpired = 'ReceivedOfferExpired',
  ReceivedOfferWhileActive = 'ReceivedOfferWhileActive',
  ReceivedOfferWithGlare = 'ReceivedOfferWithGlare',
  SignalingFailure = 'SignalingFailure',
  GlareFailure = 'GlareFailure',
  ConnectionFailure = 'ConnectionFailure',
  InternalFailure = 'InternalFailure',
  Timeout = 'Timeout',
  AcceptedOnAnotherDevice = 'AcceptedOnAnotherDevice',
  DeclinedOnAnotherDevice = 'DeclinedOnAnotherDevice',
  BusyOnAnotherDevice = 'BusyOnAnotherDevice',
  CallerIsNotMultiring = 'CallerIsNotMultiring',
}

// Must be kept in sync with RingRTC's ConnectionState
export enum GroupCallConnectionState {
  NotConnected = 0,
  Connecting = 1,
  Connected = 2,
  Reconnecting = 3,
}

// Must be kept in sync with RingRTC's JoinState
export enum GroupCallJoinState {
  NotJoined = 0,
  Joining = 1,
  Joined = 2,
}

export type GroupCallRemoteParticipantType = ConversationType & {
  demuxId: number;
  hasRemoteAudio: boolean;
  hasRemoteVideo: boolean;
  presenting: boolean;
  sharingScreen: boolean;
  speakerTime?: number;
  videoAspectRatio: number;
};

// Similar to RingRTC's `VideoRequest` but without the `framerate` property.
export type GroupCallVideoRequest = {
  demuxId: number;
  width: number;
  height: number;
};

export enum CallingDeviceType {
  CAMERA,
  MICROPHONE,
  SPEAKER,
}

export type AvailableIODevicesType = {
  availableCameras: Array<MediaDeviceInfo>;
  availableMicrophones: Array<AudioDevice>;
  availableSpeakers: Array<AudioDevice>;
};

export type MediaDeviceSettings = AvailableIODevicesType & {
  selectedMicrophone: AudioDevice | undefined;
  selectedSpeaker: AudioDevice | undefined;
  selectedCamera: string | undefined;
};

type DirectCallHistoryDetailsType = {
  callMode: CallMode.Direct;
  wasIncoming: boolean;
  wasVideoCall: boolean;
  wasDeclined: boolean;
  acceptedTime?: number;
  endedTime: number;
};

type GroupCallHistoryDetailsType = {
  callMode: CallMode.Group;
  creatorUuid: string;
  eraId: string;
  startedTime: number;
};

export type CallHistoryDetailsType =
  | DirectCallHistoryDetailsType
  | GroupCallHistoryDetailsType;

// Old messages weren't saved with a `callMode`.
export type CallHistoryDetailsFromDiskType =
  | (Omit<DirectCallHistoryDetailsType, 'callMode'> &
      Partial<Pick<DirectCallHistoryDetailsType, 'callMode'>>)
  | GroupCallHistoryDetailsType;

export type ChangeIODevicePayloadType =
  | { type: CallingDeviceType.CAMERA; selectedDevice: string }
  | { type: CallingDeviceType.MICROPHONE; selectedDevice: AudioDevice }
  | { type: CallingDeviceType.SPEAKER; selectedDevice: AudioDevice };

export enum ProcessGroupCallRingRequestResult {
  ShouldRing,
  RingWasPreviouslyCanceled,
  ThereIsAnotherActiveRing,
}
