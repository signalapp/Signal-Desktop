// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';

import { strictAssert } from '../util/assert';
import type { LocalizerType } from '../types/Util';
import type { BadgeType } from '../badges/types';
import { Modal } from './Modal';
import { BadgeDescription } from './BadgeDescription';
import { BadgeImage } from './BadgeImage';
import { BadgeCarouselIndex } from './BadgeCarouselIndex';

type PropsType = Readonly<{
  badges: ReadonlyArray<BadgeType>;
  firstName?: string;
  i18n: LocalizerType;
  onClose: () => unknown;
  title: string;
}>;

export function BadgeDialog(props: PropsType): null | JSX.Element {
  const { badges, onClose } = props;

  const hasBadges = badges.length > 0;
  useEffect(() => {
    if (!hasBadges) {
      onClose();
    }
  }, [hasBadges, onClose]);

  return hasBadges ? <BadgeDialogWithBadges {...props} /> : null;
}

function BadgeDialogWithBadges({
  badges,
  firstName,
  i18n,
  onClose,
  title,
}: PropsType): JSX.Element {
  const firstBadge = badges[0];
  strictAssert(
    firstBadge,
    '<BadgeDialogWithBadges> got an empty array of badges'
  );

  const [currentBadgeId, setCurrentBadgeId] = useState(firstBadge.id);

  let currentBadge: BadgeType;
  let currentBadgeIndex: number = badges.findIndex(
    b => b.id === currentBadgeId
  );
  if (currentBadgeIndex === -1) {
    currentBadgeIndex = 0;
    currentBadge = firstBadge;
  } else {
    currentBadge = badges[currentBadgeIndex];
  }

  const setCurrentBadgeIndex = (index: number): void => {
    const newBadge = badges[index];
    strictAssert(newBadge, '<BadgeDialog> tried to select a nonexistent badge');
    setCurrentBadgeId(newBadge.id);
  };

  const navigate = (change: number): void => {
    setCurrentBadgeIndex(currentBadgeIndex + change);
  };

  return (
    <Modal
      hasXButton
      moduleClassName="BadgeDialog"
      i18n={i18n}
      onClose={onClose}
    >
      <button
        aria-label={i18n('previous')}
        className="BadgeDialog__nav BadgeDialog__nav--previous"
        disabled={currentBadgeIndex === 0}
        onClick={() => navigate(-1)}
        type="button"
      />
      <div className="BadgeDialog__main">
        <BadgeImage badge={currentBadge} size={200} />
        <div className="BadgeDialog__name">{currentBadge.name}</div>
        <div className="BadgeDialog__description">
          <BadgeDescription
            firstName={firstName}
            template={currentBadge.descriptionTemplate}
            title={title}
          />
        </div>
        <BadgeCarouselIndex
          currentIndex={currentBadgeIndex}
          totalCount={badges.length}
        />
      </div>
      <button
        aria-label={i18n('next')}
        className="BadgeDialog__nav BadgeDialog__nav--next"
        disabled={currentBadgeIndex === badges.length - 1}
        onClick={() => navigate(1)}
        type="button"
      />
    </Modal>
  );
}
