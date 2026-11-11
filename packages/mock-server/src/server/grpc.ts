// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import { Buffer } from 'buffer';
import createDebug from 'debug';
import { RequestHandler, send as sendRaw } from 'micro';
import {
  AugmentedRequestHandler as RouteHandler,
  del,
  get,
  head,
  options,
  patch,
  post,
  put,
  router,
} from 'microrouter';
import { $services } from '../../protos/compiled';
import { Server } from './base';
import { createAccountsRoutes } from './grpc/accounts';
import { createAttachmentsRoutes } from './grpc/attachments';
import { createBackupsRoutes } from './grpc/backups';
import { createChallengeRoutes } from './grpc/challenge';
import { createDevicesRoutes } from './grpc/devices';
import { createDonationsRoutes } from './grpc/donations';
import { createKeysRoutes } from './grpc/keys';
import { createMessagesRoutes } from './grpc/messages';
import { createProfilesRoutes } from './grpc/profiles';
import { GRPC_STATUS_UNIMPLEMENTED } from './grpc/utils/errors';
import { sendGrpcResponse } from './grpc/utils/route';

const debug = createDebug('mock:grpc');

const ALL_METHODS = [get, post, put, patch, del, head, options] as const;

export const createHandler = (server: Server): RequestHandler => {
  const unimplemented: RouteHandler = async (req, res) => {
    const endpoint = req.params._ ?? '';
    const message = Object.hasOwn($services, endpoint)
      ? `Mock server does not implement ${endpoint}`
      : `Method not found: ${endpoint}`;

    debug('Unsupported request %s %s', req.method, req.url);
    sendGrpcResponse(res, Buffer.alloc(0), GRPC_STATUS_UNIMPLEMENTED, message);
  };

  const routes = router(
    ...createAccountsRoutes(server),
    ...createAttachmentsRoutes(server),
    ...createBackupsRoutes(server),
    ...createChallengeRoutes(server),
    ...createDevicesRoutes(server),
    ...createDonationsRoutes(server),
    ...createKeysRoutes(server),
    ...createMessagesRoutes(server),
    ...createProfilesRoutes(server),

    // Any other method responds with UNIMPLEMENTED
    ...ALL_METHODS.map((method) => method('/*', unimplemented)),
  );

  return (req, res) => {
    debug('got request %s %s', req.method, req.url);
    try {
      res.once('finish', () => {
        debug('response %s %s', req.method, req.url, res.statusCode);
      });
      return routes(req, res);
    } catch (error) {
      assert(error instanceof Error);
      debug('request failure %s %s', req.method, req.url, error.stack);
      return sendRaw(res, 500, error.message);
    }
  };
};
