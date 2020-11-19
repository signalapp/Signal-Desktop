// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { Tooltip, TooltipPlacement, TooltipTheme } from './Tooltip';
import { LocalizerType } from '../types/Util';

export enum CallingButtonType {
  AUDIO_DISABLED = 'AUDIO_DISABLED',
  AUDIO_OFF = 'AUDIO_OFF',
  AUDIO_ON = 'AUDIO_ON',
  HANG_UP = 'HANG_UP',
  VIDEO_DISABLED = 'VIDEO_DISABLED',
  VIDEO_OFF = 'VIDEO_OFF',
  VIDEO_ON = 'VIDEO_ON',
}

export type PropsType = {
  buttonType: CallingButtonType;
  i18n: LocalizerType;
  onClick: () => void;
  tooltipDirection?: TooltipPlacement;
};

export const CallingButton = ({
  buttonType,
  i18n,
  onClick,
  tooltipDirection,
}: PropsType): JSX.Element => {
  let classNameSuffix = '';
  let tooltipContent = '';
  if (buttonType === CallingButtonType.AUDIO_DISABLED) {
    classNameSuffix = 'audio--disabled';
    tooltipContent = i18n('calling__button--audio-disabled');
  } else if (buttonType === CallingButtonType.AUDIO_OFF) {
    classNameSuffix = 'audio--off';
    tooltipContent = i18n('calling__button--audio-on');
  } else if (buttonType === CallingButtonType.AUDIO_ON) {
    classNameSuffix = 'audio--on';
    tooltipContent = i18n('calling__button--audio-off');
  } else if (buttonType === CallingButtonType.VIDEO_DISABLED) {
    classNameSuffix = 'video--disabled';
    tooltipContent = i18n('calling__button--video-disabled');
  } else if (buttonType === CallingButtonType.VIDEO_OFF) {
    classNameSuffix = 'video--off';
    tooltipContent = i18n('calling__button--video-on');
  } else if (buttonType === CallingButtonType.VIDEO_ON) {
    classNameSuffix = 'video--on';
    tooltipContent = i18n('calling__button--video-off');
  } else if (buttonType === CallingButtonType.HANG_UP) {
    classNameSuffix = 'hangup';
    tooltipContent = i18n('calling__hangup');
  }

  const className = classNames(
    'module-calling-button__icon',
    `module-calling-button__icon--${classNameSuffix}`
  );

  return (
    <Tooltip
      content={tooltipContent}
      direction={tooltipDirection}
      theme={TooltipTheme.Dark}
    >
      <button
        aria-label={tooltipContent}
        type="button"
        className={className}
        onClick={onClick}
      >
        <div />
      </button>
    </Tooltip>
  );
};
