// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import { Buffer } from 'buffer';
import createDebug from 'debug';
import { buffer, type RequestHandler } from 'micro';
import { post, type ServerRequest } from 'microrouter';
import type { ServerResponse } from 'http';
import type { Device } from '../../../data/device';
import { $services } from '../../../../protos/compiled';
import { Server } from '../../base';
import { parsePassword } from '../../common';
import {
  GRPC_STATUS_OK,
  GRPC_STATUS_UNKNOWN,
  GRPC_STATUS_UNAUTHENTICATED,
  GrpcAuthError,
  GrpcStatusError,
} from './errors';

const debug = createDebug('mock:grpc');

export async function auth(
  server: Server,
  req: ServerRequest,
): Promise<Device | undefined> {
  const { username, password, error } = parsePassword(req);
  if (error) {
    debug('%s %s auth failed, error %j', req.method, req.url, error);
    return;
  }

  const device = await server.auth(username ?? '', password ?? '');
  if (!device) {
    debug('%s %s auth failed, need re-provisioning', req.method, req.url);
    return;
  }

  return device;
}

// A gRPC response over HTTP/2 always uses HTTP status 200; the actual gRPC
// status code is carried in the trailing HEADERS frame (`grpc-status`). `micro`
// has no notion of trailers, so we emit them via the HTTP/2 compat API. (Driving
// the raw stream directly conflicts with the Http2ServerResponse that `micro`
// holds and throws ERR_HTTP2_TRAILERS_ALREADY_SENT.)
export function sendGrpcResponse(
  res: ServerResponse,
  body: Buffer,
  status: number,
  message?: string,
  details?: Uint8Array<ArrayBuffer> | null,
): void {
  const trailers: Record<string, string> = {
    'grpc-status': String(status),
  };
  if (message !== undefined) {
    // Per the gRPC spec, `grpc-message` is percent-encoded.
    trailers['grpc-message'] = encodeURIComponent(message);
  }
  if (details != null) {
    trailers['grpc-status-details-bin'] =
      Buffer.from(details).toString('base64');
  }

  res.writeHead(200, { 'content-type': 'application/grpc' });
  res.addTrailers(trailers);
  res.end(body);
}

export type GrpcRequest<Endpoint extends keyof typeof $services> = ReturnType<
  (typeof $services)[Endpoint]['Request']['decode']
>;

export type GrpcResponse<Endpoint extends keyof typeof $services> = Parameters<
  (typeof $services)[Endpoint]['Response']['encode']
>[0];

export function grpcRoute<Endpoint extends keyof typeof $services>(
  server: Server,
  endpoint: Endpoint,
  handler: (
    request: GrpcRequest<Endpoint>,
    device: Device | undefined,
  ) => Promise<GrpcResponse<Endpoint>>,
): RequestHandler {
  const definition = $services[endpoint];
  // TODO(indutny): enforce on type level, and support true response streams
  if (definition.isRequestStream) {
    throw new Error(`Request stream is not supported`);
  }
  return post(`/${endpoint}`, async (httpReq, res) => {
    try {
      const raw = await buffer(httpReq);
      assert(Buffer.isBuffer(raw));
      assert(raw.buffer instanceof ArrayBuffer);

      if (raw.length < 5) {
        throw new Error('gRPC request is too short');
      }

      if (raw[0] !== 0) {
        throw new Error('Unsupported request compression');
      }

      const len = raw.readUint32BE(1);
      if (raw.length !== 5 + len) {
        throw new Error('Invalid gRPC request size');
      }

      const grpcRequest = definition.Request.decode(
        raw.subarray(5, 5 + len) as Uint8Array<ArrayBuffer>,
      );

      const device = await auth(server, httpReq);

      const response = await handler(
        grpcRequest as Parameters<typeof handler>[0],
        device,
      );

      const data = (
        definition.Response.encode as (
          params: unknown,
        ) => Uint8Array<ArrayBuffer>
      )(response);
      const header = Buffer.alloc(5);
      header.writeUint32BE(data.length, 1);
      sendGrpcResponse(res, Buffer.concat([header, data]), GRPC_STATUS_OK);
    } catch (error) {
      debug('gRPC handler error for %s', endpoint, error);
      let status: number;
      let details: Uint8Array<ArrayBuffer> | null;
      if (error instanceof GrpcStatusError) {
        status = error.code;
        details = error.details;
      } else if (error instanceof GrpcAuthError) {
        status = GRPC_STATUS_UNAUTHENTICATED;
        details = null;
      } else {
        status = GRPC_STATUS_UNKNOWN;
        details = null;
      }
      sendGrpcResponse(
        res,
        Buffer.alloc(0),
        status,
        error instanceof Error ? error.message : String(error),
        details,
      );
    }
  });
}

export function authenticatedGrpcRoute<Endpoint extends keyof typeof $services>(
  server: Server,
  endpoint: Endpoint,
  handler: (
    grpcRequest: GrpcRequest<Endpoint>,
    device: Device,
  ) => Promise<GrpcResponse<Endpoint>>,
): RequestHandler {
  return grpcRoute(server, endpoint, async (grpcRequest, device) => {
    if (!device) {
      throw new GrpcAuthError('incorrect credentials');
    }

    return handler(grpcRequest, device);
  });
}
