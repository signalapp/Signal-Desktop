// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactChild } from 'react';

import { LeftPaneHelper } from './LeftPaneHelper';
import { Row, RowType } from '../ConversationList';
import { PropsDataType as ContactListItemPropsType } from '../conversationList/ContactListItem';
import { LocalizerType } from '../../types/Util';
import { AvatarInput } from '../AvatarInput';
import { Alert } from '../Alert';
import { Spinner } from '../Spinner';
import { Button } from '../Button';
import { GroupTitleInput } from '../GroupTitleInput';

export type LeftPaneSetGroupMetadataPropsType = {
  groupAvatar: undefined | ArrayBuffer;
  groupName: string;
  hasError: boolean;
  isCreating: boolean;
  selectedContacts: ReadonlyArray<ContactListItemPropsType>;
};

/* eslint-disable class-methods-use-this */

export class LeftPaneSetGroupMetadataHelper extends LeftPaneHelper<
  LeftPaneSetGroupMetadataPropsType
> {
  private readonly groupAvatar: undefined | ArrayBuffer;

  private readonly groupName: string;

  private readonly hasError: boolean;

  private readonly isCreating: boolean;

  private readonly selectedContacts: ReadonlyArray<ContactListItemPropsType>;

  constructor({
    groupAvatar,
    groupName,
    isCreating,
    hasError,
    selectedContacts,
  }: Readonly<LeftPaneSetGroupMetadataPropsType>) {
    super();

    this.groupAvatar = groupAvatar;
    this.groupName = groupName;
    this.hasError = hasError;
    this.isCreating = isCreating;
    this.selectedContacts = selectedContacts;
  }

  getHeaderContents({
    i18n,
    showChooseGroupMembers,
  }: Readonly<{
    i18n: LocalizerType;
    showChooseGroupMembers: () => void;
  }>): ReactChild {
    const backButtonLabel = i18n('setGroupMetadata__back-button');

    return (
      <div className="module-left-pane__header__contents">
        <button
          aria-label={backButtonLabel}
          className="module-left-pane__header__contents__back-button"
          disabled={this.isCreating}
          onClick={this.getBackAction({ showChooseGroupMembers })}
          title={backButtonLabel}
          type="button"
        />
        <div className="module-left-pane__header__contents__text">
          {i18n('setGroupMetadata__title')}
        </div>
      </div>
    );
  }

  getBackAction({
    showChooseGroupMembers,
  }: {
    showChooseGroupMembers: () => void;
  }): undefined | (() => void) {
    return this.isCreating ? undefined : showChooseGroupMembers;
  }

  getPreRowsNode({
    clearGroupCreationError,
    createGroup,
    i18n,
    setComposeGroupAvatar,
    setComposeGroupName,
  }: Readonly<{
    clearGroupCreationError: () => unknown;
    createGroup: () => unknown;
    i18n: LocalizerType;
    setComposeGroupAvatar: (_: undefined | ArrayBuffer) => unknown;
    setComposeGroupName: (_: string) => unknown;
  }>): ReactChild {
    const disabled = this.isCreating;

    return (
      <form
        className="module-left-pane__header__form"
        onSubmit={event => {
          event.preventDefault();
          event.stopPropagation();

          if (!this.canCreateGroup()) {
            return;
          }

          createGroup();
        }}
      >
        <AvatarInput
          contextMenuId="left pane group avatar uploader"
          disabled={disabled}
          i18n={i18n}
          onChange={setComposeGroupAvatar}
          value={this.groupAvatar}
        />
        <GroupTitleInput
          disabled={disabled}
          i18n={i18n}
          onChangeValue={setComposeGroupName}
          ref={focusRef}
          value={this.groupName}
        />

        {this.hasError && (
          <Alert
            body={i18n('setGroupMetadata__error-message')}
            i18n={i18n}
            onClose={clearGroupCreationError}
          />
        )}
      </form>
    );
  }

  getFooterContents({
    createGroup,
    i18n,
  }: Readonly<{
    createGroup: () => unknown;
    i18n: LocalizerType;
  }>): ReactChild {
    return (
      <Button disabled={!this.canCreateGroup()} onClick={createGroup}>
        {this.isCreating ? (
          <Spinner size="20px" svgSize="small" direction="on-avatar" />
        ) : (
          i18n('setGroupMetadata__create-group')
        )}
      </Button>
    );
  }

  getRowCount(): number {
    if (!this.selectedContacts.length) {
      return 0;
    }
    return this.selectedContacts.length + 2;
  }

  getRow(rowIndex: number): undefined | Row {
    if (!this.selectedContacts.length) {
      return undefined;
    }

    if (rowIndex === 0) {
      return {
        type: RowType.Header,
        i18nKey: 'setGroupMetadata__members-header',
      };
    }

    // This puts a blank row for the footer.
    if (rowIndex === this.selectedContacts.length + 1) {
      return { type: RowType.Blank };
    }

    const contact = this.selectedContacts[rowIndex - 1];
    return contact
      ? {
          type: RowType.Contact,
          contact,
          isClickable: false,
        }
      : undefined;
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

  private canCreateGroup(): boolean {
    return !this.isCreating && Boolean(this.groupName.trim());
  }
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}
