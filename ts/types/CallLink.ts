// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReadonlyDeep } from 'type-fest';
import { z } from 'zod';
import type { ConversationType } from '../state/ducks/conversations';

/**
 * Restrictions
 */

// Must match `CallLinkRestrictions` in @signalapp/ringrtc
export enum CallLinkRestrictions {
  None = 0,
  AdminApproval = 1,
  Unknown = 2,
}

export const callLinkRestrictionsSchema = z.nativeEnum(CallLinkRestrictions);

export function toCallLinkRestrictions(
  restrictions: number
): CallLinkRestrictions {
  return callLinkRestrictionsSchema.parse(restrictions);
}

/**
 * Link
 */

export type CallLinkType = Readonly<{
  roomId: string;
  rootKey: string;
  adminKey: string | null;
  name: string;
  restrictions: CallLinkRestrictions;
  revoked: boolean;
  expiration: number | null;
}>;

// Ephemeral conversation-like type to satisfy components
export type CallLinkConversationType = ReadonlyDeep<
  Omit<ConversationType, 'type'> & {
    type: 'callLink';
    storySendMode?: undefined;
    acknowledgedGroupNameCollisions?: undefined;
  }
>;

// DB Record
export type CallLinkRecord = Readonly<{
  roomId: string;
  rootKey: Uint8Array | null;
  adminKey: Uint8Array | null;
  name: string;
  restrictions: number;
  expiration: number | null;
  revoked: 1 | 0; // sqlite's version of boolean
}>;

export const callLinkRecordSchema = z.object({
  roomId: z.string(),
  // credentials
  rootKey: z.instanceof(Uint8Array).nullable(),
  adminKey: z.instanceof(Uint8Array).nullable(),
  // state
  name: z.string(),
  restrictions: callLinkRestrictionsSchema,
  expiration: z.number().int(),
  revoked: z.union([z.literal(1), z.literal(0)]),
}) satisfies z.ZodType<CallLinkRecord>;
