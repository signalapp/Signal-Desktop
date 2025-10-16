// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { installEphemeralSetting } from '../util/preload.preload.js';

installEphemeralSetting('contentProtection');
installEphemeralSetting('localeOverride');
installEphemeralSetting('spellCheck');
installEphemeralSetting('systemTraySetting');
installEphemeralSetting('themeSetting');
