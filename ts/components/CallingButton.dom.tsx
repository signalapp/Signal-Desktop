// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useCallback, type JSX, type MouseEvent } from 'react';
import classNames from 'classnames';
import { v4 as uuid } from 'uuid';
import type { TooltipPlacement } from './Tooltip.dom.tsx';
import { Tooltip } from './Tooltip.dom.tsx';
import { Theme } from '../util/theme.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';

export enum CallingButtonType {
  AUDIO_DISABLED = 'AUDIO_DISABLED',
  AUDIO_OFF = 'AUDIO_OFF',
  AUDIO_ON = 'AUDIO_ON',
  FULL_SCREEN_CALL = 'FULL_SCREEN_CALL',
  HANGUP_GROUP = 'HANGUP_GROUP',
  HANGUP_DIRECT = 'HANGUP_DIRECT',
  MAXIMIZE = 'MAXIMIZE',
  MINIMIZE = 'MINIMIZE',
  MORE_OPTIONS = 'MORE_OPTIONS',
  PRESENTING_DISABLED = 'PRESENTING_DISABLED',
  PRESENTING_OFF = 'PRESENTING_OFF',
  PRESENTING_ON = 'PRESENTING_ON',
  RAISE_HAND_OFF = 'RAISE_HAND_OFF',
  RAISE_HAND_ON = 'RAISE_HAND_ON',
  REACT_OFF = 'REACT_OFF',
  REACT_ON = 'REACT_ON',
  RING_DISABLED = 'RING_DISABLED',
  RING_OFF = 'RING_OFF',
  RING_ON = 'RING_ON',
  VIDEO_DISABLED = 'VIDEO_DISABLED',
  VIDEO_OFF = 'VIDEO_OFF',
  VIDEO_ON = 'VIDEO_ON',
}

export type PropsType = {
  buttonType: CallingButtonType;
  i18n: LocalizerType;
  isVisible?: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  tooltipDirection?: TooltipPlacement;
};

