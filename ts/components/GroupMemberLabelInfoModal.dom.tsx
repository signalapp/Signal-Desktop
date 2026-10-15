// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { AxoDialog } from '../axo/AxoDialog.dom.tsx';

import type { LocalizerType } from '../types/Util.std.ts';
import { tw } from '../axo/tw.dom.tsx';

export type PropsType = {
  canAddLabel: boolean;
  hasLabel: boolean;
  i18n: LocalizerType;
  isEditMemberLabelEnabled: boolean;
  onClose: () => unknown;
  showEditMemberLabelScreen: () => unknown;
};

export function GroupMemberLabelInfoModal(props: PropsType): JSX.Element {
  const {
    canAddLabel,
    hasLabel,
    i18n,
    isEditMemberLabelEnabled,
    onClose,
    showEditMemberLabelScreen,
  } = props;
  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Body>
          <div className={tw('mb-2.5 flex justify-center')}>
            <img
              className={tw('dark:hidden')}
              src="images/tag_light.svg"
              height="32"
              width="32"
              alt=""
            />
            <img
              src="images/tag_dark.svg"
              className={tw('hidden dark:block')}
              height="32"
              width="32"
              alt=""
            />
          </div>
          <div className={tw('text-center')}>
            <AxoDialog.Title>
              <span className={tw('type-title-medium')}>
                {i18n('icu:GroupMemberLabelInfoModal--title')}
              </span>
            </AxoDialog.Title>
            <AxoDialog.Description>
              <p>{i18n('icu:GroupMemberLabelInfoModal--description')}</p>
            </AxoDialog.Description>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions width="fill">
            {isEditMemberLabelEnabled && canAddLabel && (
              <AxoDialog.Action
                variant="subtle-secondary"
                onClick={() => {
                  showEditMemberLabelScreen();
                  onClose();
                }}
              >
                {hasLabel
                  ? i18n('icu:GroupMemberLabelInfoModal--edit-label')
                  : i18n('icu:GroupMemberLabelInfoModal--add-label')}
              </AxoDialog.Action>
            )}
            <AxoDialog.Action
              variant="strong-primary"
              onClick={() => {
                onClose();
              }}
            >
              {i18n('icu:ok')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
