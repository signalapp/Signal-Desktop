// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  RemoteMegaphoneId,
  VisibleRemoteMegaphoneType,
} from '../types/Megaphone.std.js';
import { MegaphoneCtaId } from '../types/Megaphone.std.js';
import { DAY } from './durations/index.std.js';

const INTERNAL_TEST_ID = 'INTERNAL_TEST' as RemoteMegaphoneId;
export const TEST_MEGAPHONE_IMAGE = 'images/donate-heart.png';

export function internalGetTestMegaphone(
  props?: Partial<VisibleRemoteMegaphoneType>
): VisibleRemoteMegaphoneType {
  return {
    priority: 100,
    desktopMinVersion: '1.0.0',
    dontShowBeforeEpochMs: Date.now() - 1 * DAY,
    dontShowAfterEpochMs: Date.now() + 14 * DAY,
    showForNumberOfDays: 30,
    conditionalId: 'internal',
    primaryCtaId: MegaphoneCtaId.Donate,
    primaryCtaData: null,
    secondaryCtaId: MegaphoneCtaId.Snooze,
    secondaryCtaData: { snoozeDurationDays: [5, 7, 100] },
    localeFetched: 'en',
    title: 'Donate Today',
    body: 'As a nonprofit, Signal needs your support.',
    imagePath: TEST_MEGAPHONE_IMAGE,
    primaryCtaText: 'Donate',
    secondaryCtaText: 'Snooze',
    snoozeCount: 0,
    snoozedAt: null,
    shownAt: null,
    isFinished: false,
    ...props,
    id: INTERNAL_TEST_ID,
  };
}

export function isTestMegaphone(
  megaphone: VisibleRemoteMegaphoneType
): boolean {
  return megaphone.id === INTERNAL_TEST_ID;
}

export function isTestMegaphoneId(id: RemoteMegaphoneId): boolean {
  return id === INTERNAL_TEST_ID;
}
