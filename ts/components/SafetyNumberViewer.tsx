// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { ConversationType } from '../state/ducks/conversations';
import { LocalizerType } from '../types/Util';
import { Intl } from './Intl';

export type PropsType = {
  contact?: ConversationType;
  generateSafetyNumber: (contact: ConversationType) => void;
  i18n: LocalizerType;
  onClose?: () => void;
  safetyNumber: string;
  safetyNumberChanged?: boolean;
  toggleVerified: (contact: ConversationType) => void;
  verificationDisabled: boolean;
};

export const SafetyNumberViewer = ({
  contact,
  generateSafetyNumber,
  i18n,
  onClose,
  safetyNumber,
  safetyNumberChanged,
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
      <div className="module-safety-number">
        <div className="module-safety-number__verify-container">
          {i18n('cannotGenerateSafetyNumber')}
        </div>
      </div>
    );
  }

  const showNumber = Boolean(contact.name || contact.profileName);
  const numberFragment =
    showNumber && contact.phoneNumber ? ` · ${contact.phoneNumber}` : '';
  const name = `${contact.title}${numberFragment}`;
  const boldName = (
    <span className="module-safety-number__bold-name">{name}</span>
  );

  const { isVerified } = contact;
  const verifiedStatusKey = isVerified ? 'isVerified' : 'isNotVerified';
  const safetyNumberChangedKey = safetyNumberChanged
    ? 'changedRightAfterVerify'
    : 'yourSafetyNumberWith';
  const verifyButtonText = isVerified ? i18n('unverify') : i18n('verify');

  return (
    <div className="module-safety-number">
      {onClose && (
        <div className="module-safety-number__close-button">
          <button onClick={onClose} tabIndex={0} type="button">
            <span />
          </button>
        </div>
      )}
      <div className="module-safety-number__verification-label">
        <Intl
          i18n={i18n}
          id={safetyNumberChangedKey}
          components={{
            name1: boldName,
            name2: boldName,
          }}
        />
      </div>
      <div className="module-safety-number__number">
        {safetyNumber || getPlaceholder()}
      </div>
      <Intl i18n={i18n} id="verifyHelp" components={[boldName]} />
      <div className="module-safety-number__verification-status">
        {isVerified ? (
          <span className="module-safety-number__icon--verified" />
        ) : (
          <span className="module-safety-number__icon--shield" />
        )}
        <Intl i18n={i18n} id={verifiedStatusKey} components={[boldName]} />
      </div>
      <div className="module-safety-number__verify-container">
        <button
          className="module-safety-number__button--verify"
          disabled={verificationDisabled}
          onClick={() => {
            toggleVerified(contact);
          }}
          tabIndex={0}
          type="button"
        >
          {verifyButtonText}
        </button>
      </div>
    </div>
  );
};

function getPlaceholder(): string {
  return Array.from(Array(12))
    .map(() => 'XXXXX')
    .join(' ');
}
