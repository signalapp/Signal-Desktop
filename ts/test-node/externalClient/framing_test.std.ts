// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { FrameError } from '../../externalClient/errors.std.ts';
import {
  FrameDecoder,
  FrameKind,
  encodeFrame,
  encodeJsonFrame,
} from '../../externalClient/framing.std.ts';

function makeDecoder(maxPayloadBytes = 1024): FrameDecoder {
  return new FrameDecoder({ maxPayloadBytes, allowedKinds: [FrameKind.Json] });
}

describe('externalClient/framing', () => {
  it('round-trips a JSON frame', () => {
    const [frame, ...rest] = makeDecoder().push(
      encodeJsonFrame({ hello: 'world' })
    );
    assert.isDefined(frame);
    assert.isEmpty(rest);
    assert.strictEqual(frame?.kind, FrameKind.Json);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(frame?.payload)), {
      hello: 'world',
    });
  });

  it('reassembles frames split at every byte', () => {
    const decoder = makeDecoder();
    const bytes = new Uint8Array([
      ...encodeJsonFrame({ a: 1 }),
      ...encodeJsonFrame({ b: 2 }),
    ]);
    const payloads = new Array<string>();
    for (const byte of bytes) {
      for (const frame of decoder.push(new Uint8Array([byte]))) {
        payloads.push(new TextDecoder().decode(frame.payload));
      }
    }
    assert.deepEqual(payloads, ['{"a":1}', '{"b":2}']);
    assert.strictEqual(decoder.bufferedBytes, 0);
  });

  it('accepts an empty payload', () => {
    const [frame, ...rest] = makeDecoder().push(
      encodeFrame(FrameKind.Json, new Uint8Array(0))
    );
    assert.isEmpty(rest);
    assert.strictEqual(frame?.payload.byteLength, 0);
  });

  it('rejects an oversized frame from the header alone', () => {
    const header = new Uint8Array(5);
    const view = new DataView(header.buffer);
    view.setUint8(0, FrameKind.Json);
    view.setUint32(1, 1025, false);
    assert.throws(() => makeDecoder(1024).push(header), FrameError);
  });

  it('rejects a frame of maximum uint32 length', () => {
    const header = new Uint8Array([FrameKind.Json, 0xff, 0xff, 0xff, 0xff]);
    assert.throws(() => makeDecoder().push(header), FrameError);
  });

  it('rejects binary frames when not allowed', () => {
    assert.throws(
      () =>
        makeDecoder().push(encodeFrame(FrameKind.Binary, new Uint8Array(1))),
      FrameError
    );
  });

  it('rejects unknown frame kinds', () => {
    assert.throws(
      () => makeDecoder().push(new Uint8Array([0x7f, 0, 0, 0, 0])),
      FrameError
    );
  });

  it('waits for a truncated header', () => {
    const decoder = makeDecoder();
    assert.deepEqual(decoder.push(new Uint8Array([FrameKind.Json, 0, 0])), []);
    assert.strictEqual(decoder.bufferedBytes, 3);
  });
});
