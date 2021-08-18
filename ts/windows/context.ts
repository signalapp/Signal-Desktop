// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer as ipc } from 'electron';

import { Context } from '../context';

window.SignalContext = new Context(ipc);
