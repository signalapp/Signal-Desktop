// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import type { Simplify } from 'type-fest';
import { safeParsePartial } from '../util/schemas.std.js';
import { DAY } from '../util/durations/index.std.js';

const SNOOZE_DEFAULT_DURATION_DAYS = 3;
const SNOOZE_DEFAULT_CTA_DATA: RemoteMegaphoneSnoozeCtaType = {
  snoozeDurationDays: [SNOOZE_DEFAULT_DURATION_DAYS],
};
export const SNOOZE_DEFAULT_DURATION = SNOOZE_DEFAULT_DURATION_DAYS * DAY;

export enum MegaphoneType {
  UsernameOnboarding = 'UsernameOnboarding',
  Remote = 'Remote',
}

export type UsernameOnboardingMegaphoneType = {
  type: MegaphoneType.UsernameOnboarding;
};

export type UsernameOnboardingActionableMegaphoneType =
  UsernameOnboardingMegaphoneType & {
    onLearnMore: () => void;
    onDismiss: () => void;
  };

export type VisibleRemoteMegaphoneType = Simplify<
  Omit<RemoteMegaphoneType, 'primaryCtaId' | 'secondaryCtaId'> & {
    primaryCtaId: MegaphoneCtaId | null;
    secondaryCtaId: MegaphoneCtaId | null;
  }
>;

export type RemoteMegaphoneDisplayType = Simplify<
  Readonly<
    Pick<
      VisibleRemoteMegaphoneType,
      | 'title'
      | 'body'
      | 'imagePath'
      | 'primaryCtaId'
      | 'secondaryCtaId'
      | 'primaryCtaText'
      | 'secondaryCtaText'
    > & {
      type: MegaphoneType.Remote;
      remoteMegaphoneId: RemoteMegaphoneId;
    }
  >
>;

export type RemoteActionableMegaphoneType = RemoteMegaphoneDisplayType & {
  onInteractWithMegaphone: (
    megaphoneId: RemoteMegaphoneId,
    ctaId: MegaphoneCtaId
  ) => void;
};

export type AnyActionableMegaphone =
  | UsernameOnboardingActionableMegaphoneType
  | RemoteActionableMegaphoneType;

export type RemoteMegaphoneId = string & { RemoteMegaphoneId: never }; // uuid

export enum MegaphoneCtaId {
  Donate = 'donate',
  Finish = 'finish',
  Snooze = 'snooze',
}

export const RemoteMegaphoneSnoozeCtaSchema = z.object({
  snoozeDurationDays: z.array(z.number()),
});

export type RemoteMegaphoneSnoozeCtaType = z.infer<
  typeof RemoteMegaphoneSnoozeCtaSchema
>;

export const RemoteMegaphoneUnknownCtaDataSchema = z.record(
  z.string(),
  z.any()
);

export const RemoteMegaphoneCtaDataSchema = z.union([
  RemoteMegaphoneSnoozeCtaSchema,
  RemoteMegaphoneUnknownCtaDataSchema,
]);

export const RemoteMegaphoneSchema = z.object({
  // Base remote note
  id: z.intersection(z.string(), z.custom<RemoteMegaphoneId>()),
  desktopMinVersion: z.string().nullable(),
  priority: z.number(),
  dontShowBeforeEpochMs: z.number().int().positive(),
  dontShowAfterEpochMs: z.number().int().positive(),
  showForNumberOfDays: z.number().int().positive(),
  primaryCtaId: z.string().nullable(),
  secondaryCtaId: z.string().nullable(),
  primaryCtaData: RemoteMegaphoneCtaDataSchema.nullable(),
  secondaryCtaData: RemoteMegaphoneCtaDataSchema.nullable(),
  conditionalId: z.string().nullable(),
  // Locale specific remote note
  title: z.string(),
  body: z.string(),
  primaryCtaText: z.string().nullable(),
  secondaryCtaText: z.string().nullable(),
  imagePath: z.string(),
  // Local state
  localeFetched: z.string(),
  shownAt: z.number().int().positive().nullable(),
  snoozedAt: z.number().int().positive().nullable(),
  snoozeCount: z.number().int().positive(),
  isFinished: z.boolean(),
});

export type RemoteMegaphoneType = z.infer<typeof RemoteMegaphoneSchema>;

export function getMegaphoneSnoozeConfig(
  megaphone: RemoteMegaphoneType
): RemoteMegaphoneSnoozeCtaType {
  let parseableCtaData;

  if (megaphone.primaryCtaId === 'snooze') {
    parseableCtaData = megaphone.primaryCtaData;
  } else if (megaphone.secondaryCtaId === 'snooze') {
    parseableCtaData = megaphone.secondaryCtaData;
  } else {
    throw new Error('primaryCtaId or secondaryCtaId must be snooze');
  }

  const result = safeParsePartial(
    RemoteMegaphoneSnoozeCtaSchema,
    parseableCtaData ?? {}
  );
  return result.success ? result.data : SNOOZE_DEFAULT_CTA_DATA;
}

export function getMegaphoneLastSnoozeDurationMs(
  megaphone: RemoteMegaphoneType
): number {
  const { snoozeDurationDays } = getMegaphoneSnoozeConfig(megaphone);
  const lastSnoozeCount = Math.max(megaphone.snoozeCount - 1, 0);
  const snoozeIndex = Math.min(lastSnoozeCount, snoozeDurationDays.length - 1);
  return snoozeDurationDays[snoozeIndex] * DAY;
}
