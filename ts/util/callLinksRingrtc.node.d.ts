// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Type declarations for callLinksRingrtc stub

export function getRoomIdFromCallLink(url: string): string;
export function callLinkFromRecord(record: unknown): unknown;
export function callLinkToRecord(callLink: unknown): unknown;
export function defunctCallLinkFromRecord(record: unknown): unknown;
export function defunctCallLinkToRecord(defunctCallLink: unknown): unknown;
export function callLinkStateFromRingRTC(state: unknown): unknown;
export function callLinkRestrictionsToRingRTC(restrictions: unknown): unknown;
export function getRoomIdFromRootKey(rootKey: unknown): string;
export function getRoomIdFromRootKeyString(rootKeyString: string): string;
export function getCallLinkRootKeyFromUrlKey(key: string): Uint8Array;
export function toRootKeyBytes(rootKey: string): Uint8Array;
export function fromRootKeyBytes(rootKey: Uint8Array): string;
export function toEpochBytes(epoch: string): Uint8Array;
export function fromEpochBytes(epoch: Uint8Array): string;