export function CallingButton({
  buttonType,
  i18n,
  isVisible = true,
  onClick,
  onMouseEnter,
  onMouseLeave,
  tooltipDirection,
}: PropsType): JSX.Element {
  const uniqueButtonId = useMemo(() => uuid(), []);

  let iconClassName = '';
  let tooltipContent = '';
  let disabled = false;
  if (buttonType === CallingButtonType.AUDIO_DISABLED) {
    iconClassName = 'CallingButton__icon--audio--disabled';
    tooltipContent = i18n('icu:calling__button--audio-disabled');
    disabled = true;
  } else if (buttonType === CallingButtonType.AUDIO_OFF) {
    iconClassName = 'CallingButton__icon--audio--off';
    tooltipContent = i18n('icu:calling__button--audio-on');
  } else if (buttonType === CallingButtonType.AUDIO_ON) {
    iconClassName = 'CallingButton__icon--audio--on';
    tooltipContent = i18n('icu:calling__button--audio-off');
  } else if (buttonType === CallingButtonType.VIDEO_DISABLED) {
    iconClassName = 'CallingButton__icon--video--disabled';
    tooltipContent = i18n('icu:calling__button--video-disabled');
    disabled = true;
  } else if (buttonType === CallingButtonType.VIDEO_OFF) {
    iconClassName = 'CallingButton__icon--video--off';
    tooltipContent = i18n('icu:calling__button--video-on');
  } else if (buttonType === CallingButtonType.VIDEO_ON) {
    iconClassName = 'CallingButton__icon--video--on';
    tooltipContent = i18n('icu:calling__button--video-off');
  } else if (buttonType === CallingButtonType.RING_DISABLED) {
    iconClassName = 'CallingButton__icon--ring--disabled';
    disabled = true;
    tooltipContent = i18n(
      'icu:calling__button--ring__disabled-because-group-is-too-large'
    );
  } else if (buttonType === CallingButtonType.REACT_OFF) {
    iconClassName = 'CallingButton__icon--react--off';
    tooltipContent = i18n('icu:calling__button--react');
  } else if (buttonType === CallingButtonType.REACT_ON) {
    iconClassName = 'CallingButton__icon--react--on';
  } else if (buttonType === CallingButtonType.RAISE_HAND_OFF) {
    iconClassName = 'CallingButton__icon--raise-hand--off';
    tooltipContent = i18n('icu:CallControls__MenuItemRaiseHand');
  } else if (buttonType === CallingButtonType.RAISE_HAND_ON) {
    iconClassName = 'CallingButton__icon--raise-hand--on';
    tooltipContent = i18n('icu:CallControls__MenuItemRaiseHand--lower');
  } else if (buttonType === CallingButtonType.RING_OFF) {
    iconClassName = 'CallingButton__icon--ring--off';
    tooltipContent = i18n('icu:CallingButton--ring-on');
  } else if (buttonType === CallingButtonType.RING_ON) {
    iconClassName = 'CallingButton__icon--ring--on';
    tooltipContent = i18n('icu:CallingButton__ring-off');
  } else if (buttonType === CallingButtonType.PRESENTING_DISABLED) {
    iconClassName = 'CallingButton__icon--presenting--disabled';
    tooltipContent = i18n('icu:calling__button--presenting-disabled');
    disabled = true;
  } else if (buttonType === CallingButtonType.PRESENTING_ON) {
    iconClassName = 'CallingButton__icon--presenting--on';
    tooltipContent = i18n('icu:calling__button--presenting-off');
  } else if (buttonType === CallingButtonType.PRESENTING_OFF) {
    iconClassName = 'CallingButton__icon--presenting--off';
    tooltipContent = i18n('icu:calling__button--presenting-on');
  } else if (buttonType === CallingButtonType.MORE_OPTIONS) {
    iconClassName = 'CallingButton__icon--more-options';
    tooltipContent = i18n('icu:CallingButton--more-options');
  } else if (buttonType === CallingButtonType.MAXIMIZE) {
    iconClassName = 'CallingButton__icon--maximize';
    tooltipContent = i18n('icu:calling__preview--maximize');
  } else if (buttonType === CallingButtonType.MINIMIZE) {
    iconClassName = 'CallingButton__icon--minimize';
    tooltipContent = i18n('icu:calling__preview--minimize');
  } else if (buttonType === CallingButtonType.FULL_SCREEN_CALL) {
    iconClassName = 'CallingButton__icon--full-screen-call';
    tooltipContent = i18n('icu:calling__pip--off');
  } else if (buttonType === CallingButtonType.HANGUP_DIRECT) {
    iconClassName = 'CallingButton__icon--hangup';
    tooltipContent = i18n(
      'icu:CallControls__JoinLeaveButton--hangup-1-1-tooltip'
    );
  } else if (buttonType === CallingButtonType.HANGUP_GROUP) {
    iconClassName = 'CallingButton__icon--hangup';
    tooltipContent = i18n(
      'icu:CallControls__JoinLeaveButton--hangup-group-tooltip'
    );
  }

  const handleClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      onClick();
    },
    [onClick]
  );
  const buttonContent = (
    <button
      aria-label={tooltipContent}
      className={classNames('CallingButton__icon', iconClassName)}
      disabled={disabled}
      id={uniqueButtonId}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      type="button"
    >
      <div />
    </button>
  );

  return (
    <div className="CallingButton">
      {tooltipContent === '' ? (
        <div className="CallingButton__button-container">{buttonContent}</div>
      ) : (
        <Tooltip
          className="CallingButton__tooltip"
          wrapperClassName={classNames(
            'CallingButton__button-container',
            !isVisible && 'CallingButton__button-container--hidden'
          )}
          content={tooltipContent}
          direction={tooltipDirection}
          theme={Theme.Dark}
        >
          {buttonContent}
        </Tooltip>
      )}
    </div>
  );
}
