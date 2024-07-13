// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';
import classNames from 'classnames';
import { v4 as uuid } from 'uuid';
import type { TooltipPlacement } from './Tooltip';
import { Tooltip } from './Tooltip';
import { Theme } from '../util/theme';
import type { LocalizerType } from '../types/Util';

export enum CallingButtonType {
  AUDIO_DISABLED = 'AUDIO_DISABLED',
  AUDIO_OFF = 'AUDIO_OFF',
  AUDIO_ON = 'AUDIO_ON',
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
  MORE_OPTIONS = 'MORE_OPTIONS',
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

  let classNameSuffix = '';
  let tooltipContent = '';
  let disabled = false;
  if (buttonType === CallingButtonType.AUDIO_DISABLED) {
    classNameSuffix = 'audio--disabled';
    tooltipContent = i18n('icu:calling__button--audio-disabled');
    disabled = true;
  } else if (buttonType === CallingButtonType.AUDIO_OFF) {
    classNameSuffix = 'audio--off';
    tooltipContent = i18n('icu:calling__button--audio-on');
  } else if (buttonType === CallingButtonType.AUDIO_ON) {
    classNameSuffix = 'audio--on';
    tooltipContent = i18n('icu:calling__button--audio-off');
  } else if (buttonType === CallingButtonType.VIDEO_DISABLED) {
    classNameSuffix = 'video--disabled';
    tooltipContent = i18n('icu:calling__button--video-disabled');
    disabled = true;
  } else if (buttonType === CallingButtonType.VIDEO_OFF) {
    classNameSuffix = 'video--off';
    tooltipContent = i18n('icu:calling__button--video-on');
  } else if (buttonType === CallingButtonType.VIDEO_ON) {
    classNameSuffix = 'video--on';
    tooltipContent = i18n('icu:calling__button--video-off');
  } else if (buttonType === CallingButtonType.RING_DISABLED) {
    classNameSuffix = 'ring--disabled';
    disabled = true;
    tooltipContent = i18n(
      'icu:calling__button--ring__disabled-because-group-is-too-large'
    );
  } else if (buttonType === CallingButtonType.REACT_OFF) {
    classNameSuffix = 'react--off';
    tooltipContent = i18n('icu:calling__button--react');
  } else if (buttonType === CallingButtonType.REACT_ON) {
    classNameSuffix = 'react--on';
  } else if (buttonType === CallingButtonType.RAISE_HAND_OFF) {
    classNameSuffix = 'raise-hand--off';
    tooltipContent = i18n('icu:CallControls__MenuItemRaiseHand');
  } else if (buttonType === CallingButtonType.RAISE_HAND_ON) {
    classNameSuffix = 'raise-hand--on';
    tooltipContent = i18n('icu:CallControls__MenuItemRaiseHand--lower');
  } else if (buttonType === CallingButtonType.RING_OFF) {
    classNameSuffix = 'ring--off';
    tooltipContent = i18n('icu:CallingButton--ring-on');
  } else if (buttonType === CallingButtonType.RING_ON) {
    classNameSuffix = 'ring--on';
    tooltipContent = i18n('icu:CallingButton__ring-off');
  } else if (buttonType === CallingButtonType.PRESENTING_DISABLED) {
    classNameSuffix = 'presenting--disabled';
    tooltipContent = i18n('icu:calling__button--presenting-disabled');
    disabled = true;
  } else if (buttonType === CallingButtonType.PRESENTING_ON) {
    classNameSuffix = 'presenting--on';
    tooltipContent = i18n('icu:calling__button--presenting-off');
  } else if (buttonType === CallingButtonType.PRESENTING_OFF) {
    classNameSuffix = 'presenting--off';
    tooltipContent = i18n('icu:calling__button--presenting-on');
  } else if (buttonType === CallingButtonType.MORE_OPTIONS) {
    classNameSuffix = 'more-options';
    tooltipContent = i18n('icu:CallingButton--more-options');
  }

  const buttonContent = (
    <button
      aria-label={tooltipContent}
      className={classNames(
        'CallingButton__icon',
        `CallingButton__icon--${classNameSuffix}`
      )}
      disabled={disabled}
      id={uniqueButtonId}
      onClick={onClick}
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
