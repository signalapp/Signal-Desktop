// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import classNames from 'classnames';

import { getBadgeImageFileLocalPath } from '../badges/getBadgeImageFileLocalPath.std.ts';
import { Modal } from './Modal.dom.tsx';
import { BadgeImageTheme } from '../badges/BadgeImageTheme.std.ts';

import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import type { LocalizerType } from '../types/Util.std.ts';

export type PropsType = {
  recipientTitle: string;
  i18n: LocalizerType;
  badgeId: string;
  hideOutgoingGiftBadgeModal: () => unknown;
  getPreferredBadge: PreferredBadgeSelectorType;
};

export function OutgoingGiftBadgeModal({
  recipientTitle,
  i18n,
  badgeId,
  hideOutgoingGiftBadgeModal,
  getPreferredBadge,
}: PropsType): JSX.Element {
  const badge = getPreferredBadge([{ id: badgeId }]);
  const badgeSize = 140;
  const badgeImagePath = getBadgeImageFileLocalPath(
    badge,
    badgeSize,
    BadgeImageTheme.Transparent
  );

  const badgeElement = badge ? (
    <img
      className="OutgoingGiftBadgeModal__badge"
      src={badgeImagePath}
      alt={badge.name}
    />
  ) : (
    <div
      className={classNames(
        'OutgoingGiftBadgeModal__badge',
        'OutgoingGiftBadgeModal__badge--missing'
      )}
      aria-label={i18n('icu:donation--missing')}
    />
  );

  return (
    <Modal
      modalName="OutgoingGiftBadgeModal"
      i18n={i18n}
      className="OutgoingGiftBadgeModal__modal"
      onClose={hideOutgoingGiftBadgeModal}
      hasXButton
    >
      <div className="OutgoingGiftBadgeModal">
        <div className="OutgoingGiftBadgeModal__title">
          {i18n('icu:modal--donation--title')}
        </div>
        <div className="OutgoingGiftBadgeModal__description">
          {i18n('icu:modal--donation--description', { name: recipientTitle })}
        </div>
        {badgeElement}
        <div className="OutgoingGiftBadgeModal__badge-summary">
          {i18n('icu:message--donation')}
        </div>
      </div>
    </Modal>
  );
}
