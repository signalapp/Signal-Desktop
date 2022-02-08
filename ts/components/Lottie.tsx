// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, ReactElement } from 'react';
import React, { useEffect, useRef } from 'react';
import lottie from '@evanhahn/lottie-web-light';

import { lottieNoopAudioFactory } from '../util/lottieNoopAudioFactory';

export function Lottie({
  animationData,
  className,
  style,
}: Readonly<{
  animationData: unknown;
  className?: string;
  style?: CSSProperties;
}>): ReactElement {
  const containerRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const animationItem = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData,
      audioFactory: lottieNoopAudioFactory,
    });

    return () => {
      animationItem.destroy();
    };
  }, [animationData]);

  return <div className={className} ref={containerRef} style={style} />;
}
