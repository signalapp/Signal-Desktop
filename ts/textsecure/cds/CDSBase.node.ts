// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  CDSAuthType,
  CDSRequestOptionsType,
  CDSResponseType,
} from './Types.d.ts';
import type { LoggerType } from '../../types/Logging.std.ts';
import { isOlderThan } from '../../util/timestamp.std.ts';
import { HOUR } from '../../util/durations/index.std.ts';
import { createProxyAgent } from '../../util/createProxyAgent.node.ts';
import type { ProxyAgent } from '../../util/createProxyAgent.node.ts';

// It is 24 hours, but we don't want latency between server and client to be
// count.
const CACHED_AUTH_TTL = 23 * HOUR;

export type CDSBaseOptionsType = Readonly<{
  logger: LoggerType;
  proxyUrl?: string;
  getAuth(): Promise<CDSAuthType>;
}>;

export type CachedAuthType = Readonly<{
  timestamp: number;
  auth: CDSAuthType;
}>;

export abstract class CDSBase<
  Options extends CDSBaseOptionsType = CDSBaseOptionsType,
> {
  readonly #options: Options;
  protected readonly logger: LoggerType;
  protected proxyAgent?: ProxyAgent;
  protected cachedAuth?: CachedAuthType;

  constructor(options: Options) {
    this.#options = options;
    this.logger = options.logger;
  }

  public abstract request(
    options: CDSRequestOptionsType
  ): Promise<CDSResponseType>;

  protected async getAuth(): Promise<CDSAuthType> {
    // Lazily create proxy agent
    if (!this.proxyAgent && this.#options.proxyUrl) {
      this.proxyAgent = await createProxyAgent(this.#options.proxyUrl);
    }

    if (this.cachedAuth) {
      if (isOlderThan(this.cachedAuth.timestamp, CACHED_AUTH_TTL)) {
        this.cachedAuth = undefined;
      } else {
        return this.cachedAuth.auth;
      }
    }

    const auth = await this.#options.getAuth();

    this.cachedAuth = {
      auth,
      timestamp: Date.now(),
    };

    return auth;
  }
}
