// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent, ReactChild } from 'react';
import React, { useState } from 'react';
import { noop } from 'lodash';

import type { LocalizerType } from '../types/Util';
import { Button, ButtonVariant } from './Button';
import { Spinner } from './Spinner';

const PADDING_HORIZONTAL = 48;
const PADDING_VERTICAL = 12;

export enum CallingLobbyJoinButtonVariant {
  CallIsFull = 'CallIsFull',
  Join = 'Join',
  Loading = 'Loading',
  Start = 'Start',
}

/**
 * This component is a little weird. Why not just render a button with some children?
 *
 * The contents of this component can change but we don't want its size to change, so we
 * render all the variants invisibly, compute the maximum size, and then render the
 * "final" button with those dimensions.
 *
 * For example, we might initially render "Join call" and then render a spinner when you
 * click the button. The button shouldn't resize in that situation.
 */
export const CallingLobbyJoinButton: FunctionComponent<{
  disabled?: boolean;
  i18n: LocalizerType;
  onClick: () => void;
  variant: CallingLobbyJoinButtonVariant;
}> = ({ disabled, i18n, onClick, variant }) => {
  const [width, setWidth] = useState<undefined | number>();
  const [height, setHeight] = useState<undefined | number>();

  const childrenByVariant: Record<CallingLobbyJoinButtonVariant, ReactChild> = {
    [CallingLobbyJoinButtonVariant.CallIsFull]: i18n('calling__call-is-full'),
    [CallingLobbyJoinButtonVariant.Loading]: <Spinner svgSize="small" />,
    [CallingLobbyJoinButtonVariant.Join]: i18n('calling__join'),
    [CallingLobbyJoinButtonVariant.Start]: i18n('calling__start'),
  };

  return (
    <>
      {Boolean(width && height) && (
        <Button
          className="module-CallingLobbyJoinButton"
          disabled={disabled}
          onClick={onClick}
          style={{ width, height }}
          tabIndex={0}
          variant={ButtonVariant.Calling}
        >
          {childrenByVariant[variant]}
        </Button>
      )}
      <div
        style={{
          visibility: 'hidden',
          position: 'fixed',
          left: -9999,
          top: -9999,
        }}
      >
        {Object.values(CallingLobbyJoinButtonVariant).map(candidateVariant => (
          <Button
            key={candidateVariant}
            className="module-CallingLobbyJoinButton"
            variant={ButtonVariant.Calling}
            onClick={noop}
            ref={(button: HTMLButtonElement | null) => {
              if (!button) {
                return;
              }
              const { width: variantWidth, height: variantHeight } =
                button.getBoundingClientRect();

              // We could set the padding in CSS, but we don't do that in case some other
              //   styling causes a re-render of the button but not of the component. This
              //   is easiest to reproduce in Storybook, where the font hasn't loaded yet;
              //   we compute the size, then the font makes the text a bit larger, and
              //   there's a layout issue.
              setWidth((previousWidth = 0) =>
                Math.ceil(
                  Math.max(previousWidth, variantWidth + PADDING_HORIZONTAL)
                )
              );
              setHeight((previousHeight = 0) =>
                Math.ceil(
                  Math.max(previousHeight, variantHeight + PADDING_VERTICAL)
                )
              );
            }}
          >
            {childrenByVariant[candidateVariant]}
          </Button>
        ))}
      </div>
    </>
  );
};
