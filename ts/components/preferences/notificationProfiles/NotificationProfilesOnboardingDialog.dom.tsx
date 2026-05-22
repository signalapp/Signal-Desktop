// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { tw } from '../../../axo/tw.dom.tsx';
import type { LocalizerType } from '../../../types/I18N.std.ts';
import { ProfileAvatar } from '../../PreferencesNotificationProfiles.dom.tsx';
import { AxoDialog } from '../../../axo/AxoDialog.dom.tsx';

export type NotificationProfilesOnboardingDialogProps = Readonly<{
  i18n: LocalizerType;
  onDismiss: VoidFunction;
}>;

export function NotificationProfilesOnboardingDialog(
  props: NotificationProfilesOnboardingDialogProps
): ReactNode {
  const { i18n, onDismiss } = props;
  return (
    <AxoDialog.Root open onOpenChange={onDismiss}>
      <AxoDialog.Content size="sm" escape="cancel-is-destructive">
        <AxoDialog.Body>
          <div className={tw('flex flex-col items-center')}>
            <div className={tw('mt-6 mb-3')}>
              <ProfileAvatar i18n={i18n} size="large" />
            </div>
            <h1 className={tw('mb-2 type-title-medium text-label-primary')}>
              {i18n('icu:NotificationProfiles--title')}
            </h1>
            <p
              className={tw(
                'text-center type-body-large text-pretty text-label-secondary'
              )}
            >
              {i18n('icu:NotificationProfiles--setup-description')}
            </p>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="primary" onClick={onDismiss}>
              {i18n('icu:NotificationProfiles--setup-continue')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
