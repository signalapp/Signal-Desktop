// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useId, useState, type ReactNode } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import type { BadgeType } from '../badges/types.std.ts';
import { BadgeImage } from './BadgeImage.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoCheckbox } from '../axo/AxoCheckbox.dom.tsx';
import { AxoLoadingIndicator } from '../axo/status/AxoLoadingIndicator.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

export type ApplyDonationBadgeArgs = Readonly<{
  badge: BadgeType | null;
  applyBadge: boolean;
  onComplete: (error: Error | null) => void;
}>;

export type DonationThanksModalProps = Readonly<{
  i18n: LocalizerType;
  onClose: (error: Error | null) => void;
  badge: BadgeType | null;
  applyDonationBadge: (args: ApplyDonationBadgeArgs) => void;
}>;

export function DonationThanksModal(
  props: DonationThanksModalProps
): ReactNode {
  const { i18n, badge, applyDonationBadge, onClose } = props;

  const applyBadgeCheckboxId = useId();
  const [applyBadgeChecked, setApplyBadgeChecked] = useState(true);
  const [updating, setUpdating] = useState(false);

  const handleClose = useCallback(() => {
    onClose(null);
  }, [onClose]);

  const handleDone = useCallback(() => {
    if (updating) {
      return;
    }

    setUpdating(true);

    applyDonationBadge({
      badge,
      applyBadge: applyBadgeChecked,
      onComplete: (error: Error | null) => {
        setUpdating(false);
        onClose(error);
      },
    });
  }, [updating, applyDonationBadge, badge, applyBadgeChecked, onClose]);

  return (
    <AxoDialog.Root open onOpenChange={handleClose}>
      <AxoDialog.Content size="md" escape="cancel-is-destructive">
        <AxoDialog.Header floating>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('mb-6 flex justify-center')}>
            <div className={tw('flex size-22 items-center justify-center')}>
              {badge != null ? (
                <BadgeImage badge={badge} size={88} />
              ) : (
                <AxoLoadingIndicator.Root size="lg" />
              )}
            </div>
          </div>
          <div className={tw('text-center')}>
            <AxoDialog.Title>
              <span className={tw('type-title-medium')}>
                {i18n('icu:Donations__badge-modal--title')}
              </span>
            </AxoDialog.Title>
            <AxoDialog.Description>
              <p>{i18n('icu:Donations__badge-modal--description')}</p>
            </AxoDialog.Description>
          </div>
          <hr className={tw('my-6 border-primary')} />
          <div className={tw('flex items-center gap-3')}>
            <AxoCheckbox.Root
              variant="square"
              id={applyBadgeCheckboxId}
              checked={applyBadgeChecked}
              onCheckedChange={setApplyBadgeChecked}
            />
            <label
              htmlFor={applyBadgeCheckboxId}
              className={tw('grow text-primary')}
            >
              {i18n('icu:Donations__badge-modal--display-on-profile')}
            </label>
          </div>
          <p className={tw('mt-3 type-caption text-secondary')}>
            {i18n('icu:Donations__badge-modal--help-text')}
          </p>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="strong-primary"
              onClick={handleDone}
              pending={updating}
              disabled={badge == null}
            >
              {i18n('icu:done')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
