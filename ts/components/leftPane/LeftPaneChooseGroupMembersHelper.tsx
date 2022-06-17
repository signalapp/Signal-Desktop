// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, ChangeEvent } from 'react';
import React from 'react';

import { LeftPaneHelper } from './LeftPaneHelper';
import type { Row } from '../ConversationList';
import { RowType } from '../ConversationList';
import type { ConversationType } from '../../state/ducks/conversations';
import { ContactCheckboxDisabledReason } from '../conversationList/ContactCheckbox';
import { ContactPills } from '../ContactPills';
import { ContactPill } from '../ContactPill';
import { SearchInput } from '../SearchInput';
import {
  AddGroupMemberErrorDialog,
  AddGroupMemberErrorDialogMode,
} from '../AddGroupMemberErrorDialog';
import { Button } from '../Button';
import type { LocalizerType } from '../../types/Util';
import { getUsernameFromSearch } from '../../types/Username';
import type { ParsedE164Type } from '../../util/libphonenumberInstance';
import { parseAndFormatPhoneNumber } from '../../util/libphonenumberInstance';
import type { UUIDFetchStateType } from '../../util/uuidFetchState';
import {
  isFetchingByUsername,
  isFetchingByE164,
} from '../../util/uuidFetchState';
import {
  getGroupSizeRecommendedLimit,
  getGroupSizeHardLimit,
} from '../../groups/limits';

export type LeftPaneChooseGroupMembersPropsType = {
  uuidFetchState: UUIDFetchStateType;
  candidateContacts: ReadonlyArray<ConversationType>;
  isShowingRecommendedGroupSizeModal: boolean;
  isShowingMaximumGroupSizeModal: boolean;
  isUsernamesEnabled: boolean;
  searchTerm: string;
  regionCode: string | undefined;
  selectedContacts: Array<ConversationType>;
};

export class LeftPaneChooseGroupMembersHelper extends LeftPaneHelper<LeftPaneChooseGroupMembersPropsType> {
  private readonly candidateContacts: ReadonlyArray<ConversationType>;

  private readonly isPhoneNumberChecked: boolean;

  private readonly isUsernameChecked: boolean;

  private readonly isShowingMaximumGroupSizeModal: boolean;

  private readonly isShowingRecommendedGroupSizeModal: boolean;

  private readonly searchTerm: string;

  private readonly phoneNumber: ParsedE164Type | undefined;

  private readonly username: string | undefined;

  private readonly selectedContacts: Array<ConversationType>;

  private readonly selectedConversationIdsSet: Set<string>;

  private readonly uuidFetchState: UUIDFetchStateType;

  constructor({
    candidateContacts,
    isShowingMaximumGroupSizeModal,
    isShowingRecommendedGroupSizeModal,
    isUsernamesEnabled,
    searchTerm,
    regionCode,
    selectedContacts,
    uuidFetchState,
  }: Readonly<LeftPaneChooseGroupMembersPropsType>) {
    super();

    this.uuidFetchState = uuidFetchState;

    this.candidateContacts = candidateContacts;
    this.isShowingMaximumGroupSizeModal = isShowingMaximumGroupSizeModal;
    this.isShowingRecommendedGroupSizeModal =
      isShowingRecommendedGroupSizeModal;
    this.searchTerm = searchTerm;

    const phoneNumber = parseAndFormatPhoneNumber(searchTerm, regionCode);
    if (phoneNumber) {
      this.isPhoneNumberChecked =
        phoneNumber.isValid &&
        selectedContacts.some(contact => contact.e164 === phoneNumber.e164);

      const isVisible = this.candidateContacts.every(
        contact => contact.e164 !== phoneNumber.e164
      );
      if (isVisible) {
        this.phoneNumber = phoneNumber;
      }
    } else {
      this.isPhoneNumberChecked = false;
    }
    if (!this.phoneNumber && isUsernamesEnabled) {
      const username = getUsernameFromSearch(searchTerm);
      const isVisible = this.candidateContacts.every(
        contact => contact.username !== username
      );

      if (isVisible) {
        this.username = username;
      }

      this.isUsernameChecked = selectedContacts.some(
        contact => contact.username === this.username
      );
    } else {
      this.isUsernameChecked = false;
    }
    this.selectedContacts = selectedContacts;

    this.selectedConversationIdsSet = new Set(
      selectedContacts.map(contact => contact.id)
    );
  }

  override getHeaderContents({
    i18n,
    startComposing,
  }: Readonly<{
    i18n: LocalizerType;
    startComposing: () => void;
  }>): ReactChild {
    const backButtonLabel = i18n('chooseGroupMembers__back-button');

    return (
      <div className="module-left-pane__header__contents">
        <button
          aria-label={backButtonLabel}
          className="module-left-pane__header__contents__back-button"
          onClick={this.getBackAction({ startComposing })}
          title={backButtonLabel}
          type="button"
        />
        <div className="module-left-pane__header__contents__text">
          {i18n('chooseGroupMembers__title')}
        </div>
      </div>
    );
  }

  override getBackAction({
    startComposing,
  }: {
    startComposing: () => void;
  }): () => void {
    return startComposing;
  }

  override getSearchInput({
    i18n,
    onChangeComposeSearchTerm,
  }: Readonly<{
    i18n: LocalizerType;
    onChangeComposeSearchTerm: (
      event: ChangeEvent<HTMLInputElement>
    ) => unknown;
  }>): ReactChild {
    return (
      <SearchInput
        i18n={i18n}
        moduleClassName="module-left-pane__compose-search-form"
        onChange={onChangeComposeSearchTerm}
        placeholder={i18n('contactSearchPlaceholder')}
        ref={focusRef}
        value={this.searchTerm}
      />
    );
  }

