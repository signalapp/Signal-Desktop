// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../../types/Util';

export type Props = {
  onClick: () => void;
  i18n: LocalizerType;
};

export function StagedPlaceholderAttachment({
  i18n,
  onClick,
}: Props): JSX.Element {
  return (
    <button
      type="button"
      className="module-staged-placeholder-attachment"
      onClick={onClick}
      aria-label={i18n('icu:addImageOrVideoattachment')}
    >
      <div className="module-staged-placeholder-attachment__plus-icon" />
    </button>
  );
}
