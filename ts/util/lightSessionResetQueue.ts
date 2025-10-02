// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';

export const lightSessionResetQueue = new PQueue({ concurrency: 1 });

lightSessionResetQueue.pause();
