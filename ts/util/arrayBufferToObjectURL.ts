// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import is from '@sindresorhus/is';

import type { MIMEType } from '../types/MIME';

export const arrayBufferToObjectURL = ({
  data,
  type,
}: {
  data: ArrayBuffer;
  type: MIMEType;
}): string => {
  if (!is.arrayBuffer(data)) {
    throw new TypeError('`data` must be an ArrayBuffer');
  }

  const blob = new Blob([data], { type });

  return URL.createObjectURL(blob);
};
