// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Net } from '@signalapp/libsignal-client';

import { getUserAgent } from '../util/getUserAgent.node.js';
import { isStagingServer } from '../util/isStagingServer.dom.js';
import { getMockServerPort } from '../util/getMockServerPort.dom.js';
import { isMockServer } from '../util/isMockServer.dom.js';
import { pemToDer } from '../util/pemToDer.std.js';
import { drop } from '../util/drop.std.js';
import { toLogFormat } from '../types/errors.std.js';
import { createLogger } from '../logging/log.std.js';

const log = createLogger('preconnect');

// Libsignal has internally configured values for domain names
// (and other connectivity params) of the services.
function resolveLibsignalNet(
  url: string,
  version: string,
  certificateAuthority?: string
): Net.Net {
  const userAgent = getUserAgent(version);
  log.info(`libsignal net url: ${url}`);
  if (isStagingServer(url)) {
    log.info('libsignal net environment resolved to staging');
    return new Net.Net({
      env: Net.Environment.Staging,
      userAgent,
    });
  }

  if (isMockServer(url) && certificateAuthority !== undefined) {
    const DISCARD_PORT = 9; // Reserved by RFC 863.
    log.info('libsignal net environment resolved to mock');
    return new Net.Net({
      localTestServer: true,
      userAgent,
      TESTING_localServer_chatPort: parseInt(getMockServerPort(url), 10),
      TESTING_localServer_cdsiPort: DISCARD_PORT,
      TESTING_localServer_svr2Port: DISCARD_PORT,
      TESTING_localServer_svrBPort: DISCARD_PORT,
      TESTING_localServer_rootCertificateDer: pemToDer(certificateAuthority),
    });
  }

  log.info('libsignal net environment resolved to prod');
  return new Net.Net({
    env: Net.Environment.Production,
    userAgent,
  });
}

// `libsignalNet` is an instance of a class from libsignal that is responsible
// for providing network layer API and related functionality.
// It's important to have a single instance of this class as it holds
// resources that are shared across all other use cases.
let libsignalNet: Net.Net;

export function getLibsignalNet(): Net.Net {
  return libsignalNet;
}

// Not defined in tests
if (window.SignalContext.config?.serverUrl) {
  const { config } = window.SignalContext;

  libsignalNet = resolveLibsignalNet(
    config.serverUrl,
    config.version,
    config.certificateAuthority
  );

  libsignalNet.setIpv6Enabled(!config.disableIPv6);
  if (config.proxyUrl) {
    log.info('WebAPI: Setting libsignal proxy');
    try {
      libsignalNet.setProxyFromUrl(config.proxyUrl);
    } catch (error) {
      log.error(`WebAPI: Failed to set proxy: ${error}`);
      libsignalNet.clearProxy();
    }
  }

  drop(
    (async () => {
      try {
        log.info('WebAPI: preconnect start');
        await libsignalNet.preconnectChat();
        log.info('WebAPI: preconnect done');
      } catch (error) {
        log.error(`WebAPI: Failed to preconnect: ${toLogFormat(error)}`);
      }
    })()
  );
}
