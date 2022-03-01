// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type * as RemoteConfig from '../RemoteConfig';
import { DEFAULT_AUDIO_LEVEL_FOR_SPEAKING } from './constants';

export function getAudioLevelForSpeaking(
  getValueFromRemoteConfig: typeof RemoteConfig.getValue
): number {
  const configValue = getValueFromRemoteConfig(
    'desktop.calling.audioLevelForSpeaking'
  );
  if (typeof configValue !== 'string') {
    return DEFAULT_AUDIO_LEVEL_FOR_SPEAKING;
  }

  const result = parseFloat(configValue);
  const isResultValid = result > 0 && result <= 1;
  return isResultValid ? result : DEFAULT_AUDIO_LEVEL_FOR_SPEAKING;
}
