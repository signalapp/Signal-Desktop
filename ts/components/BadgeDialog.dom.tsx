// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { strictAssert } from '../util/assert.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import type { BadgeType } from '../badges/types.std.ts';
import { BadgeDescription } from './BadgeDescription.dom.tsx';
import { BadgeImage } from './BadgeImage.dom.tsx';
import { BadgeCarouselIndex } from './BadgeCarouselIndex.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoIconButton } from '../axo/AxoIconButton.dom.tsx';

export type BadgeDialogProps = Readonly<{
  areWeASubscriber: boolean;
  badges: ReadonlyArray<BadgeType>;
  firstName?: string;
  i18n: LocalizerType;
  onClose: () => void;
  onDonate: () => void;
  title: string;
}>;

export function BadgeDialog(props: BadgeDialogProps): ReactNode {
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
}: BadgeDialogProps): JSX.Element {
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
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Body>
          <div className={tw('flex items-center gap-2')}>
            <div>
              <div className={tw('mb-2.5 flex justify-center')}>
                <BadgeImage badge={currentBadge} size={96} />
              </div>

              <AxoDialog.Title>
                {firstName
                  ? i18n('icu:BadgeDialog__name-supports-signal', {
                      name: firstName,
                    })
                  : currentBadge.name}
              </AxoDialog.Title>
              <AxoDialog.Description>
                <p className={tw('mb-2.5 text-center')}>
                  <BadgeDescription
                    firstName={firstName}
                    template={currentBadge.descriptionTemplate}
                    title={title}
                  />
                </p>
              </AxoDialog.Description>
              {!areWeASubscriber && (
                <div className={tw('mb-2.5 flex justify-center')}>
                  <AxoButton.Root
                    size="lg"
                    variant="strong-primary"
                    onClick={onDonate}
                  >
                    {i18n('icu:BadgeDialog__become-a-sustainer-button')}
                  </AxoButton.Root>
                </div>
              )}
            </div>

            <div className={tw('order-first')}>
              <AxoIconButton.Root
                label={i18n('icu:previous')}
                symbol="chevron-[start]"
                onClick={() => navigate(-1)}
                disabled={currentBadgeIndex === 0}
                variant="implied-secondary"
                size="md"
                tooltip={false}
              />
            </div>

            <div className={tw('order-last')}>
              <AxoIconButton.Root
                label={i18n('icu:next')}
                symbol="chevron-[end]"
                onClick={() => navigate(1)}
                disabled={currentBadgeIndex === badges.length - 1}
                variant="implied-secondary"
                size="md"
                tooltip={false}
              />
            </div>
          </div>

          <BadgeCarouselIndex
            currentIndex={currentBadgeIndex}
            totalCount={badges.length}
          />
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
