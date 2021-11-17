// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, ChangeEvent } from 'react';
import React from 'react';
import type { PhoneNumber } from 'google-libphonenumber';

import { LeftPaneHelper } from './LeftPaneHelper';
import type { Row } from '../ConversationList';
import { RowType } from '../ConversationList';
import type { ContactListItemConversationType } from '../conversationList/ContactListItem';
import type { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem';
import { SearchInput } from '../SearchInput';
import type { LocalizerType } from '../../types/Util';
import {
  instance as phoneNumberInstance,
  PhoneNumberFormat,
} from '../../util/libphonenumberInstance';
import { assert } from '../../util/assert';
import { missingCaseError } from '../../util/missingCaseError';
import { getUsernameFromSearch } from '../../types/Username';

export type LeftPaneComposePropsType = {
  composeContacts: ReadonlyArray<ContactListItemConversationType>;
  composeGroups: ReadonlyArray<ConversationListItemPropsType>;

  regionCode: string;
  searchTerm: string;
  isFetchingUsername: boolean;
  isUsernamesEnabled: boolean;
};

enum TopButton {
  None,
  CreateNewGroup,
  StartNewConversation,
}

export class LeftPaneComposeHelper extends LeftPaneHelper<LeftPaneComposePropsType> {
  private readonly composeContacts: ReadonlyArray<ContactListItemConversationType>;

  private readonly composeGroups: ReadonlyArray<ConversationListItemPropsType>;

  private readonly isFetchingUsername: boolean;

  private readonly isUsernamesEnabled: boolean;

  private readonly searchTerm: string;

  private readonly phoneNumber: undefined | PhoneNumber;

  constructor({
    composeContacts,
    composeGroups,
    regionCode,
    searchTerm,
    isUsernamesEnabled,
    isFetchingUsername,
  }: Readonly<LeftPaneComposePropsType>) {
    super();

    this.composeContacts = composeContacts;
    this.composeGroups = composeGroups;
    this.searchTerm = searchTerm;
    this.phoneNumber = parsePhoneNumber(searchTerm, regionCode);
    this.isFetchingUsername = isFetchingUsername;
    this.isUsernamesEnabled = isUsernamesEnabled;
  }

  override getHeaderContents({
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

  override getBackAction({ showInbox }: { showInbox: () => void }): () => void {
    return showInbox;
  }

  override getPreRowsNode({
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
        <SearchInput
          moduleClassName="module-left-pane__compose-search-form"
          onChange={onChangeComposeSearchTerm}
          placeholder={i18n('contactSearchPlaceholder')}
          ref={focusRef}
          value={this.searchTerm}
        />

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
    if (this.getUsernameFromSearch()) {
      result += 2;
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
      if (group) {
        return {
          type: RowType.Conversation,
          conversation: group,
        };
      }

      virtualRowIndex -= this.composeGroups.length;
    }

    const username = this.getUsernameFromSearch();
    if (username) {
      if (virtualRowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'findByUsernameHeader',
        };
      }

      virtualRowIndex -= 1;

      if (virtualRowIndex === 0) {
        return {
          type: RowType.UsernameSearchResult,
          username,
          isFetchingUsername: this.isFetchingUsername,
        };

        virtualRowIndex -= 1;
      }
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
      currHeaderIndices.group !== prevHeaderIndices.group ||
      currHeaderIndices.username !== prevHeaderIndices.username
    );
  }

  private getTopButton(): TopButton {
    if (this.phoneNumber) {
      return TopButton.StartNewConversation;
    }
    if (this.searchTerm) {
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

  private getUsernameFromSearch(): string | undefined {
    if (!this.isUsernamesEnabled) {
      return undefined;
    }

    if (this.phoneNumber) {
      return undefined;
    }

    if (this.searchTerm) {
      return getUsernameFromSearch(this.searchTerm);
    }

    return undefined;
  }

  private getHeaderIndices(): {
    top?: number;
    contact?: number;
    group?: number;
    username?: number;
  } {
    let top: number | undefined;
    let contact: number | undefined;
    let group: number | undefined;
    let username: number | undefined;

    let rowCount = 0;

    if (this.hasTopButton()) {
      top = 0;
      rowCount += 1;
    }
    if (this.hasContactsHeader()) {
      contact = rowCount;
      rowCount += this.composeContacts.length;
    }
    if (this.hasGroupsHeader()) {
      group = rowCount;
      rowCount += this.composeContacts.length;
    }
    if (this.getUsernameFromSearch()) {
      username = rowCount;
    }

    return {
      top,
      contact,
      group,
      username,
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
