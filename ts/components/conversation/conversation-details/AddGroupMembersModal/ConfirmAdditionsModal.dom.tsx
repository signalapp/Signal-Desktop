// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import type { LocalizerType } from '../../../../types/Util.std.js';
import { assertDev } from '../../../../util/assert.std.js';
import { ModalHost } from '../../../ModalHost.dom.js';
import { Button, ButtonVariant } from '../../../Button.dom.js';
import { Spinner } from '../../../Spinner.dom.js';
import type { ConversationType } from '../../../../state/ducks/conversations.preload.js';
import { RequestState } from '../util.std.js';
import { I18n } from '../../../I18n.dom.js';
import { ContactName } from '../../ContactName.dom.js';
import { UserText } from '../../../UserText.dom.js';

export type StatePropsType = {
  groupTitle: string;
  i18n: LocalizerType;
  makeRequest: () => void;
  onClose: () => void;
  requestState: RequestState;
  selectedContacts: ReadonlyArray<ConversationType>;
};

type PropsType = StatePropsType;

export function ConfirmAdditionsModal({
  groupTitle,
  i18n,
  makeRequest,
  onClose,
  requestState,
  selectedContacts,
}: PropsType): JSX.Element {
  const firstContact = selectedContacts[0];
  assertDev(
    firstContact,
    'Expected at least one conversation to be selected but none were picked'
  );

  const groupTitleNode: JSX.Element = <UserText text={groupTitle} />;

  let headerText: ReactNode;
  if (selectedContacts.length === 1) {
    headerText = (
      <I18n
        i18n={i18n}
        id="icu:AddGroupMembersModal--confirm-title--one"
        components={{
          person: <ContactName title={firstContact.title} />,
          group: groupTitleNode,
        }}
      />
    );
  } else {
    headerText = (
      <I18n
        i18n={i18n}
        id="icu:AddGroupMembersModal--confirm-title--many"
        components={{
          count: selectedContacts.length,
          group: groupTitleNode,
        }}
      />
    );
  }

  let buttonContents: ReactNode;
  if (requestState === RequestState.Active) {
    buttonContents = (
      <Spinner size="20px" svgSize="small" direction="on-avatar" />
    );
  } else if (selectedContacts.length === 1) {
    buttonContents = i18n('icu:AddGroupMembersModal--confirm-button--one');
  } else {
    buttonContents = i18n('icu:AddGroupMembersModal--confirm-button--many');
  }

  return (
    <ModalHost
      modalName="AddGroupMemberModal.ConfirmAdditionsModal"
      onClose={onClose}
    >
      <div className="module-AddGroupMembersModal module-AddGroupMembersModal--confirm-adds">
        <h1 className="module-AddGroupMembersModal__header">{headerText}</h1>
        {requestState === RequestState.InactiveWithError && (
          <div className="module-AddGroupMembersModal__error-message">
            {i18n('icu:updateGroupAttributes__error-message')}
          </div>
        )}
        <div className="module-AddGroupMembersModal__button-container">
          <Button onClick={onClose} variant={ButtonVariant.Secondary}>
            {i18n('icu:cancel')}
          </Button>

          <Button
            disabled={requestState === RequestState.Active}
            onClick={makeRequest}
            variant={ButtonVariant.Primary}
          >
            {buttonContents}
          </Button>
        </div>
      </div>
    </ModalHost>
  );
}
