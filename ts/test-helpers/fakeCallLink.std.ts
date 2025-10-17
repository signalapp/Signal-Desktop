// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { CallLinkStateType, CallLinkType } from '../types/CallLink.std.js';
import type { CallingConversationType } from '../types/Calling.std.js';
import { CallLinkRestrictions } from '../types/CallLink.std.js';
import { MONTH } from '../util/durations/constants.std.js';

export const FAKE_CALL_LINK: CallLinkType = {
  adminKey: null,
  expiration: Date.now() + MONTH, // set me
  name: 'Fun Link',
  restrictions: CallLinkRestrictions.None,
  revoked: false,
  roomId: 'd517b48dd118bee24068d4938886c8abe192706d84936d52594a9157189d2759',
  rootKey: 'dxbb-xfqz-xkgp-nmrx-bpqn-ptkb-spdt-pdgt',
  epoch: null,
  storageID: undefined,
  storageVersion: undefined,
  storageUnknownFields: undefined,
  storageNeedsSync: false,
};

export const FAKE_CALL_LINK_WITH_EPOCH: CallLinkType = {
  adminKey: null,
  expiration: Date.now() + MONTH, // set me
  name: 'Fun Link',
  restrictions: CallLinkRestrictions.None,
  revoked: false,
  roomId: 'd517b48dd118bee24068d4938886c8abe192706d84936d52594a9157189d2759',
  rootKey: 'dxbb-xfqz-xkgp-nmrx-bpqn-ptkb-spdt-pdgt',
  epoch: 'bpmc-mrgn',
  storageID: undefined,
  storageVersion: undefined,
  storageUnknownFields: undefined,
  storageNeedsSync: false,
};

// Please set expiration
export const FAKE_CALL_LINK_WITH_ADMIN_KEY: CallLinkType = {
  adminKey: 'xXPI77e6MoVHYREW8iKYmQ==',
  expiration: Date.now() + MONTH, // set me
  name: 'Admin Link',
  restrictions: CallLinkRestrictions.None,
  revoked: false,
  roomId: 'c097eb04cc278d6bc7ed9fb2ddeac00dc9646ae6ddb38513dad9a8a4fe3c38f4',
  rootKey: 'bpmc-mrgn-hntf-mffd-mndd-xbxk-zmgq-qszg',
  epoch: null,
  storageID: undefined,
  storageVersion: undefined,
  storageUnknownFields: undefined,
  storageNeedsSync: false,
};

// Please set expiration
export const FAKE_CALL_LINK_WITH_ADMIN_KEY_AND_EPOCH: CallLinkType = {
  adminKey: 'xXPI77e6MoVHYREW8iKYmQ==',
  expiration: Date.now() + MONTH, // set me
  name: 'Admin Link',
  restrictions: CallLinkRestrictions.None,
  revoked: false,
  roomId: 'c097eb04cc278d6bc7ed9fb2ddeac00dc9646ae6ddb38513dad9a8a4fe3c38f4',
  rootKey: 'bpmc-mrgn-hntf-mffd-mndd-xbxk-zmgq-qszg',
  epoch: 'dxbb-xfqz',
  storageID: undefined,
  storageVersion: undefined,
  storageUnknownFields: undefined,
  storageNeedsSync: false,
};

export function getCallLinkState(callLink: CallLinkType): CallLinkStateType {
  const { name, restrictions, expiration, revoked } = callLink;
  return { name, restrictions, expiration, revoked };
}

export function getDefaultCallLinkConversation(
  callLinkOverrideProps: Partial<CallLinkType> = {}
): CallingConversationType {
  const { roomId: id, name: title } = {
    ...FAKE_CALL_LINK,
    ...callLinkOverrideProps,
  };
  return {
    id,
    type: 'callLink',
    isMe: false,
    title,
    sharedGroupNames: [],
    acceptedMessageRequest: true,
    badges: [],
  };
}
