// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

export enum PinReminderState {
  Megaphone = 'Megaphone',
  Modal = 'Modal',
  None = 'None',
}

export enum UsernameOnboardingState {
  NeverShown = 'NeverShown',
  Open = 'Open',
  Closed = 'Closed',
}

export type ContactModalStateType = ReadonlyDeep<{
  contactId: string;
  conversationId?: string;
  activeCallDemuxId?: number;
}>;
