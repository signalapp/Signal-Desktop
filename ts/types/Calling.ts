// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ConversationType } from '../state/ducks/conversations';

// These are strings (1) for the database (2) for Storybook.
export enum CallMode {
  None = 'None',
  Direct = 'Direct',
  Group = 'Group',
}

interface ActiveCallBaseType {
  conversation: ConversationType;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  joinedAt?: number;
  pip: boolean;
  settingsDialogOpen: boolean;
  showParticipantsList: boolean;
  showSafetyNumberDialog?: boolean;
}

interface ActiveDirectCallType extends ActiveCallBaseType {
  callMode: CallMode.Direct;
  callState?: CallState;
  callEndedReason?: CallEndedReason;
  peekedParticipants: [];
  remoteParticipants: [
    {
      hasRemoteVideo: boolean;
    }
  ];
}

interface ActiveGroupCallType extends ActiveCallBaseType {
  callMode: CallMode.Group;
  connectionState: GroupCallConnectionState;
  conversationsWithSafetyNumberChanges: Array<ConversationType>;
  joinState: GroupCallJoinState;
  maxDevices: number;
  deviceCount: number;
  peekedParticipants: Array<ConversationType>;
  remoteParticipants: Array<GroupCallRemoteParticipantType>;
}

export type ActiveCallType = ActiveDirectCallType | ActiveGroupCallType;

// Ideally, we would import many of these directly from RingRTC. But because Storybook
//   cannot import RingRTC (as it runs in the browser), we have these copies. That also
//   means we have to convert the "real" enum to our enum in some cases.

// Must be kept in sync with RingRTC.CallState
export enum CallState {
  Prering = 'init',
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
  ReceivedOfferExpired = 'ReceivedOfferExpired',
  ReceivedOfferWhileActive = 'ReceivedOfferWhileActive',
  ReceivedOfferWithGlare = 'ReceivedOfferWithGlare',
  SignalingFailure = 'SignalingFailure',
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

export interface GroupCallRemoteParticipantType extends ConversationType {
  demuxId: number;
  hasRemoteAudio: boolean;
  hasRemoteVideo: boolean;
  speakerTime?: number;
  videoAspectRatio: number;
}

// Similar to RingRTC's `VideoRequest` but without the `framerate` property.
export interface GroupCallVideoRequest {
  demuxId: number;
  width: number;
  height: number;
}

// Should match RingRTC's VideoFrameSource
export interface VideoFrameSource {
  receiveVideoFrame(buffer: ArrayBuffer): [number, number] | undefined;
}

// Must be kept in sync with RingRTC.AudioDevice
export interface AudioDevice {
  // Device name.
  name: string;
  // Index of this device, starting from 0.
  index: number;
  // A unique and somewhat stable identifier of this device.
  uniqueId: string;
  // If present, the identifier of a localized string to substitute for the device name.
  i18nKey?: string;
}

export enum CallingDeviceType {
  CAMERA,
  MICROPHONE,
  SPEAKER,
}

export type MediaDeviceSettings = {
  availableMicrophones: Array<AudioDevice>;
  selectedMicrophone: AudioDevice | undefined;
  availableSpeakers: Array<AudioDevice>;
  selectedSpeaker: AudioDevice | undefined;
  availableCameras: Array<MediaDeviceInfo>;
  selectedCamera: string | undefined;
};

interface DirectCallHistoryDetailsType {
  callMode: CallMode.Direct;
  wasIncoming: boolean;
  wasVideoCall: boolean;
  wasDeclined: boolean;
  acceptedTime?: number;
  endedTime: number;
}

interface GroupCallHistoryDetailsType {
  callMode: CallMode.Group;
  creatorUuid: string;
  eraId: string;
  startedTime: number;
}

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
