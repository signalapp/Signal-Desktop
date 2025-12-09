// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import {
  Environment,
  getEnvironment,
  isMockEnvironment,
} from '../environment.std.js';

export enum MegaphoneType {
  UsernameOnboarding = 'UsernameOnboarding',
}

export type UsernameOnboardingMegaphoneType = {
  type: MegaphoneType.UsernameOnboarding;
};

export type UsernameOnboardingActionableMegaphoneType =
  UsernameOnboardingMegaphoneType & {
    onLearnMore: () => void;
    onDismiss: () => void;
  };

export type AnyMegaphone = UsernameOnboardingMegaphoneType;

export type AnyActionableMegaphone = UsernameOnboardingActionableMegaphoneType;

export type RemoteMegaphoneId = string & { RemoteMegaphoneId: never }; // uuid

const RemoteMegaphoneSecondaryCtaSnoozeSchema = z.object({
  snoozeDurationDays: z.array(z.number()),
});

export const RemoteMegaphoneUnknownCtaDataSchema = z.record(
  z.string(),
  z.any()
);

export const RemoteMegaphoneSecondaryCtaDataSchema = z.union([
  RemoteMegaphoneSecondaryCtaSnoozeSchema,
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
  primaryCtaData: RemoteMegaphoneUnknownCtaDataSchema.nullable(),
  secondaryCtaData: RemoteMegaphoneSecondaryCtaDataSchema.nullable(),
  conditionalId: z.string().nullable(),
  // Locale specific remote note
  title: z.string(),
  body: z.string(),
  primaryCtaText: z.string().nullable(),
  secondaryCtaText: z.string().nullable(),
  imagePath: z.string().nullable(),
  // Local state
  localeFetched: z.string(),
  shownAt: z.number().int().positive().nullable(),
  snoozedAt: z.number().int().positive().nullable(),
  snoozeCount: z.number().int().positive(),
  isFinished: z.boolean(),
});

export type RemoteMegaphoneType = z.infer<typeof RemoteMegaphoneSchema>;

export function isRemoteMegaphoneEnabled(): boolean {
  const env = getEnvironment();

  if (
    env === Environment.Development ||
    env === Environment.Test ||
    env === Environment.Staging ||
    isMockEnvironment()
  ) {
    return true;
  }

  return false;
}
