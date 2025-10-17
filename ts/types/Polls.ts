// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { isAciString } from '../util/isAciString.std.js';
import { hasAtMostGraphemes } from '../util/grapheme.std.js';
import {
  Environment,
  getEnvironment,
  isMockEnvironment,
} from '../environment.std.js';
import * as RemoteConfig from '../RemoteConfig.dom.js';
import { isAlpha, isBeta, isProduction } from '../util/version.std.js';

// PollCreate schema (processed shape)
// - question: required, 1..100 chars
// - options: required, 2..10 items; each 1..100 chars
// - allowMultiple: optional boolean
export const PollCreateSchema = z
  .object({
    question: z
      .string()
      .min(1)
      .refine(value => hasAtMostGraphemes(value, 100), {
        message: 'question must contain at most 100 characters',
      }),
    options: z
      .array(
        z
          .string()
          .min(1)
          .refine(value => hasAtMostGraphemes(value, 100), {
            message: 'option must contain at most 100 characters',
          })
      )
      .min(2)
      .max(10)
      .readonly(),
    allowMultiple: z.boolean().optional(),
  })
  .describe('PollCreate');

// PollVote schema (processed shape)
// - targetAuthorAci: required, non-empty ACI string
// - targetTimestamp: required, positive int
// - optionIndexes: required, 1..10 ints in [0, 9]
// - voteCount: optional, int in [0, 1_000_000]
export const PollVoteSchema = z
  .object({
    targetAuthorAci: z
      .string()
      .min(1)
      .refine(isAciString, 'targetAuthorAci must be a valid ACI string'),
    targetTimestamp: z.number().int().positive(),
    optionIndexes: z.array(z.number().int().min(0).max(9)).min(1).max(10),
    voteCount: z.number().int().min(0),
  })
  .describe('PollVote');

// PollTerminate schema (processed shape)
// - targetTimestamp: required, positive int
export const PollTerminateSchema = z
  .object({
    targetTimestamp: z.number().int().positive(),
  })
  .describe('PollTerminate');

export type MessagePollVoteType = {
  fromConversationId: string;
  optionIndexes: ReadonlyArray<number>;
  voteCount: number;
  timestamp: number;
};

export type PollMessageAttribute = {
  question: string;
  options: ReadonlyArray<string>;
  allowMultiple: boolean;
  votes?: ReadonlyArray<MessagePollVoteType>;
  terminatedAt?: number;
};

export function isPollReceiveEnabled(): boolean {
  const env = getEnvironment();

  if (
    env === Environment.Development ||
    env === Environment.Test ||
    isMockEnvironment()
  ) {
    return true;
  }

  const version = window.getVersion?.();

  if (version != null) {
    if (isProduction(version)) {
      return RemoteConfig.isEnabled('desktop.pollReceive.prod');
    }
    if (isBeta(version)) {
      return RemoteConfig.isEnabled('desktop.pollReceive.beta');
    }
    if (isAlpha(version)) {
      return RemoteConfig.isEnabled('desktop.pollReceive.alpha');
    }
  }

  return false;
}
