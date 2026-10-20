// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import type { ServerRequest, ServerResponse } from 'microrouter';
import { send } from 'micro';
import { ParseAuthHeaderResult, parseAuthHeader } from '../util';
import type { Server } from './base';
import type { Device } from '../data/device';
import { Base64, Base64Url, GroupInviteLinkPassword } from '@signalapp/types';

const debug = createDebug('mock:server:base');

export function parsePassword(req: ServerRequest): ParseAuthHeaderResult {
  return parseAuthHeader(req.headers.authorization);
}

export async function auth(
  server: Server,
  req: ServerRequest,
  res: ServerResponse,
): Promise<Device | undefined> {
  const { username, password, error } = parsePassword(req);
  if (error) {
    debug('%s %s auth failed, error %j', req.method, req.url, error);
    void send(res, 401, { error });
    return;
  }

  const device = await server.auth(username ?? '', password ?? '');
  if (!device) {
    debug('%s %s auth failed, need re-provisioning', req.method, req.url);
    void send(res, 401, { error: 'Need re-provisioning' });
    return;
  }

  return device;
}

export function parseGroupInviteLinkPassword(
  input: string,
): GroupInviteLinkPassword.Encoded | null {
  if (!Base64Url.isValid(input)) {
    return null;
  }
  const base64 = Base64.fromBytes(Base64Url.toBytes(input));
  if (!GroupInviteLinkPassword.isValid(base64)) {
    return null;
  }
  return GroupInviteLinkPassword.encode(base64);
}
