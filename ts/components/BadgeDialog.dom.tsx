// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState, type JSX } from 'react';
import { strictAssert } from '../util/assert.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import type { BadgeType } from '../badges/types.std.ts';
import { Modal } from './Modal.dom.tsx';
import { BadgeDescription } from './BadgeDescription.dom.tsx';
import { BadgeImage } from './BadgeImage.dom.tsx';
import { BadgeCarouselIndex } from './BadgeCarouselIndex.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';

export type PropsType = Readonly<{
  areWeASubscriber: boolean;
  badges: ReadonlyArray<BadgeType>;
  firstName?: string;
  i18n: LocalizerType;
  onClose: () => void;
  onDonate: () => void;
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
  areWeASubscriber,
  badges,
  firstName,
  i18n,
  onClose,
  onDonate,
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
    // oxlint-disable-next-line typescript/no-non-null-assertion
    currentBadge = badges[currentBadgeIndex]!;
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
          <BadgeImage badge={currentBadge} size={96} />
          <div className="BadgeDialog__name">
            {firstName
              ? i18n('icu:BadgeDialog__name-supports-signal', {
                  name: firstName,
                })
              : currentBadge.name}
          </div>
          <div className="BadgeDialog__description">
            <BadgeDescription
              firstName={firstName}
              template={currentBadge.descriptionTemplate}
              title={title}
            />
          </div>
          {!areWeASubscriber && (
            <AxoButton.Root size="lg" variant="primary" onClick={onDonate}>
              {i18n('icu:BadgeDialog__become-a-sustainer-button')}
            </AxoButton.Root>
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
