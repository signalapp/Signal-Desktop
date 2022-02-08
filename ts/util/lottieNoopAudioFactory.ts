// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop } from 'lodash';
import type { AnimationConfig } from '@evanhahn/lottie-web-light';

type LottieAudioFactory = NonNullable<AnimationConfig['audioFactory']>;
type LottieAudio = ReturnType<LottieAudioFactory>;

const lottieNoopAudio: LottieAudio = {
  play: noop,
  seek: noop,
  playing: noop,
  rate: noop,
  setVolume: noop,
};

export const lottieNoopAudioFactory: LottieAudioFactory = () => lottieNoopAudio;
