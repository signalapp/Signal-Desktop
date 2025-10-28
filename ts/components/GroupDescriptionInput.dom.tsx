// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { forwardRef } from 'react';

import { Input } from './Input.dom.js';
import type { LocalizerType } from '../types/Util.std.js';

export type PropsType = {
  disabled?: boolean;
  i18n: LocalizerType;
  onChangeValue: (value: string) => void;
  value: string;
};

export const GroupDescriptionInput = forwardRef<HTMLInputElement, PropsType>(
  function GroupDescriptionInput(
    { i18n, disabled = false, onChangeValue, value },
    ref
  ) {
    return (
      <Input
        disabled={disabled}
        expandable
        i18n={i18n}
        onChange={onChangeValue}
        placeholder={i18n(
          'icu:setGroupMetadata__group-description-placeholder'
        )}
        maxLengthCount={480}
        maxByteCount={8192}
        ref={ref}
        value={value}
        whenToShowRemainingCount={380}
      />
    );
  }
);
