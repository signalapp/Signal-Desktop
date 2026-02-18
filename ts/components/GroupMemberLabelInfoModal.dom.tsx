// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { AxoDialog } from '../axo/AxoDialog.dom.js';

import type { LocalizerType } from '../types/Util.std.js';
import { tw } from '../axo/tw.dom.js';

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
      <AxoDialog.Content size="xs" escape="cancel-is-noop">
        <AxoDialog.Body>
          <div className={tw('mt-4 mb-1')}>
            <img
              className={tw('mx-auto dark:hidden')}
              src="images/tag_light.svg"
              height="32"
              width="32"
              alt=""
            />
            <img
              src="images/tag_dark.svg"
              className={tw('mx-auto hidden dark:inline')}
              height="32"
              width="110"
              alt=""
            />
          </div>
          <AxoDialog.Title>
            <div className={tw('type-title-small')}>
              {i18n('icu:GroupMemberLabelInfoModal--title')}
            </div>
          </AxoDialog.Title>
          <AxoDialog.Description>
            <div className={tw('mb-1.5 type-body-medium text-label-secondary')}>
              {i18n('icu:GroupMemberLabelInfoModal--description')}
            </div>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          {isEditMemberLabelEnabled && canAddLabel && (
            <AxoDialog.Action
              variant="secondary"
              arrow={false}
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
            variant="primary"
            arrow={false}
            onClick={() => {
              onClose();
            }}
          >
            {i18n('icu:Confirmation--confirm')}
          </AxoDialog.Action>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
