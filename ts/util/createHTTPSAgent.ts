// Copyright 2013 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Agent } from 'https';
import type { AgentOptions } from 'https';

import { SECOND } from './durations';
import { electronLookup } from './dns';

// Due to the Node.js bug, we must manually re-apply `servername` when creating
// an outgoing TLS connection with "Happy Eyeballs" (`autoSelectFamily: true`).
//
// See: https://github.com/nodejs/node/pull/48255
export function createHTTPSAgent(options: AgentOptions = {}): Agent {
  type TLSSocketInternals = {
    _init: (...args: Array<unknown>) => unknown;
    setServername: (servername: string) => void;
  };

  const agent = new Agent({
    ...options,
    lookup: electronLookup,
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 2 * SECOND,
  });

  const typedAgent = agent as unknown as {
    createConnection: (
      connectionOptions: { servername?: string },
      callback: () => unknown
    ) => TLSSocketInternals;
  };

  const oldCreateConnection = typedAgent.createConnection;
  typedAgent.createConnection = function createConnection(
    connectionOptions,
    callback
  ) {
    const socket = oldCreateConnection.call(this, connectionOptions, callback);
    const oldInit = socket._init;
    socket._init = function _init(...args) {
      const result = oldInit.apply(this, args);
      if (connectionOptions.servername) {
        socket.setServername(connectionOptions.servername);
      }
      return result;
    };
    return socket;
  };
  return agent;
}
