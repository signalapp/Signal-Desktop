// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fromString, toBase64 } from '../Bytes.std.js';

export type GetBasicAuthOptionsType = Readonly<{
  username: string;
  password: string;
}>;

export function getBasicAuth({
  username,
  password,
}: GetBasicAuthOptionsType): string {
  const auth = toBase64(fromString(`${username}:${password}`));

  return `Basic ${auth}`;
}
