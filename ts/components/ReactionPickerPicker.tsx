// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, ReactNode } from 'react';
import React, { forwardRef } from 'react';
import classNames from 'classnames';

import { Emoji } from './emoji/Emoji';
import type { LocalizerType } from '../types/Util';

export enum ReactionPickerPickerStyle {
  Picker,
  Menu,
}

export const ReactionPickerPickerEmojiButton = React.forwardRef<
  HTMLButtonElement,
  {
    emoji: string;
    isSelected: boolean;
    onClick: () => unknown;
    title?: string;
  }
>(({ emoji, onClick, isSelected, title }, ref) => (
  <button
    type="button"
    ref={ref}
    tabIndex={0}
    className={classNames(
      'module-ReactionPickerPicker__button',
      'module-ReactionPickerPicker__button--emoji',
      isSelected && 'module-ReactionPickerPicker__button--selected'
    )}
    onClick={event => {
      event.stopPropagation();
      onClick();
    }}
  >
    <Emoji size={48} emoji={emoji} title={title} />
  </button>
));

export const ReactionPickerPickerMoreButton = ({
  i18n,
  onClick,
}: Readonly<{
  i18n: LocalizerType;
  onClick: () => unknown;
}>): JSX.Element => (
  <button
    aria-label={i18n('Reactions--more')}
    className="module-ReactionPickerPicker__button module-ReactionPickerPicker__button--more"
    onClick={event => {
      event.stopPropagation();
      onClick();
    }}
    tabIndex={0}
    title={i18n('Reactions--more')}
    type="button"
  >
    <div className="module-ReactionPickerPicker__button--more__dot" />
    <div className="module-ReactionPickerPicker__button--more__dot" />
    <div className="module-ReactionPickerPicker__button--more__dot" />
  </button>
);

export const ReactionPickerPicker = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    isSomethingSelected: boolean;
    pickerStyle: ReactionPickerPickerStyle;
    style?: CSSProperties;
  }
>(({ children, isSomethingSelected, pickerStyle, style }, ref) => (
  <div
    className={classNames(
      'module-ReactionPickerPicker',
      isSomethingSelected && 'module-ReactionPickerPicker--something-selected',
      {
        'module-ReactionPickerPicker--picker-style':
          pickerStyle === ReactionPickerPickerStyle.Picker,
        'module-ReactionPickerPicker--menu-style':
          pickerStyle === ReactionPickerPickerStyle.Menu,
      }
    )}
    ref={ref}
    style={style}
  >
    {children}
  </div>
));
