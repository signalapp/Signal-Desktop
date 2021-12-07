// Copyright 2020-2021 Signal Messenger, LLC
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
  HANG_UP = 'HANG_UP',
  PRESENTING_DISABLED = 'PRESENTING_DISABLED',
  PRESENTING_OFF = 'PRESENTING_OFF',
  PRESENTING_ON = 'PRESENTING_ON',
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

export const CallingButton = ({
  buttonType,
  i18n,
  isVisible = true,
  onClick,
  onMouseEnter,
  onMouseLeave,
  tooltipDirection,
}: PropsType): JSX.Element => {
  const uniqueButtonId = useMemo(() => uuid(), []);

  let classNameSuffix = '';
  let tooltipContent = '';
  let label = '';
  let disabled = false;
  if (buttonType === CallingButtonType.AUDIO_DISABLED) {
    classNameSuffix = 'audio--disabled';
    tooltipContent = i18n('calling__button--audio-disabled');
    label = i18n('calling__button--audio__label');
    disabled = true;
  } else if (buttonType === CallingButtonType.AUDIO_OFF) {
    classNameSuffix = 'audio--off';
    tooltipContent = i18n('calling__button--audio-on');
    label = i18n('calling__button--audio__label');
  } else if (buttonType === CallingButtonType.AUDIO_ON) {
    classNameSuffix = 'audio--on';
    tooltipContent = i18n('calling__button--audio-off');
    label = i18n('calling__button--audio__label');
  } else if (buttonType === CallingButtonType.VIDEO_DISABLED) {
    classNameSuffix = 'video--disabled';
    tooltipContent = i18n('calling__button--video-disabled');
    disabled = true;
    label = i18n('calling__button--video__label');
  } else if (buttonType === CallingButtonType.VIDEO_OFF) {
    classNameSuffix = 'video--off';
    tooltipContent = i18n('calling__button--video-on');
    label = i18n('calling__button--video__label');
  } else if (buttonType === CallingButtonType.VIDEO_ON) {
    classNameSuffix = 'video--on';
    tooltipContent = i18n('calling__button--video-off');
    label = i18n('calling__button--video__label');
  } else if (buttonType === CallingButtonType.HANG_UP) {
    classNameSuffix = 'hangup';
    tooltipContent = i18n('calling__hangup');
    label = i18n('calling__hangup');
  } else if (buttonType === CallingButtonType.RING_DISABLED) {
    classNameSuffix = 'ring--disabled';
    disabled = true;
    tooltipContent = i18n(
      'calling__button--ring__disabled-because-group-is-too-large'
    );
    label = i18n('calling__button--ring__label');
  } else if (buttonType === CallingButtonType.RING_OFF) {
    classNameSuffix = 'ring--off';
    tooltipContent = i18n('calling__button--ring__on');
    label = i18n('calling__button--ring__label');
  } else if (buttonType === CallingButtonType.RING_ON) {
    classNameSuffix = 'ring--on';
    tooltipContent = i18n('calling__button--ring__off');
    label = i18n('calling__button--ring__label');
  } else if (buttonType === CallingButtonType.PRESENTING_DISABLED) {
    classNameSuffix = 'presenting--disabled';
    tooltipContent = i18n('calling__button--presenting-disabled');
    disabled = true;
    label = i18n('calling__button--presenting__label');
  } else if (buttonType === CallingButtonType.PRESENTING_ON) {
    classNameSuffix = 'presenting--on';
    tooltipContent = i18n('calling__button--presenting-off');
    label = i18n('calling__button--presenting__label');
  } else if (buttonType === CallingButtonType.PRESENTING_OFF) {
    classNameSuffix = 'presenting--off';
    tooltipContent = i18n('calling__button--presenting-on');
    label = i18n('calling__button--presenting__label');
  }

  const className = classNames(
    'CallingButton__icon',
    `CallingButton__icon--${classNameSuffix}`
  );

  return (
    <Tooltip
      content={tooltipContent}
      direction={tooltipDirection}
      theme={Theme.Dark}
    >
      <div
        className={classNames(
          'CallingButton__container',
          !isVisible && 'CallingButton__container--hidden'
        )}
      >
        <button
          aria-label={tooltipContent}
          className={className}
          disabled={disabled}
          id={uniqueButtonId}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          type="button"
        >
          <div />
        </button>
        <label className="CallingButton__label" htmlFor={uniqueButtonId}>
          {label}
        </label>
      </div>
    </Tooltip>
  );
};
