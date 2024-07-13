// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { forwardRef } from 'react';

import { Input } from './Input';
import type { LocalizerType } from '../types/Util';

export type PropsType = {
  disabled?: boolean;
  i18n: LocalizerType;
  onChangeValue: (value: string) => void;
  value: string;
};

export const GroupTitleInput = forwardRef<HTMLInputElement, PropsType>(
  function GroupTitleInputInner(
    { i18n, disabled = false, onChangeValue, value },
    ref
  ) {
    return (
      <Input
        disabled={disabled}
        i18n={i18n}
        onChange={onChangeValue}
        placeholder={i18n('icu:setGroupMetadata__group-name-placeholder')}
        maxLengthCount={32}
        ref={ref}
        value={value}
      />
    );
  }
);
