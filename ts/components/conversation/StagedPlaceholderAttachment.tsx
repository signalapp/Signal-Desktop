// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../../types/Util';

type Props = {
  onClick: () => void;
  i18n: LocalizerType;
};

export const StagedPlaceholderAttachment = ({
  i18n,
  onClick,
}: Props): JSX.Element => (
  <button
    type="button"
    className="module-staged-placeholder-attachment"
    onClick={onClick}
    title={i18n('add-image-attachment')}
  >
    <div className="module-staged-placeholder-attachment__plus-icon" />
  </button>
);
