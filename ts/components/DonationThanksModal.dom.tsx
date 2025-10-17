// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import type { BadgeType } from '../badges/types.std.js';
import { Modal } from './Modal.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';
import { Checkbox } from './Checkbox.dom.js';
import { BadgeImage } from './BadgeImage.dom.js';
import { Spinner } from './Spinner.dom.js';

export type PropsType = {
  i18n: LocalizerType;
  onClose: (error?: Error) => void;
  badge: BadgeType | undefined;
  applyDonationBadge: (args: {
    badge: BadgeType | undefined;
    applyBadge: boolean;
    onComplete: (error?: Error) => void;
  }) => void;
};

export function DonationThanksModal({
  i18n,
  onClose,
  badge,
  applyDonationBadge,
}: PropsType): JSX.Element {
  const [applyBadgeIsChecked, setApplyBadgeIsChecked] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleBadge = (enabled: boolean) => {
    setApplyBadgeIsChecked(enabled);
  };

  const handleDone = () => {
    if (isUpdating) {
      return;
    }

    setIsUpdating(true);

    applyDonationBadge({
      badge,
      applyBadge: applyBadgeIsChecked,
      onComplete: (error?: Error) => {
        setIsUpdating(false);
        onClose(error);
      },
    });
  };

  return (
    <Modal
      modalName="DonationThanksModal"
      i18n={i18n}
      onClose={onClose}
      hasXButton
      noMouseClose
      modalFooter={
        <Button
          variant={ButtonVariant.Primary}
          onClick={handleDone}
          disabled={isUpdating}
        >
          {i18n('icu:done')}
        </Button>
      }
    >
      <div className="DonationThanksModal">
        <div className="DonationThanksModal__badge-icon">
          {badge ? (
            <BadgeImage badge={badge} size={88} />
          ) : (
            <Spinner
              ariaLabel={i18n('icu:loading')}
              moduleClassName="BadgeImage BadgeImage__loading"
              size="88px"
              svgSize="normal"
            />
          )}
        </div>

        <div className="DonationThanksModal__content">
          <h2 className="DonationThanksModal__title">
            {i18n('icu:Donations__badge-modal--title')}
          </h2>
          <p className="DonationThanksModal__description">
            {i18n('icu:Donations__badge-modal--description')}
          </p>
        </div>

        <div className="DonationThanksModal__separator" />

        <div className="DonationThanksModal__toggle-section">
          <Checkbox
            checked={applyBadgeIsChecked}
            label=""
            name="donation-badge-display"
            onChange={handleToggleBadge}
          />
          <span className="DonationThanksModal__toggle-text">
            {i18n('icu:Donations__badge-modal--display-on-profile')}
          </span>
        </div>

        <div className="DonationThanksModal__help-text">
          {i18n('icu:Donations__badge-modal--help-text')}
        </div>
      </div>
    </Modal>
  );
}
