// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { LocalizerType } from '../types/I18N.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { LocalBackupsSetupIcon } from './LocalBackupsSetupIcon.dom.tsx';

export type LocalBackupsConfirmKeyDialogProps = Readonly<{
  i18n: LocalizerType;
  onContinue: () => void;
}>;

export function LocalBackupsConfirmKeyDialog(
  props: LocalBackupsConfirmKeyDialogProps
): ReactNode {
  const { i18n } = props;

  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="sm" escape="cancel-is-destructive">
        <AxoDialog.Body>
          <div className={tw('mt-2 mb-3 flex justify-center')}>
            <LocalBackupsSetupIcon symbol="key" />
          </div>
          <div className={tw('text-center')}>
            <AxoDialog.Title>
              <span className={tw('type-title-medium')}>
                {i18n('icu:Preferences__local-backups-confirm-key-modal-title')}
              </span>
            </AxoDialog.Title>
            <AxoDialog.Description>
              <p className={tw('type-body-medium text-secondary')}>
                {i18n('icu:Preferences__local-backups-confirm-key-modal-body')}
              </p>
            </AxoDialog.Description>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions width="fill">
            <AxoDialog.Action
              variant="strong-primary"
              onClick={props.onContinue}
            >
              {i18n(
                'icu:Preferences__local-backups-confirm-key-modal-continue'
              )}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
