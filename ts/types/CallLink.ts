// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReadonlyDeep } from 'type-fest';
import { z } from 'zod';
import type { CallLinkRestrictions as RingRTCCallLinkRestrictions } from '@signalapp/ringrtc';
import type { ConversationType } from '../state/ducks/conversations';

export type CallLinkConversationType = ReadonlyDeep<
  Omit<ConversationType, 'type'> & {
    type: 'callLink';
    storySendMode?: undefined;
    acknowledgedGroupNameCollisions?: undefined;
  }
>;

// Must match `CallLinkRestrictions` in @signalapp/ringrtc
export enum CallLinkRestrictions {
  None = 0,
  AdminApproval = 1,
  Unknown = 2,
}

export const callLinkRestrictionsSchema = z.nativeEnum(
  CallLinkRestrictions
) satisfies z.ZodType<RingRTCCallLinkRestrictions>;

export type CallLinkType = Readonly<{
  roomId: string;
  rootKey: string;
  name: string;
  restrictions: CallLinkRestrictions;
  expiration: number;
}>;
