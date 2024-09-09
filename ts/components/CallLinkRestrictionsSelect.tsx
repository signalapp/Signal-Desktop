// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import {
  CallLinkRestrictions,
  toCallLinkRestrictions,
} from '../types/CallLink';
import type { LocalizerType } from '../types/I18N';
import { Select } from './Select';

export type CallLinkRestrictionsSelectProps = Readonly<{
  disabled?: boolean;
  i18n: LocalizerType;
  id?: string;
  value: CallLinkRestrictions;
  onChange: (value: CallLinkRestrictions) => void;
}>;

export function CallLinkRestrictionsSelect({
  disabled,
  i18n,
  id,
  value,
  onChange,
}: CallLinkRestrictionsSelectProps): JSX.Element {
  return (
    <Select
      disabled={disabled}
      id={id}
      value={String(value)}
      moduleClassName="CallLinkRestrictionsSelect"
      options={[
        {
          value: String(CallLinkRestrictions.None),
          text: i18n('icu:CallLinkRestrictionsSelect__Option--Off'),
        },
        {
          value: String(CallLinkRestrictions.AdminApproval),
          text: i18n('icu:CallLinkRestrictionsSelect__Option--On'),
        },
      ]}
      onChange={nextValue => {
        onChange(toCallLinkRestrictions(nextValue));
      }}
    />
  );
}
