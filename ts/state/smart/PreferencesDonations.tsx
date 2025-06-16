// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';

import type { MutableRefObject } from 'react';

import { getIntl } from '../selectors/user';
import { PreferencesDonations } from '../../components/PreferencesDonations';

export const SmartPreferencesDonations = memo(
  function SmartPreferencesDonations(props: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
  }) {
    const i18n = useSelector(getIntl);

    return <PreferencesDonations contentsRef={props.contentsRef} i18n={i18n} />;
  }
);
