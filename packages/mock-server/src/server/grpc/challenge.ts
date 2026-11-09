// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { RequestHandler } from 'micro';
import { Server } from '../base';
import { rateLimitedError } from './utils/errors';
import { authenticatedGrpcRoute } from './utils/route';

/**
 * Routes for [challenge.proto](../../../protos/server/org/signal/chat/challenge.proto).
 * Keep routes in the same order as they are declared in the proto file.
 */
export function createChallengeRoutes(
  server: Server,
): ReadonlyArray<RequestHandler> {
  const onAnswerChallenge = authenticatedGrpcRoute(
    server,
    'org.signal.chat.challenge.Challenge/AnswerChallenge',
    async () => {
      const response = server.getResponseForChallenges();
      if (response == null) {
        return { success: true };
      }
      if (response.type === 'rejected') {
        return { success: false };
      }
      throw rateLimitedError(response.retryAfterSeconds);
    },
  );

  return [onAnswerChallenge];
}
