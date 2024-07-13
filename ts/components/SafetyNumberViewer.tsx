// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Button, ButtonVariant } from './Button';
import { QrCode } from './QrCode';
import type { ConversationType } from '../state/ducks/conversations';
import { I18n } from './I18n';
import { Emojify } from './conversation/Emojify';
import type { LocalizerType } from '../types/Util';
import type { SafetyNumberType } from '../types/safetyNumber';
import { SAFETY_NUMBER_URL } from '../types/support';

export type PropsType = {
  contact: ConversationType;
  generateSafetyNumber: (contact: ConversationType) => void;
  i18n: LocalizerType;
  onClose: () => void;
  safetyNumber: SafetyNumberType | null;
  toggleVerified: (contact: ConversationType) => void;
  verificationDisabled: boolean | null;
};

export function SafetyNumberViewer({
  contact,
  generateSafetyNumber,
  i18n,
  onClose,
  safetyNumber,
  toggleVerified,
  verificationDisabled,
}: PropsType): JSX.Element | null {
  React.useEffect(() => {
    if (!contact) {
      return;
    }

    generateSafetyNumber(contact);
  }, [contact, generateSafetyNumber]);

  // Keyboard navigation

  if (!contact) {
    return null;
  }

  if (!safetyNumber) {
    return (
      <div className="module-SafetyNumberViewer">
        <div>{i18n('icu:cannotGenerateSafetyNumber')}</div>
        <div className="module-SafetyNumberViewer__buttons">
          <Button
            className="module-SafetyNumberViewer__button"
            onClick={() => onClose?.()}
            variant={ButtonVariant.Primary}
          >
            {i18n('icu:ok')}
          </Button>
        </div>
      </div>
    );
  }

  const boldName = (
    <span className="module-SafetyNumberViewer__bold-name">
      <Emojify text={contact.title} />
    </span>
  );

  const { isVerified } = contact;
  const verifyButtonText = isVerified
    ? i18n('icu:SafetyNumberViewer__clearVerification')
    : i18n('icu:SafetyNumberViewer__markAsVerified');

  const numberBlocks = safetyNumber.numberBlocks.join(' ');

  const safetyNumberCard = (
    <div className="module-SafetyNumberViewer__card-container">
      <div className="module-SafetyNumberViewer__card">
        <QrCode
          className="module-SafetyNumberViewer__card__qr"
          data={safetyNumber.qrData}
          alt={i18n('icu:Install__scan-this-code')}
        />
        <div className="module-SafetyNumberViewer__card__number">
          {numberBlocks}
        </div>
      </div>
    </div>
  );

  return (
    <div className="module-SafetyNumberViewer">
      {safetyNumberCard}

      <div className="module-SafetyNumberViewer__help">
        <I18n
          i18n={i18n}
          id="icu:SafetyNumberViewer__hint"
          components={{ name: boldName }}
        />
        <br />
        <a href={SAFETY_NUMBER_URL} rel="noreferrer" target="_blank">
          <I18n i18n={i18n} id="icu:SafetyNumberViewer__learn_more" />
        </a>
      </div>

      <div className="module-SafetyNumberViewer__button">
        <Button
          disabled={verificationDisabled ?? false}
          onClick={() => {
            toggleVerified(contact);
          }}
          variant={ButtonVariant.Secondary}
        >
          {verifyButtonText}
        </Button>
      </div>
    </div>
  );
}
