// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Button, ButtonVariant } from './Button';
import type { ConversationType } from '../state/ducks/conversations';
import { Intl } from './Intl';
import type { LocalizerType } from '../types/Util';

export type PropsType = {
  contact: ConversationType;
  generateSafetyNumber: (contact: ConversationType) => void;
  i18n: LocalizerType;
  onClose: () => void;
  safetyNumber: string;
  toggleVerified: (contact: ConversationType) => void;
  verificationDisabled: boolean;
};

export const SafetyNumberViewer = ({
  contact,
  generateSafetyNumber,
  i18n,
  onClose,
  safetyNumber,
  toggleVerified,
  verificationDisabled,
}: PropsType): JSX.Element | null => {
  React.useEffect(() => {
    if (!contact) {
      return;
    }

    generateSafetyNumber(contact);
  }, [contact, generateSafetyNumber, safetyNumber]);

  if (!contact) {
    return null;
  }

  if (!contact.phoneNumber) {
    return (
      <div className="module-SafetyNumberViewer">
        <div>{i18n('cannotGenerateSafetyNumber')}</div>
        <div className="module-SafetyNumberViewer__buttons">
          <Button
            className="module-SafetyNumberViewer__button"
            onClick={() => onClose?.()}
            variant={ButtonVariant.Primary}
          >
            {i18n('ok')}
          </Button>
        </div>
      </div>
    );
  }

  const showNumber = Boolean(contact.name || contact.profileName);
  const numberFragment =
    showNumber && contact.phoneNumber ? ` · ${contact.phoneNumber}` : '';
  const name = `${contact.title}${numberFragment}`;
  const boldName = (
    <span className="module-SafetyNumberViewer__bold-name">{name}</span>
  );

  const { isVerified } = contact;
  const verifiedStatusKey = isVerified ? 'isVerified' : 'isNotVerified';
  const verifyButtonText = isVerified ? i18n('unverify') : i18n('verify');

  return (
    <div className="module-SafetyNumberViewer">
      <div className="module-SafetyNumberViewer__number">
        {safetyNumber || getPlaceholder()}
      </div>
      <Intl i18n={i18n} id="verifyHelp" components={[boldName]} />
      <div className="module-SafetyNumberViewer__verification-status">
        {isVerified ? (
          <span className="module-SafetyNumberViewer__icon--verified" />
        ) : (
          <span className="module-SafetyNumberViewer__icon--shield" />
        )}
        <Intl i18n={i18n} id={verifiedStatusKey} components={[boldName]} />
      </div>
      <div className="module-SafetyNumberViewer__button">
        <Button
          disabled={verificationDisabled}
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
};

function getPlaceholder(): string {
  return Array.from(Array(12))
    .map(() => 'XXXXX')
    .join(' ');
}
