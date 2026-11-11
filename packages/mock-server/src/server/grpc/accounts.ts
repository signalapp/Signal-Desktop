// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Buffer } from 'buffer';
import { stringify as stringifyUuid } from 'uuid';
import { RequestHandler } from 'micro';
import * as Protos from '../../../protos/compiled';
import {
  capabilityToGrpc,
  SELF_VISIBLE_CAPABILITIES,
} from '../../data/capabilities';
import { Server } from '../base';
import { toServiceIdentifier, fromServiceIdentifier } from './utils/serviceId';
import { grpcRoute, authenticatedGrpcRoute } from './utils/route';

import GrpcDeviceCapability = Protos.org.signal.chat.common.DeviceCapability;

/**
 * Routes for [account.proto](../../../protos/server/org/signal/chat/account.proto).
 * Keep routes in the same order as they are declared in the proto file.
 */
export function createAccountsRoutes(
  server: Server,
): ReadonlyArray<RequestHandler> {
  const onDeleteAccount = authenticatedGrpcRoute(
    server,
    'org.signal.chat.account.Accounts/DeleteAccount',
    async () => {
      // TODO: Delete the account
      return {};
    },
  );

  const onSetRegistrationLock = authenticatedGrpcRoute(
    server,
    'org.signal.chat.account.Accounts/SetRegistrationLock',
    async ({ registrationLock }, device) => {
      server.setRegistrationLockToken(
        device.aci,
        Buffer.from(registrationLock).toString('hex'),
      );
      return {};
    },
  );

  const onClearRegistrationLock = authenticatedGrpcRoute(
    server,
    'org.signal.chat.account.Accounts/ClearRegistrationLock',
    async (_body, device) => {
      server.setRegistrationLockToken(device.aci, undefined);
      return {};
    },
  );

  const onReserveUsername = authenticatedGrpcRoute(
    server,
    'org.signal.chat.account.Accounts/ReserveUsernameHash',
    async ({ usernameHashes }, device) => {
      const usernameHash = await server.reserveUsername(device.aci, {
        usernameHashes,
      });

      if (!usernameHash) {
        return {
          response: {
            usernameNotAvailable: {},
          },
        };
      }

      return {
        response: {
          usernameHash,
        },
      };
    },
  );

  const onConfirmUsername = authenticatedGrpcRoute(
    server,
    'org.signal.chat.account.Accounts/ConfirmUsernameHash',
    async (body, device) => {
      const result = await server.confirmUsername(device.aci, body);
      if (!result) {
        return {
          response: {
            reservationNotFound: {
              description:
                "Given username hash doesn't match the reserved one or no reservation found.",
            },
          },
        };
      }

      return {
        response: {
          confirmedUsernameHash: result,
        },
      };
    },
  );

  const onDeleteUsername = authenticatedGrpcRoute(
    server,
    'org.signal.chat.account.Accounts/DeleteUsernameHash',
    async (_body, device) => {
      await server.deleteUsername(device.aci);

      return {};
    },
  );

  const onSetUsernameLink = authenticatedGrpcRoute(
    server,
    'org.signal.chat.account.Accounts/SetUsernameLink',
    async ({ usernameCiphertext, keepLinkHandle }, device) => {
      const usernameLinkHandle = await server.replaceUsernameLink(
        device.aci,
        usernameCiphertext,
        { keepLinkHandle },
      );

      return {
        response: {
          usernameLinkHandle,
        },
      };
    },
  );

  const onSetDiscoverableByPhoneNumber = authenticatedGrpcRoute(
    server,
    'org.signal.chat.account.Accounts/SetDiscoverableByPhoneNumber',
    async () => {
      // TODO: Store phone number discoverability
      return {};
    },
  );

  const onGetCapabilities = authenticatedGrpcRoute(
    server,
    'org.signal.chat.account.Accounts/GetCapabilities',
    async (_request, device) => {
      const capabilities: Array<GrpcDeviceCapability> = [];
      for (const capability of SELF_VISIBLE_CAPABILITIES) {
        if (server.hasAccountCapability(device.aci, capability)) {
          capabilities.push(capabilityToGrpc(capability));
        }
      }

      return { capabilities: { capabilities } };
    },
  );

  const onCheckAccountExistence = grpcRoute(
    server,
    'org.signal.chat.account.AccountsAnonymous/CheckAccountExistence',
    async ({ serviceIdentifier }) => {
      const serviceId = fromServiceIdentifier(serviceIdentifier);
      const device = await server.getDeviceByServiceId(serviceId);
      return {
        accountExists: device != null && !server.isUnregistered(serviceId),
      };
    },
  );

  const onLookupUsernameHash = grpcRoute(
    server,
    'org.signal.chat.account.AccountsAnonymous/LookupUsernameHash',
    async ({ usernameHash }) => {
      const uuid = await server.lookupByUsernameHash(Buffer.from(usernameHash));

      if (!uuid) {
        return {
          response: {
            notFound: {},
          },
        };
      }

      return {
        response: {
          serviceIdentifier: toServiceIdentifier(uuid),
        },
      };
    },
  );

  const onLookupUsernameLink = grpcRoute(
    server,
    'org.signal.chat.account.AccountsAnonymous/LookupUsernameLink',
    async ({ usernameLinkHandle }) => {
      const usernameCiphertext = await server.lookupByUsernameLink(
        stringifyUuid(usernameLinkHandle),
      );

      if (!usernameCiphertext) {
        return {
          response: {
            notFound: {},
          },
        };
      }

      return {
        response: {
          usernameCiphertext,
        },
      };
    },
  );

  return [
    onDeleteAccount,
    onSetRegistrationLock,
    onClearRegistrationLock,
    onReserveUsername,
    onConfirmUsername,
    onDeleteUsername,
    onSetUsernameLink,
    onSetDiscoverableByPhoneNumber,
    onGetCapabilities,
    onCheckAccountExistence,
    onLookupUsernameHash,
    onLookupUsernameLink,
  ];
}
