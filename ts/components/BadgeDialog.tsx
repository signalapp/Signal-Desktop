// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import { strictAssert } from '../util/assert';
import type { LocalizerType } from '../types/Util';
import type { BadgeType } from '../badges/types';
import { BadgeCategory } from '../badges/BadgeCategory';
import { Modal } from './Modal';
import { Button, ButtonSize } from './Button';
import { BadgeDescription } from './BadgeDescription';
import { BadgeImage } from './BadgeImage';
import { BadgeCarouselIndex } from './BadgeCarouselIndex';
import { BadgeSustainerInstructionsDialog } from './BadgeSustainerInstructionsDialog';

export type PropsType = Readonly<{
  areWeASubscriber: boolean;
  badges: ReadonlyArray<BadgeType>;
  firstName?: string;
  i18n: LocalizerType;
  onClose: () => unknown;
  title: string;
}>;

export function BadgeDialog(props: PropsType): null | JSX.Element {
  const { badges, i18n, onClose } = props;

  const [isShowingInstructions, setIsShowingInstructions] = useState(false);

  const hasBadges = badges.length > 0;
  useEffect(() => {
    if (!hasBadges && !isShowingInstructions) {
      onClose();
    }
  }, [hasBadges, isShowingInstructions, onClose]);

  if (isShowingInstructions) {
    return (
      <BadgeSustainerInstructionsDialog
        i18n={i18n}
        onClose={() => setIsShowingInstructions(false)}
      />
    );
  }

  return hasBadges ? (
    <BadgeDialogWithBadges
      {...props}
      onShowInstructions={() => setIsShowingInstructions(true)}
    />
  ) : null;
}

function BadgeDialogWithBadges({
  areWeASubscriber,
  badges,
  firstName,
  i18n,
  onClose,
  onShowInstructions,
  title,
}: PropsType & { onShowInstructions: () => unknown }): JSX.Element {
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
      modalName="BadgeDialog"
      hasXButton
      moduleClassName="BadgeDialog"
      i18n={i18n}
      onClose={onClose}
    >
      <div className="BadgeDialog__contents">
        <button
          aria-label={i18n('icu:previous')}
          className="BadgeDialog__nav BadgeDialog__nav--previous"
          disabled={currentBadgeIndex === 0}
          onClick={() => navigate(-1)}
          type="button"
        />
        <div className="BadgeDialog__main">
          <BadgeImage badge={currentBadge} size={160} />
          <div className="BadgeDialog__name">{currentBadge.name}</div>
          <div className="BadgeDialog__description">
            <BadgeDescription
              firstName={firstName}
              template={currentBadge.descriptionTemplate}
              title={title}
            />
          </div>
          {!areWeASubscriber && (
            <Button
              className={classNames(
                'BadgeDialog__instructions-button',
                currentBadge.category !== BadgeCategory.Donor &&
                  'BadgeDialog__instructions-button--hidden'
              )}
              onClick={onShowInstructions}
              size={ButtonSize.Large}
            >
              {i18n('icu:BadgeDialog__become-a-sustainer-button')}
            </Button>
          )}
          <BadgeCarouselIndex
            currentIndex={currentBadgeIndex}
            totalCount={badges.length}
          />
        </div>
        <button
          aria-label={i18n('icu:next')}
          className="BadgeDialog__nav BadgeDialog__nav--next"
          disabled={currentBadgeIndex === badges.length - 1}
          onClick={() => navigate(1)}
          type="button"
        />
      </div>
    </Modal>
  );
}
