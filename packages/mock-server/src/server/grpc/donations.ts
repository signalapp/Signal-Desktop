// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { RequestHandler } from 'micro';
import { Server } from '../base';
import { authenticatedGrpcRoute } from './utils/route';

/**
 * Routes for [donations.proto](../../../protos/server/org/signal/chat/donations.proto).
 * Keep routes in the same order as they are declared in the proto file.
 */
export function createDonationsRoutes(
  server: Server,
): ReadonlyArray<RequestHandler> {
  const onRedeemReceipt = authenticatedGrpcRoute(
    server,
    'org.signal.chat.donations.Donations/RedeemReceipt',
    async () => {
      // TODO: Verify the receipt and add its badge to the account
      return { response: { success: {} } };
    },
  );

  const onCreateDonationPermits = authenticatedGrpcRoute(
    server,
    'org.signal.chat.donations.Donations/CreateDonationPermits',
    async ({ donationPermitsRequest }) => {
      // TODO: Rate limit by the number of permits requested
      return {
        donationPermitsResponse: await server.issueDonationPermits(
          donationPermitsRequest,
        ),
      };
    },
  );

  return [onRedeemReceipt, onCreateDonationPermits];
}
