// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import { aciSchema, type AciString } from './ServiceId';
import * as Bytes from '../Bytes';
import { parseStrict } from '../util/schemas';

const GROUPV2_ID_LENGTH = 32; // 32 bytes

/**
 * The endorsement for a single group member.
 * Used when sending a group message.
 */
export type GroupSendCombinedEndorsementRecord = Readonly<{
  groupId: string;
  /** Unix timestamp in seconds */
  expiration: number;
  endorsement: Uint8Array;
}>;

/**
 * The endorsement for a single group member.
 *
 * Used when:
 * - Sending a group message to an individual member[1]
 * - Fetching a pre-key bundle for an individual member[1]
 * - Fetching a unversioned profile for an individual member[1]
 *
 * [1]: As a fallback when the access key comes back unauthorized.
 */
export type GroupSendMemberEndorsementRecord = Readonly<{
  groupId: string;
  memberAci: AciString;
  /** Unix timestamp in seconds */
  expiration: number;
  endorsement: Uint8Array;
}>;

/**
 * Deserialized data from a group send endorsements response.
 * Used for updating the database in a single transaction.
 */
export type GroupSendEndorsementsData = Readonly<{
  combinedEndorsement: GroupSendCombinedEndorsementRecord;
  memberEndorsements: ReadonlyArray<GroupSendMemberEndorsementRecord>;
}>;

const groupIdSchema = z.string().refine(value => {
  return Bytes.fromBase64(value).byteLength === GROUPV2_ID_LENGTH;
});

/**
 * Unix timestamp in seconds.
 * Used to trigger a group refresh when the expiration is less than 2 hours away.
 */
export const groupSendEndorsementExpirationSchema = z.number().int().positive(); // not 0

export const groupSendEndorsementSchema = z
  .instanceof(Uint8Array)
  .refine(array => {
    return array.byteLength > 0; // not empty
  });

export const groupSendCombinedEndorsementSchema = z.object({
  groupId: groupIdSchema,
  expiration: groupSendEndorsementExpirationSchema,
  endorsement: groupSendEndorsementSchema,
});

export const groupSendMemberEndorsementSchema = z.object({
  groupId: groupIdSchema,
  memberAci: aciSchema,
  expiration: groupSendEndorsementExpirationSchema,
  endorsement: groupSendEndorsementSchema,
});

export const groupSendEndorsementsDataSchema = z
  .object({
    combinedEndorsement: groupSendCombinedEndorsementSchema,
    memberEndorsements: z.array(groupSendMemberEndorsementSchema).min(1),
  })
  .refine(data => {
    return data.memberEndorsements.every(memberEndorsement => {
      return (
        memberEndorsement.groupId === data.combinedEndorsement.groupId &&
        memberEndorsement.expiration === data.combinedEndorsement.expiration
      );
    });
  });

export const groupSendTokenSchema = z
  .instanceof(Uint8Array)
  .brand('GroupSendToken');

export type GroupSendToken = z.infer<typeof groupSendTokenSchema>;

export function toGroupSendToken(token: Uint8Array): GroupSendToken {
  return parseStrict(groupSendTokenSchema, token);
}
