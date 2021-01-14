// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { LocalizerType } from '../../ts/types/Util';

export const setup: (
  language: string,
  messages: Record<string, unknown>
) => LocalizerType;
