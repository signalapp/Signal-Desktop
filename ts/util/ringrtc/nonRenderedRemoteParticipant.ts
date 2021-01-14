// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { GroupCallVideoRequest } from '../../types/Calling';

export const nonRenderedRemoteParticipant = ({
  demuxId,
}: Readonly<{ demuxId: number }>): GroupCallVideoRequest => ({
  demuxId,
  width: 0,
  height: 0,
});
