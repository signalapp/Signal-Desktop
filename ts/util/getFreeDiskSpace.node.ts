// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { statfs } from 'node:fs/promises';

export async function getFreeDiskSpace(target: string): Promise<number> {
  const { bsize, bavail } = await statfs(target);
  return bsize * bavail;
}
