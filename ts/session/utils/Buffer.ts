/**
 * Convert base64 string into a Uint8Array.
 *
 * The reason for this function is to avoid a very weird issue when converting to and from base64.
 * ```
 * const base64 = <base64string>;
 * const arrayBuffer = Buffer.from(base64, 'base64').buffer;
 * const reconstructedBase64 = Buffer.from(arrayBuffer).toString('base64');
 * expect(base64 === reconstructedBase64) // This returns false!!
 * ```
 *
 * I have no idea why that doesn't work but a work around is to wrap the original base64 buffer in a Uin8Array before calling `buffer` on it.
 *
 * @param base64 The base 64 string.
 */
export function base64toUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}