  override getPreRowsNode({
    closeMaximumGroupSizeModal,
    closeRecommendedGroupSizeModal,
    i18n,
    removeSelectedContact,
  }: Readonly<{
    closeMaximumGroupSizeModal: () => unknown;
    closeRecommendedGroupSizeModal: () => unknown;
    i18n: LocalizerType;
    removeSelectedContact: (conversationId: string) => unknown;
  }>): ReactChild {
    let modalNode: undefined | ReactChild;
    if (this.isShowingMaximumGroupSizeModal) {
      modalNode = (
        <AddGroupMemberErrorDialog
          i18n={i18n}
          maximumNumberOfContacts={this.getMaximumNumberOfContacts()}
          mode={AddGroupMemberErrorDialogMode.MaximumGroupSize}
          onClose={closeMaximumGroupSizeModal}
        />
      );
    } else if (this.isShowingRecommendedGroupSizeModal) {
      modalNode = (
        <AddGroupMemberErrorDialog
          i18n={i18n}
          recommendedMaximumNumberOfContacts={this.getRecommendedMaximumNumberOfContacts()}
          mode={AddGroupMemberErrorDialogMode.RecommendedMaximumGroupSize}
          onClose={closeRecommendedGroupSizeModal}
        />
      );
    }

    return (
      <>
        {Boolean(this.selectedContacts.length) && (
          <ContactPills>
            {this.selectedContacts.map(contact => (
              <ContactPill
                key={contact.id}
                acceptedMessageRequest={contact.acceptedMessageRequest}
                avatarPath={contact.avatarPath}
                color={contact.color}
                firstName={contact.firstName}
                i18n={i18n}
                id={contact.id}
                isMe={contact.isMe}
                name={contact.name}
                phoneNumber={contact.phoneNumber}
                profileName={contact.profileName}
                sharedGroupNames={contact.sharedGroupNames}
                title={contact.title}
                onClickRemove={removeSelectedContact}
              />
            ))}
          </ContactPills>
        )}

        {this.getRowCount() ? null : (
          <div className="module-left-pane__compose-no-contacts">
            {i18n('noContactsFound')}
          </div>
        )}

        {modalNode}
      </>
    );
  }

  override getFooterContents({
    i18n,
    startSettingGroupMetadata,
  }: Readonly<{
    i18n: LocalizerType;
    startSettingGroupMetadata: () => void;
  }>): ReactChild {
    return (
      <Button
        disabled={this.hasExceededMaximumNumberOfContacts()}
        onClick={startSettingGroupMetadata}
      >
        {this.selectedContacts.length
          ? i18n('chooseGroupMembers__next')
          : i18n('chooseGroupMembers__skip')}
      </Button>
    );
  }

  getRowCount(): number {
    let rowCount = 0;

    // Header + Phone Number
    if (this.phoneNumber) {
      rowCount += 2;
    }

    // Header + Username
    if (this.username) {
      rowCount += 2;
    }

    // Header + Contacts
    if (this.candidateContacts.length) {
      rowCount += 1 + this.candidateContacts.length;
    }

    // Footer
    if (rowCount > 0) {
      rowCount += 1;
    }

    return rowCount;
  }

  getRow(actualRowIndex: number): undefined | Row {
    if (!this.candidateContacts.length && !this.phoneNumber && !this.username) {
      return undefined;
    }

    const rowCount = this.getRowCount();

    // This puts a blank row for the footer.
    if (actualRowIndex === rowCount - 1) {
      return { type: RowType.Blank };
    }

    let virtualRowIndex = actualRowIndex;

    if (this.candidateContacts.length) {
      if (virtualRowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'contactsHeader',
        };
      }

      if (virtualRowIndex <= this.candidateContacts.length) {
        const contact = this.candidateContacts[virtualRowIndex - 1];

        const isChecked = this.selectedConversationIdsSet.has(contact.id);
        const disabledReason =
          !isChecked && this.hasSelectedMaximumNumberOfContacts()
            ? ContactCheckboxDisabledReason.MaximumContactsSelected
            : undefined;

        return {
          type: RowType.ContactCheckbox,
          contact,
          isChecked,
          disabledReason,
        };
      }

      virtualRowIndex -= 1 + this.candidateContacts.length;
    }

    if (this.phoneNumber) {
      if (virtualRowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'findByPhoneNumberHeader',
        };
      }
      if (virtualRowIndex === 1) {
        return {
          type: RowType.PhoneNumberCheckbox,
          isChecked: this.isPhoneNumberChecked,
          isFetching: isFetchingByE164(
            this.uuidFetchState,
            this.phoneNumber.e164
          ),
          phoneNumber: this.phoneNumber,
        };
      }
      virtualRowIndex -= 2;
    }

    if (this.username) {
      if (virtualRowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'findByUsernameHeader',
        };
      }
      if (virtualRowIndex === 1) {
        return {
          type: RowType.UsernameCheckbox,
          isChecked: this.isUsernameChecked,
          isFetching: isFetchingByUsername(this.uuidFetchState, this.username),
          username: this.username,
        };
      }
      virtualRowIndex -= 2;
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

  shouldRecomputeRowHeights(_old: unknown): boolean {
    return false;
  }

  private hasSelectedMaximumNumberOfContacts(): boolean {
    return this.selectedContacts.length >= this.getMaximumNumberOfContacts();
  }

  private hasExceededMaximumNumberOfContacts(): boolean {
    // It should be impossible to reach this state. This is here as a failsafe.
    return this.selectedContacts.length > this.getMaximumNumberOfContacts();
  }

  private getRecommendedMaximumNumberOfContacts(): number {
    return getGroupSizeRecommendedLimit(151) - 1;
  }

  private getMaximumNumberOfContacts(): number {
    return getGroupSizeHardLimit(1001) - 1;
  }
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}
