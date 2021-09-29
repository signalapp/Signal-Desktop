// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, ReactElement } from 'react';
import { animated, useTransition, UseTransitionProps } from '@react-spring/web';
import cubicBezier from 'bezier-easing';

export function useAnimated<Props extends Record<string, unknown>>(
  props: UseTransitionProps,
  onClose: () => unknown
): {
  close: () => unknown;
  renderAnimation: (children: ReactElement) => JSX.Element;
} {
  const [isOpen, setIsOpen] = useState(true);

  const transitions = useTransition<boolean, Props>(isOpen, {
    ...props,
    leave: {
      ...props.leave,
      onRest: () => onClose(),
    },
    config: {
      duration: 200,
      easing: cubicBezier(0.17, 0.17, 0, 1),
      ...props.config,
    },
  });

  return {
    close: () => setIsOpen(false),
    renderAnimation: children =>
      transitions((style, item) =>
        item ? <animated.div style={style}>{children}</animated.div> : null
      ),
  };
}
