// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from 'react';
import { v4 as uuid } from 'uuid';

export function useUniqueId(): string {
  return useMemo(() => uuid(), []);
}
