import ByteBuffer from 'bytebuffer';

/**
 * Converts any object to a valid ts protobuf object.
 *
 * This is needed because there's a very jarring difference between `protobufjs` and `protobufts`.
 * `protobufjs` returns all `bytes` as `ByteBuffer` where as `protobufts` returns all `bytes` as `Uint8Array`.
 */
export function convertToTS(object: any): any {
  // No idea why js `ByteBuffer` and ts `ByteBuffer` differ ...
  if (object && object.constructor && object.constructor.name === 'ByteBuffer') {
    return new Uint8Array(object.toArrayBuffer());
  } else if (object instanceof ByteBuffer || object instanceof Buffer || object instanceof ArrayBuffer || object instanceof SharedArrayBuffer) {
    const arrayBuffer = ByteBuffer.wrap(object).toArrayBuffer();
    return new Uint8Array(arrayBuffer);
  } else if (Array.isArray(object)) {
    return object.map(convertToTS);
  } else if (object && typeof object === 'object') {
    const keys = Object.keys(object);
    const values: { [key: string]: any } = {};
    for (const key of keys) {
      values[key] = convertToTS(object[key]);
    }
    return values;
  }

  return object;
}
