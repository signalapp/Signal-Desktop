// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { animated, useSpring } from '@react-spring/web';
import classNames from 'classnames';
import React, { useCallback } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { ProgressCircle } from './ProgressCircle';
import { SpinnerV2 } from './SpinnerV2';

const SPRING_CONFIG = {
  mass: 0.5,
  tension: 350,
  friction: 20,
  velocity: 0.01,
};

export type ButtonProps = {
  context?: 'incoming' | 'outgoing';
  variant: 'message' | 'mini' | 'draft';
  mod: 'play' | 'pause' | 'not-downloaded' | 'downloading' | 'computing';
  downloadFraction?: number;
  label: string;
  visible?: boolean;
  onClick: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
};

/** Handles animations, key events, and stopping event propagation */
export const PlaybackButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function ButtonInner(props, ref) {
    const {
      context,
      downloadFraction,
      label,
      mod,
      onClick,
      variant,
      visible = true,
    } = props;
    let size = 36;
    if (variant === 'mini') {
      size = 14;
    } else if (variant === 'draft') {
      size = 18;
    }

    const reducedMotion = useReducedMotion();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- FIXME
    const [animProps] = useSpring(
      {
        immediate: reducedMotion,
        config: SPRING_CONFIG,
        to: { scale: visible ? 1 : 0 },
      },
      [visible]
    );

    // Clicking button toggle playback
    const onButtonClick = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();

        onClick();
      },
      [onClick]
    );

    // Keyboard playback toggle
    const onButtonKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== 'Space') {
          return;
        }
        event.stopPropagation();
        event.preventDefault();

        onClick();
      },
      [onClick]
    );

    let content: JSX.Element | null = null;
    const strokeWidth = variant === 'message' ? 2 : 1;
    if (mod === 'downloading' && downloadFraction) {
      content = (
        <ProgressCircle
          fractionComplete={downloadFraction}
          width={size}
          strokeWidth={strokeWidth}
        />
      );
    } else if (
      mod === 'computing' ||
      (mod === 'downloading' && !downloadFraction)
    ) {
      content = (
        <div className="PlaybackButton__SpinnerV2-container">
          <SpinnerV2
            className="PlaybackButton__SpinnerV2"
            size={size}
            strokeWidth={strokeWidth * 2}
            marginRatio={1}
          />
        </div>
      );
    }

    const buttonComponent = (
      <button
        type="button"
        ref={ref}
        className={classNames(
          'PlaybackButton',
          `PlaybackButton--variant-${variant}`,
          context && `PlaybackButton--context-${context}`,
          mod ? `PlaybackButton--${mod}` : undefined
        )}
        onClick={onButtonClick}
        onKeyDown={onButtonKeyDown}
        tabIndex={0}
        aria-label={label}
      >
        {content}
      </button>
    );

    if (variant === 'message') {
      return <animated.div style={animProps}>{buttonComponent}</animated.div>;
    }

    return buttonComponent;
  }
);
