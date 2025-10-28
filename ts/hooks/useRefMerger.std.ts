// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from 'react';
import { createRefMerger } from '../util/refMerger.std.js';

export const useRefMerger = (): ReturnType<typeof createRefMerger> =>
  useMemo(createRefMerger, []);
