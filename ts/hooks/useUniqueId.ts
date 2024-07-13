// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';

export function useUniqueId(): string {
  return useMemo(() => uuid(), []);
}

let nextElementId = 0;

export function useElementId(
  namePrefix: string
): [id: string, selector: string] {
  // Prefixed to avoid starting with a number (which is invalid in CSS selectors)
  const [id] = useState(() => {
    const currentId = nextElementId;
    nextElementId += 1;
    return `${namePrefix}-${currentId}`;
  });
  // Return the ID and a selector that can be used in CSS or JS
  return [id, `#${id}`] as const;
}
