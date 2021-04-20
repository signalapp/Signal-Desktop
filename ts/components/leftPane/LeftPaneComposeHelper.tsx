// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactChild, ChangeEvent } from 'react';
import { PhoneNumber } from 'google-libphonenumber';

import { LeftPaneHelper } from './LeftPaneHelper';
import { Row, RowType } from '../ConversationList';
import { PropsDataType as ContactListItemPropsType } from '../conversationList/ContactListItem';
import { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem';
import { LocalizerType } from '../../types/Util';
import {
  instance as phoneNumberInstance,
  PhoneNumberFormat,
} from '../../util/libphonenumberInstance';
import { assert } from '../../util/assert';
import { missingCaseError } from '../../util/missingCaseError';
import { isStorageWriteFeatureEnabled } from '../../storage/isFeatureEnabled';

export type LeftPaneComposePropsType = {
  composeContacts: ReadonlyArray<ContactListItemPropsType>;
  composeGroups: ReadonlyArray<ContactListItemPropsType>;
  regionCode: string;
  searchTerm: string;
};

enum TopButton {
  None,
  CreateNewGroup,
  StartNewConversation,
}

/* eslint-disable class-methods-use-this */

export class LeftPaneComposeHelper extends LeftPaneHelper<
  LeftPaneComposePropsType
> {
  private readonly composeContacts: ReadonlyArray<ContactListItemPropsType>;

  private readonly composeGroups: ReadonlyArray<ConversationListItemPropsType>;

  private readonly searchTerm: string;

  private readonly phoneNumber: undefined | PhoneNumber;

  constructor({
    composeContacts,
    composeGroups,
    regionCode,
    searchTerm,
  }: Readonly<LeftPaneComposePropsType>) {
    super();

    this.searchTerm = searchTerm;
    this.phoneNumber = parsePhoneNumber(searchTerm, regionCode);
    this.composeGroups = composeGroups;
    this.composeContacts = composeContacts;
  }

  getHeaderContents({
    i18n,
    showInbox,
  }: Readonly<{
    i18n: LocalizerType;
    showInbox: () => void;
  }>): ReactChild {
    return (
      <div className="module-left-pane__header__contents">
        <button
          onClick={this.getBackAction({ showInbox })}
          className="module-left-pane__header__contents__back-button"
          title={i18n('backToInbox')}
          aria-label={i18n('backToInbox')}
          type="button"
        />
        <div className="module-left-pane__header__contents__text">
          {i18n('newConversation')}
        </div>
      </div>
    );
  }

  getBackAction({ showInbox }: { showInbox: () => void }): () => void {
    return showInbox;
  }

  getPreRowsNode({
    i18n,
    onChangeComposeSearchTerm,
  }: Readonly<{
    i18n: LocalizerType;
    onChangeComposeSearchTerm: (
      event: ChangeEvent<HTMLInputElement>
    ) => unknown;
  }>): ReactChild {
    return (
      <>
        <div className="module-left-pane__compose-search-form">
          <input
            type="text"
            ref={focusRef}
            className="module-left-pane__compose-search-form__input"
            placeholder={i18n('contactSearchPlaceholder')}
            dir="auto"
            value={this.searchTerm}
            onChange={onChangeComposeSearchTerm}
          />
        </div>

        {this.getRowCount() ? null : (
          <div className="module-left-pane__compose-no-contacts">
            {i18n('noConversationsFound')}
          </div>
        )}
      </>
    );
  }

  getRowCount(): number {
    let result = this.composeContacts.length + this.composeGroups.length;
    if (this.hasTopButton()) {
      result += 1;
    }
    if (this.hasContactsHeader()) {
      result += 1;
    }
    if (this.hasGroupsHeader()) {
      result += 1;
    }

    return result;
  }

  getRow(actualRowIndex: number): undefined | Row {
    let virtualRowIndex = actualRowIndex;
    if (this.hasTopButton()) {
      if (virtualRowIndex === 0) {
        const topButton = this.getTopButton();
        switch (topButton) {
          case TopButton.None:
            break;
          case TopButton.StartNewConversation:
            assert(
              this.phoneNumber,
              'LeftPaneComposeHelper: we should have a phone number if the top button is "Start new conversation"'
            );
            return {
              type: RowType.StartNewConversation,
              phoneNumber: phoneNumberInstance.format(
                this.phoneNumber,
                PhoneNumberFormat.E164
              ),
            };
          case TopButton.CreateNewGroup:
            return { type: RowType.CreateNewGroup };
          default:
            throw missingCaseError(topButton);
        }
      }

      virtualRowIndex -= 1;
    }

    if (this.hasContactsHeader()) {
      if (virtualRowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'contactsHeader',
        };
      }

      virtualRowIndex -= 1;

      const contact = this.composeContacts[virtualRowIndex];
      if (contact) {
        return {
          type: RowType.Contact,
          contact,
        };
      }

      virtualRowIndex -= this.composeContacts.length;
    }

    if (this.hasGroupsHeader()) {
      if (virtualRowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'groupsHeader',
        };
      }

      virtualRowIndex -= 1;

      const group = this.composeGroups[virtualRowIndex];
      return {
        type: RowType.Conversation,
        conversation: group,
      };
    }

    return undefined;
  }

  // This is deliberately unimplemented because these keyboard shortcuts shouldn't work in
  //   the composer. The same is true for the "in direction" function below.
  getConversationAndMessageAtIndex(
    ..._args: ReadonlyArray<unknown>
  ): undefined {
    return undefined;
  }

  getConversationAndMessageInDirection(
    ..._args: ReadonlyArray<unknown>
  ): undefined {
    return undefined;
  }

  shouldRecomputeRowHeights(
    exProps: Readonly<LeftPaneComposePropsType>
  ): boolean {
    const prev = new LeftPaneComposeHelper(exProps);
    const currHeaderIndices = this.getHeaderIndices();
    const prevHeaderIndices = prev.getHeaderIndices();

    return (
      currHeaderIndices.top !== prevHeaderIndices.top ||
      currHeaderIndices.contact !== prevHeaderIndices.contact ||
      currHeaderIndices.group !== prevHeaderIndices.group
    );
  }

  private getTopButton(): TopButton {
    if (this.phoneNumber) {
      return TopButton.StartNewConversation;
    }
    if (this.searchTerm || !isStorageWriteFeatureEnabled()) {
      return TopButton.None;
    }
    return TopButton.CreateNewGroup;
  }

  private hasTopButton(): boolean {
    return this.getTopButton() !== TopButton.None;
  }

  private hasContactsHeader(): boolean {
    return Boolean(this.composeContacts.length);
  }

  private hasGroupsHeader(): boolean {
    return Boolean(this.composeGroups.length);
  }

  private getHeaderIndices(): {
    top?: number;
    contact?: number;
    group?: number;
  } {
    let top: number | undefined;
    let contact: number | undefined;
    let group: number | undefined;
    let rowCount = 0;
    if (this.hasTopButton()) {
      top = 0;
      rowCount += 1;
    }
    if (this.composeContacts.length) {
      contact = rowCount;
      rowCount += this.composeContacts.length;
    }
    if (this.composeGroups.length) {
      group = rowCount;
    }

    return {
      top,
      contact,
      group,
    };
  }
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

function parsePhoneNumber(
  str: string,
  regionCode: string
): undefined | PhoneNumber {
  let result: PhoneNumber;
  try {
    result = phoneNumberInstance.parse(str, regionCode);
  } catch (err) {
    return undefined;
  }

  if (!phoneNumberInstance.isValidNumber(result)) {
    return undefined;
  }

  return result;
}
