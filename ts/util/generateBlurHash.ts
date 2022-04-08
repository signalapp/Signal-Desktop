// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { encode83 } from 'blurhash/dist/base83';

/* eslint-disable no-bitwise */
export function generateBlurHash(argb = 4294704123): string {
  const R = 0xff & (argb >> 16);
  const G = 0xff & (argb >> 8);
  const B = 0xff & (argb >> 0);

  const value = (R << 16) + (G << 8) + B;

  return `00${encode83(value, 4)}`;
}
/* eslint-enable no-bitwise */
