// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import { Buffer } from 'buffer';
import { RequestHandler } from 'micro';
import { ProfileKeyCredentialRequest } from '@signalapp/libsignal-client/zkgroup';
import * as Protos from '../../../protos/compiled';
import { isValidAccessKey } from '../../util';
import { Server } from '../base';
import { GRPC_STATUS_INVALID_ARGUMENT, GrpcStatusError } from './utils/errors';
import { grpcRoute } from './utils/route';
import { fromServiceIdentifier } from './utils/serviceId';

import CredentialType = Protos.org.signal.chat.profile.CredentialType;

/**
 * Routes for [profile.proto](../../../protos/server/org/signal/chat/profile.proto).
 * Keep routes in the same order as they are declared in the proto file.
 */
export function createProfilesRoutes(
  server: Server,
): ReadonlyArray<RequestHandler> {
  const onGetProfileKeyCredential = grpcRoute(
    server,
    'org.signal.chat.profile.ProfileAnonymous/GetProfileKeyCredential',
    async (request) => {
      if (
        request.credentialType !==
        CredentialType.CREDENTIAL_TYPE_EXPIRING_PROFILE_KEY
      ) {
        throw new GrpcStatusError(
          GRPC_STATUS_INVALID_ARGUMENT,
          'invalid credential type',
        );
      }

      const serviceId = fromServiceIdentifier(request.accountIdentifier);
      const target = await server.getDeviceByServiceId(serviceId);
      if (target == null || server.isUnregistered(serviceId)) {
        return { response: { notFound: {} } };
      }

      if (!isValidAccessKey(request.unidentifiedAccessKey, target)) {
        return {
          response: {
            failedUnidentifiedAuthorization: {
              description: 'Invalid access key',
            },
          },
        };
      }

      const version = server.getCurrentProfileVersion(target.aci);
      const profile =
        version === undefined
          ? undefined
          : server.getProfile(target.aci, version);
      if (profile == null) {
        return { response: { notFound: {} } };
      }

      let credentialRequest: ProfileKeyCredentialRequest;
      try {
        credentialRequest = new ProfileKeyCredentialRequest(
          Buffer.from(request.credentialRequest),
        );
      } catch {
        throw new GrpcStatusError(
          GRPC_STATUS_INVALID_ARGUMENT,
          'invalid credential request',
        );
      }

      let credential: Buffer<ArrayBuffer> | undefined;
      try {
        credential = await server.issueExpiringProfileKeyCredential({
          aci: target.aci,
          profileKeyCommitment: profile.commitment,
          request: credentialRequest,
        });
      } catch {
        throw new GrpcStatusError(
          GRPC_STATUS_INVALID_ARGUMENT,
          'invalid credential request',
        );
      }

      assert.ok(credential, 'Missing credential for a stored commitment');

      return {
        response: {
          result: { profileKeyCredential: credential },
        },
      };
    },
  );

  return [onGetProfileKeyCredential];
}
