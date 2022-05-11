// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { getBadgeImageFileLocalPath } from '../badges/getBadgeImageFileLocalPath';
import { Modal } from './Modal';
import { BadgeImageTheme } from '../badges/BadgeImageTheme';

import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { LocalizerType } from '../types/Util';

const CLASS_NAME = 'OutgoingGiftBadgeModal';

export type PropsType = {
  recipientTitle: string;
  i18n: LocalizerType;
  badgeId: string;
  hideOutgoingGiftBadgeModal: () => unknown;
  getPreferredBadge: PreferredBadgeSelectorType;
};

export const OutgoingGiftBadgeModal = ({
  recipientTitle,
  i18n,
  badgeId,
  hideOutgoingGiftBadgeModal,
  getPreferredBadge,
}: PropsType): JSX.Element => {
  const badge = getPreferredBadge([{ id: badgeId }]);
  const badgeSize = 140;
  const badgeImagePath = getBadgeImageFileLocalPath(
    badge,
    badgeSize,
    BadgeImageTheme.Transparent
  );

  const badgeElement = badge ? (
    <img
      className={`${CLASS_NAME}__badge`}
      src={badgeImagePath}
      alt={badge.name}
    />
  ) : (
    <div
      className={classNames(
        `${CLASS_NAME}__badge`,
        `${CLASS_NAME}__badge--missing`
      )}
      aria-label={i18n('giftBadge--missing')}
    />
  );

  return (
    <Modal
      i18n={i18n}
      moduleClassName={`${CLASS_NAME}__container`}
      onClose={hideOutgoingGiftBadgeModal}
      hasXButton
      useFocusTrap
    >
      <div className={CLASS_NAME}>
        <div className={`${CLASS_NAME}__title`}>
          {i18n('modal--giftBadge--title')}
        </div>
        <div className={`${CLASS_NAME}__description`}>
          {i18n('modal--giftBadge--description', { name: recipientTitle })}
        </div>
        {badgeElement}
        <div className={`${CLASS_NAME}__badge-summary`}>
          {i18n('message--giftBadge')}
        </div>
      </div>
    </Modal>
  );
};
