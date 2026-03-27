// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type RateLimitedErrorPayloadType = Readonly<{
  retry_after?: number;
}>;

export class RateLimitedError extends Error {
  public readonly retryAfterSecs: number;

  constructor({ retry_after }: RateLimitedErrorPayloadType) {
    super(
      'RateLimitedError: got 4008 close code from CDSI, ' +
        `retry_after=${retry_after}`
    );

    this.retryAfterSecs = retry_after ?? 0;
  }
}
