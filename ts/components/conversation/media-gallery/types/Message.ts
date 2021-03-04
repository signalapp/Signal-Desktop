// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Attachment } from '../../../../types/Attachment';

export type Message = {
  id: string;
  attachments: Array<Attachment>;
  // Assuming this is for the API
  // eslint-disable-next-line camelcase
  received_at: number;
  // eslint-disable-next-line camelcase
  received_at_ms: number;
};
