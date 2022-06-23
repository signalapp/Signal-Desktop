// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This has to be the first import because of monkey-patching
import '../ts/windows/shims';

import './window/phase1-dependencies';
import './window/phase2-signal';
import './window/phase3-sticker-functions';
import './window/phase4-theme';

import { SignalContext } from '../ts/windows/context';

SignalContext.log.info('sticker-creator preload complete...');
