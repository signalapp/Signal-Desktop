// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { getBadgeImageFileLocalPath } from '../badges/getBadgeImageFileLocalPath.std.ts';
import { BadgeImageTheme } from '../badges/BadgeImageTheme.std.ts';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

export type OutgoingGiftBadgeModalProps = Readonly<{
  i18n: LocalizerType;
  badgeId: string;
  getPreferredBadge: PreferredBadgeSelectorType;
  recipientTitle: string;
  onClose: () => void;
}>;

export function OutgoingGiftBadgeModal(
  props: OutgoingGiftBadgeModalProps
): ReactNode {
  const { i18n, getPreferredBadge } = props;
  const badge = getPreferredBadge([{ id: props.badgeId }]);
  const badgeSize = 140;
  const badgeImagePath = getBadgeImageFileLocalPath(
    badge,
    badgeSize,
    BadgeImageTheme.Transparent
  );

  return (
    <AxoDialog.Root open onOpenChange={props.onClose}>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header floating>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Title>
            <span className={tw('type-title-medium')}>
              {i18n('icu:modal--donation--title')}
            </span>
          </AxoDialog.Title>
          <div className={tw('mb-2.5 text-center')}>
            {i18n('icu:modal--donation--description', {
              name: props.recipientTitle,
            })}
          </div>
          <div className={tw('mb-2.5 flex justify-center')}>
            {badge != null ? (
              <img
                src={badgeImagePath}
                alt={badge.name}
                width={badgeSize}
                height={badgeSize}
              />
            ) : (
              <div
                className={tw('rounded-full bg-secondary')}
                style={{ width: badgeSize, height: badgeSize }}
              />
            )}
          </div>
          <p className={tw('text-center font-semibold')}>
            {i18n('icu:message--donation')}
          </p>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
