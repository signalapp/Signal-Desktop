// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type RateLimitedErrorPayloadType = Readonly<{
  retry_after?: number;
}>;

export class RateLimitedError extends Error {
  public readonly retryAfterSecs: number;

  // eslint-disable-next-line camelcase
  constructor({ retry_after }: RateLimitedErrorPayloadType) {
    super(
      'RateLimitedError: got 4008 close code from CDSI, ' +
        // eslint-disable-next-line camelcase
        `retry_after=${retry_after}`
    );

    // eslint-disable-next-line camelcase
    this.retryAfterSecs = retry_after ?? 0;
  }
}
