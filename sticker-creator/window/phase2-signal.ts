// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Signal from '../../ts/signal';
import { textsecure } from '../../ts/textsecure';

import * as Attachments from '../../ts/windows/attachments';
import '../../ts/SignalProtocolStore';

import { SignalContext } from '../../ts/windows/context';

window.Signal = Signal.setup({
  Attachments,
  getRegionCode: () => {
    throw new Error('Sticker Creator preload: Not implemented!');
  },
  logger: SignalContext.log,
  userDataPath: SignalContext.config.userDataPath,
});
window.textsecure = textsecure;
