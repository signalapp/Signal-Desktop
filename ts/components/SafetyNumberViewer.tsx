// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import classNames from 'classnames';

import { Button, ButtonVariant } from './Button';
import { QrCode } from './QrCode';
import type { ConversationType } from '../state/ducks/conversations';
import { Intl } from './Intl';
import { Emojify } from './conversation/Emojify';
import type { LocalizerType } from '../types/Util';
import type { SafetyNumberType } from '../types/safetyNumber';
import { SAFETY_NUMBER_MIGRATION_URL } from '../types/support';
import {
  SafetyNumberIdentifierType,
  SafetyNumberMode,
} from '../types/safetyNumber';

export type PropsType = {
  contact: ConversationType;
  generateSafetyNumber: (contact: ConversationType) => void;
  i18n: LocalizerType;
  onClose: () => void;
  safetyNumberMode: SafetyNumberMode;
  safetyNumbers?: ReadonlyArray<SafetyNumberType>;
  toggleVerified: (contact: ConversationType) => void;
  showOnboarding?: () => void;
  verificationDisabled: boolean;
};

export function SafetyNumberViewer({
  contact,
  generateSafetyNumber,
  i18n,
  onClose,
  safetyNumberMode,
  safetyNumbers,
  toggleVerified,
  showOnboarding,
  verificationDisabled,
}: PropsType): JSX.Element | null {
  const hasSafetyNumbers = safetyNumbers != null;
  React.useEffect(() => {
    if (!contact) {
      return;
    }

    generateSafetyNumber(contact);
  }, [contact, generateSafetyNumber]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!contact || !hasSafetyNumbers) {
    return null;
  }

  if (!safetyNumbers.length) {
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

  const isMigrationVisible = safetyNumberMode !== SafetyNumberMode.JustE164;

  const visibleSafetyNumber = safetyNumbers.at(selectedIndex);
  if (!visibleSafetyNumber) {
    return null;
  }

  const cardClassName = classNames('module-SafetyNumberViewer__card', {
    'module-SafetyNumberViewer__card--aci':
      visibleSafetyNumber.identifierType ===
      SafetyNumberIdentifierType.ACIIdentifier,
    'module-SafetyNumberViewer__card--e164':
      visibleSafetyNumber.identifierType ===
      SafetyNumberIdentifierType.E164Identifier,
  });

  const numberBlocks = visibleSafetyNumber.numberBlocks.join(' ');

  const safetyNumberCard = (
    <div className="module-SafetyNumberViewer__card-container">
      <div className={cardClassName}>
        <QrCode
          className="module-SafetyNumberViewer__card__qr"
          data={visibleSafetyNumber.qrData}
          alt={i18n('icu:Install__scan-this-code')}
        />
        <div className="module-SafetyNumberViewer__card__number">
          {numberBlocks}
        </div>

        {selectedIndex > 0 && (
          <button
            type="button"
            aria-label={i18n('icu:SafetyNumberViewer__card__prev')}
            className="module-SafetyNumberViewer__card__prev"
            onClick={() => setSelectedIndex(x => x - 1)}
          />
        )}

        {selectedIndex < safetyNumbers.length - 1 && (
          <button
            type="button"
            aria-label={i18n('icu:SafetyNumberViewer__card__next')}
            className="module-SafetyNumberViewer__card__next"
            onClick={() => setSelectedIndex(x => x + 1)}
          />
        )}
      </div>
    </div>
  );

  const carousel = (
    <div className="module-SafetyNumberViewer__carousel">
      {safetyNumbers.map(({ identifierType }, index) => {
        return (
          <button
            type="button"
            aria-label={i18n('icu:SafetyNumberViewer__carousel__dot', {
              index: index + 1,
              total: safetyNumbers.length,
            })}
            aria-pressed={index === selectedIndex}
            key={identifierType}
            className="module-SafetyNumberViewer__carousel__dot"
            onClick={() => setSelectedIndex(index)}
          />
        );
      })}
    </div>
  );

  return (
    <div className="module-SafetyNumberViewer">
      {isMigrationVisible && (
        <div className="module-SafetyNumberViewer__migration">
          <div className="module-SafetyNumberViewer__migration__icon" />

          <div className="module-SafetyNumberViewer__migration__text">
            <p>
              <Intl i18n={i18n} id="icu:SafetyNumberViewer__migration__text" />
            </p>
            <p>
              <a
                href={SAFETY_NUMBER_MIGRATION_URL}
                rel="noreferrer"
                target="_blank"
                onClick={e => {
                  if (showOnboarding) {
                    e.preventDefault();
                    showOnboarding();
                  }
                }}
              >
                <Intl
                  i18n={i18n}
                  id="icu:SafetyNumberViewer__migration__learn_more"
                />
              </a>
            </p>
          </div>
        </div>
      )}

      {safetyNumberCard}

      {safetyNumbers.length > 1 && carousel}

      <div className="module-SafetyNumberViewer__help">
        {isMigrationVisible ? (
          <Intl
            i18n={i18n}
            id="icu:SafetyNumberViewer__hint--migration"
            components={{ name: boldName }}
          />
        ) : (
          <Intl
            i18n={i18n}
            id="icu:SafetyNumberViewer__hint--normal"
            components={{ name: boldName }}
          />
        )}
        <br />
        <a href={SAFETY_NUMBER_MIGRATION_URL} rel="noreferrer" target="_blank">
          <Intl
            i18n={i18n}
            id="icu:SafetyNumberViewer__migration__learn_more"
          />
        </a>
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
}
