// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isMuted(): boolean | undefined;
export function setIsMuted(newValue: boolean): void;

export type SubscriberFunction = (isMuted: boolean) => void;

export function subscribe(fn: SubscriberFunction): boolean;
export function unsubscribe(fn: SubscriberFunction): boolean;
