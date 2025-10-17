// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MIMEType } from '../types/MIME.std.js';

export const arrayBufferToObjectURL = ({
  data,
  type,
}: {
  data: ArrayBuffer;
  type: MIMEType;
}): string => {
  if (!(data instanceof ArrayBuffer)) {
    throw new TypeError('`data` must be an ArrayBuffer');
  }

  const blob = new Blob([data], { type });

  return URL.createObjectURL(blob);
};
