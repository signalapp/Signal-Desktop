// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import type { PropsType } from '../components/ConfirmDiscardDialog';

import { ConfirmDiscardDialog } from '../components/ConfirmDiscardDialog';
import type { LocalizerType } from '../types/Util';

export function useConfirmDiscard(
  i18n: LocalizerType
): [JSX.Element | null, (condition: boolean, callback: () => void) => void] {
  const [props, setProps] = useState<Omit<PropsType, 'i18n'> | null>(null);
  const confirmElement = props ? (
    <ConfirmDiscardDialog i18n={i18n} {...props} />
  ) : null;

  function confirmDiscardIf(condition: boolean, callback: () => void) {
    if (condition) {
      setProps({
        onClose() {
          setProps(null);
        },
        onDiscard: callback,
      });
    } else {
      callback();
    }
  }

  return [confirmElement, confirmDiscardIf];
}
