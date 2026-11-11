// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { google } from '../../../../protos/compiled';

// gRPC status codes used by the mock.
export const GRPC_STATUS_OK = 0;
export const GRPC_STATUS_UNKNOWN = 2;
export const GRPC_STATUS_INVALID_ARGUMENT = 3;
export const GRPC_STATUS_RESOURCE_EXHAUSTED = 8;
export const GRPC_STATUS_ABORTED = 10;
export const GRPC_STATUS_UNIMPLEMENTED = 12;
export const GRPC_STATUS_UNAUTHENTICATED = 16;

// The domain the chat server uses for `google.rpc.ErrorInfo` details
// Note: libsignal only looks at the error reason when the domain matches
export const SIGNAL_ERROR_INFO_DOMAIN = 'grpc.chat.signal.org';

export class GrpcAuthError extends Error {}

export class GrpcStatusError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly details: Uint8Array<ArrayBuffer> | null = null,
  ) {
    super(message);
  }
}

export function packAny(
  typeName: string,
  value: Uint8Array<ArrayBuffer>,
): google.protobuf.Any.Params {
  return { typeUrl: `type.googleapis.com/${typeName}`, value };
}

export function signalStatusError(
  code: number,
  reason: string,
  extraDetails: ReadonlyArray<google.protobuf.Any.Params> = [],
): GrpcStatusError {
  const errorInfo = google.rpc.ErrorInfo.encode({
    reason,
    domain: SIGNAL_ERROR_INFO_DOMAIN,
    metadata: null,
  });
  const status = google.rpc.Status.encode({
    code,
    message: reason,
    details: [...extraDetails, packAny('google.rpc.ErrorInfo', errorInfo)],
  });
  return new GrpcStatusError(code, reason, status);
}

export function rateLimitedError(retryAfterSeconds: number): GrpcStatusError {
  const retryInfo = google.rpc.RetryInfo.encode({
    retryDelay: { seconds: BigInt(retryAfterSeconds), nanos: 0 },
  });
  return signalStatusError(
    GRPC_STATUS_RESOURCE_EXHAUSTED,
    'RESOURCE_EXHAUSTED',
    [packAny('google.rpc.RetryInfo', retryInfo)],
  );
}
