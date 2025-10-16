// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { GroupCallVideoRequest } from '../../types/Calling.std.js';

export const nonRenderedRemoteParticipant = ({
  demuxId,
}: Readonly<{ demuxId: number }>): GroupCallVideoRequest => ({
  demuxId,
  width: 0,
  height: 0,
});
