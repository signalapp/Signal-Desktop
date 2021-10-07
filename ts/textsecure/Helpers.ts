// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-proto */
/* eslint-disable @typescript-eslint/no-explicit-any */

const arrayBuffer = new ArrayBuffer(0);
const uint8Array = new Uint8Array();

const StaticArrayBufferProto = (arrayBuffer as any).__proto__;
const StaticUint8ArrayProto = (uint8Array as any).__proto__;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function getString(thing: any): string {
  if (thing === Object(thing)) {
    if (thing.__proto__ === StaticUint8ArrayProto) {
      return String.fromCharCode.apply(null, thing);
    }
    if (thing.__proto__ === StaticArrayBufferProto) {
      return getString(new Uint8Array(thing));
    }
  }
  return thing;
}

function getStringable(thing: any): boolean {
  return (
    typeof thing === 'string' ||
    typeof thing === 'number' ||
    typeof thing === 'boolean' ||
    (thing === Object(thing) &&
      (thing.__proto__ === StaticArrayBufferProto ||
        thing.__proto__ === StaticUint8ArrayProto))
  );
}

function ensureStringed(thing: any): any {
  if (getStringable(thing)) {
    return getString(thing);
  }
  if (thing instanceof Array) {
    const res = [];
    for (let i = 0; i < thing.length; i += 1) {
      res[i] = ensureStringed(thing[i]);
    }

    return res;
  }
  if (thing === Object(thing)) {
    const res: any = {};
    for (const key in thing) {
      res[key] = ensureStringed(thing[key]);
    }

    return res;
  }
  if (thing === null) {
    return null;
  }
  throw new Error(`unsure of how to jsonify object of type ${typeof thing}`);
}

// Number formatting utils
const utils = {
  getString,
  isNumberSane: (number: string): boolean =>
    number[0] === '+' && /^[0-9]+$/.test(number.substring(1)),
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  jsonThing: (thing: unknown) => JSON.stringify(ensureStringed(thing)),
  unencodeNumber: (number: string): Array<string> => number.split('.'),
};

export default utils;
