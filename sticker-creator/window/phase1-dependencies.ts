// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Backbone from 'backbone';

import { ipcRenderer as ipc } from 'electron';

// It is important to call this as early as possible
import { SignalContext } from '../../ts/windows/context';

import { getEnvironment } from '../../ts/environment';

SignalContext.log.info('sticker-creator starting up...');

window.ROOT_PATH = window.location.href.startsWith('file') ? '../../' : '/';
window.getEnvironment = getEnvironment;
window.getVersion = () => window.SignalContext.config.version;

window.Backbone = Backbone;

window.localeMessages = ipc.sendSync('locale-data');
