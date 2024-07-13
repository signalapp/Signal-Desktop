// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Button, ButtonVariant } from './Button';
import { Modal } from './Modal';
import { I18n } from './I18n';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';
import type { LocalizerType } from '../types/Util';
import { SAFETY_NUMBER_URL } from '../types/support';

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => void;
};

function onLearnMore() {
  openLinkInWebBrowser(SAFETY_NUMBER_URL);
}

export function SafetyNumberNotReady({
  i18n,
  onClose,
}: PropsType): JSX.Element | null {
  return (
    <div className="module-SafetyNumberNotReady">
      <div>
        <I18n i18n={i18n} id="icu:SafetyNumberNotReady__body" />
      </div>

      <Modal.ButtonFooter>
        <Button onClick={onLearnMore} variant={ButtonVariant.Secondary}>
          <I18n i18n={i18n} id="icu:SafetyNumberNotReady__learn-more" />
        </Button>
        <Button onClick={onClose} variant={ButtonVariant.Secondary}>
          <I18n i18n={i18n} id="icu:ok" />
        </Button>
      </Modal.ButtonFooter>
    </div>
  );
}
