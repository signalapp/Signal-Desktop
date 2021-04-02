// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useMemo, CSSProperties } from 'react';
import Measure, { MeasuredComponentProps } from 'react-measure';
import { isNumber } from 'lodash';

import {
  LeftPaneHelper,
  FindDirection,
  ToFindType,
} from './leftPane/LeftPaneHelper';
import {
  LeftPaneInboxHelper,
  LeftPaneInboxPropsType,
} from './leftPane/LeftPaneInboxHelper';
import {
  LeftPaneSearchHelper,
  LeftPaneSearchPropsType,
} from './leftPane/LeftPaneSearchHelper';
import {
  LeftPaneArchiveHelper,
  LeftPaneArchivePropsType,
} from './leftPane/LeftPaneArchiveHelper';
import {
  LeftPaneComposeHelper,
  LeftPaneComposePropsType,
} from './leftPane/LeftPaneComposeHelper';
import {
  LeftPaneChooseGroupMembersHelper,
  LeftPaneChooseGroupMembersPropsType,
} from './leftPane/LeftPaneChooseGroupMembersHelper';
import {
  LeftPaneSetGroupMetadataHelper,
  LeftPaneSetGroupMetadataPropsType,
} from './leftPane/LeftPaneSetGroupMetadataHelper';

import * as OS from '../OS';
import { LocalizerType, ScrollBehavior } from '../types/Util';
import { usePrevious } from '../util/hooks';
import { missingCaseError } from '../util/missingCaseError';

import { ConversationList } from './ConversationList';
import { ContactCheckboxDisabledReason } from './conversationList/ContactCheckbox';

export enum LeftPaneMode {
  Inbox,
  Search,
  Archive,
  Compose,
  ChooseGroupMembers,
  SetGroupMetadata,
}

export type PropsType = {
  // These help prevent invalid states. For example, we don't need the list of pinned
  //   conversations if we're trying to start a new conversation. Ideally these would be
  //   at the top level, but this is not supported by react-redux + TypeScript.
  modeSpecificProps:
    | ({
        mode: LeftPaneMode.Inbox;
      } & LeftPaneInboxPropsType)
    | ({
        mode: LeftPaneMode.Search;
      } & LeftPaneSearchPropsType)
    | ({
        mode: LeftPaneMode.Archive;
      } & LeftPaneArchivePropsType)
    | ({
        mode: LeftPaneMode.Compose;
      } & LeftPaneComposePropsType)
    | ({
        mode: LeftPaneMode.ChooseGroupMembers;
      } & LeftPaneChooseGroupMembersPropsType)
    | ({
        mode: LeftPaneMode.SetGroupMetadata;
      } & LeftPaneSetGroupMetadataPropsType);
  i18n: LocalizerType;
  selectedConversationId: undefined | string;
  selectedMessageId: undefined | string;
  regionCode: string;

  // Action Creators
  cantAddContactToGroup: (conversationId: string) => void;
  clearGroupCreationError: () => void;
  closeCantAddContactToGroupModal: () => void;
  closeMaximumGroupSizeModal: () => void;
  closeRecommendedGroupSizeModal: () => void;
  createGroup: () => void;
  startNewConversationFromPhoneNumber: (e164: string) => void;
  openConversationInternal: (_: {
    conversationId: string;
    messageId?: string;
    switchToAssociatedView?: boolean;
  }) => void;
  setComposeSearchTerm: (composeSearchTerm: string) => void;
  setComposeGroupAvatar: (_: undefined | ArrayBuffer) => void;
  setComposeGroupName: (_: string) => void;
  showArchivedConversations: () => void;
  showInbox: () => void;
  startComposing: () => void;
  showChooseGroupMembers: () => void;
  startSettingGroupMetadata: () => void;
  toggleConversationInChooseMembers: (conversationId: string) => void;

  // Render Props
  renderExpiredBuildDialog: () => JSX.Element;
  renderMainHeader: () => JSX.Element;
  renderMessageSearchResult: (id: string, style: CSSProperties) => JSX.Element;
  renderNetworkStatus: () => JSX.Element;
  renderRelinkDialog: () => JSX.Element;
  renderUpdateDialog: () => JSX.Element;
};

export const LeftPane: React.FC<PropsType> = ({
  cantAddContactToGroup,
  clearGroupCreationError,
  closeCantAddContactToGroupModal,
  closeMaximumGroupSizeModal,
  closeRecommendedGroupSizeModal,
  createGroup,
  i18n,
  modeSpecificProps,
  openConversationInternal,
  renderExpiredBuildDialog,
  renderMainHeader,
  renderMessageSearchResult,
  renderNetworkStatus,
  renderRelinkDialog,
  renderUpdateDialog,
  selectedConversationId,
  selectedMessageId,
  setComposeSearchTerm,
  setComposeGroupAvatar,
  setComposeGroupName,
  showArchivedConversations,
  showInbox,
  startComposing,
  showChooseGroupMembers,
  startNewConversationFromPhoneNumber,
  startSettingGroupMetadata,
  toggleConversationInChooseMembers,
}) => {
  const previousModeSpecificProps = usePrevious(
    modeSpecificProps,
    modeSpecificProps
  );

  // The left pane can be in various modes: the inbox, the archive, the composer, etc.
  //   Ideally, this would render subcomponents such as `<LeftPaneInbox>` or
  //   `<LeftPaneArchive>` (and if there's a way to do that cleanly, we should refactor
  //   this).
  //
  // But doing that presents two problems:
  //
  // 1. Different components render the same logical inputs (the main header's search),
  //    but React doesn't know that they're the same, so you can lose focus as you change
  //    modes.
  // 2. These components render virtualized lists, which are somewhat slow to initialize.
  //    Switching between modes can cause noticable hiccups.
  //
  // To get around those problems, we use "helpers" which all correspond to the same
  //   interface.
  //
  // Unfortunately, there's a little bit of repetition here because TypeScript isn't quite
  //   smart enough.
  let helper: LeftPaneHelper<unknown>;
  let shouldRecomputeRowHeights: boolean;
  switch (modeSpecificProps.mode) {
    case LeftPaneMode.Inbox: {
      const inboxHelper = new LeftPaneInboxHelper(modeSpecificProps);
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? inboxHelper.shouldRecomputeRowHeights(previousModeSpecificProps)
          : true;
      helper = inboxHelper;
      break;
    }
    case LeftPaneMode.Search: {
      const searchHelper = new LeftPaneSearchHelper(modeSpecificProps);
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? searchHelper.shouldRecomputeRowHeights(previousModeSpecificProps)
          : true;
      helper = searchHelper;
      break;
    }
    case LeftPaneMode.Archive: {
      const archiveHelper = new LeftPaneArchiveHelper(modeSpecificProps);
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? archiveHelper.shouldRecomputeRowHeights(previousModeSpecificProps)
          : true;
      helper = archiveHelper;
      break;
    }
    case LeftPaneMode.Compose: {
      const composeHelper = new LeftPaneComposeHelper(modeSpecificProps);
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? composeHelper.shouldRecomputeRowHeights(previousModeSpecificProps)
          : true;
      helper = composeHelper;
      break;
    }
    case LeftPaneMode.ChooseGroupMembers: {
      const chooseGroupMembersHelper = new LeftPaneChooseGroupMembersHelper(
        modeSpecificProps
      );
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? chooseGroupMembersHelper.shouldRecomputeRowHeights(
              previousModeSpecificProps
            )
          : true;
      helper = chooseGroupMembersHelper;
      break;
    }
    case LeftPaneMode.SetGroupMetadata: {
      const setGroupMetadataHelper = new LeftPaneSetGroupMetadataHelper(
        modeSpecificProps
      );
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? setGroupMetadataHelper.shouldRecomputeRowHeights(
              previousModeSpecificProps
            )
          : true;
      helper = setGroupMetadataHelper;
      break;
    }
    default:
      throw missingCaseError(modeSpecificProps);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { ctrlKey, shiftKey, altKey, metaKey, key } = event;
      const commandOrCtrl = OS.isMacOS() ? metaKey : ctrlKey;

      if (
        commandOrCtrl &&
        !shiftKey &&
        !altKey &&
        (key === 'n' || key === 'N')
      ) {
        startComposing();

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      let conversationToOpen:
        | undefined
        | {
            conversationId: string;
            messageId?: string;
          };

      const numericIndex = keyboardKeyToNumericIndex(event.key);
      if (commandOrCtrl && isNumber(numericIndex)) {
        conversationToOpen = helper.getConversationAndMessageAtIndex(
          numericIndex
        );
      } else {
        let toFind: undefined | ToFindType;
        if (
          (altKey && !shiftKey && key === 'ArrowUp') ||
          (commandOrCtrl && shiftKey && key === '[') ||
          (ctrlKey && shiftKey && key === 'Tab')
        ) {
          toFind = { direction: FindDirection.Up, unreadOnly: false };
        } else if (
          (altKey && !shiftKey && key === 'ArrowDown') ||
          (commandOrCtrl && shiftKey && key === ']') ||
          (ctrlKey && key === 'Tab')
        ) {
          toFind = { direction: FindDirection.Down, unreadOnly: false };
        } else if (altKey && shiftKey && key === 'ArrowUp') {
          toFind = { direction: FindDirection.Up, unreadOnly: true };
        } else if (altKey && shiftKey && key === 'ArrowDown') {
          toFind = { direction: FindDirection.Down, unreadOnly: true };
        }
        if (toFind) {
          conversationToOpen = helper.getConversationAndMessageInDirection(
            toFind,
            selectedConversationId,
            selectedMessageId
          );
        }
      }

      if (conversationToOpen) {
        const { conversationId, messageId } = conversationToOpen;
        openConversationInternal({ conversationId, messageId });
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [
    helper,
    openConversationInternal,
    selectedConversationId,
    selectedMessageId,
    startComposing,
  ]);

  const preRowsNode = helper.getPreRowsNode({
    clearGroupCreationError,
    closeCantAddContactToGroupModal,
    closeMaximumGroupSizeModal,
    closeRecommendedGroupSizeModal,
    createGroup,
    i18n,
    setComposeGroupAvatar,
    setComposeGroupName,
    onChangeComposeSearchTerm: event => {
      setComposeSearchTerm(event.target.value);
    },
    removeSelectedContact: toggleConversationInChooseMembers,
  });
  const footerContents = helper.getFooterContents({
    createGroup,
    i18n,
    startSettingGroupMetadata,
  });

  const getRow = useMemo(() => helper.getRow.bind(helper), [helper]);

  const previousSelectedConversationId = usePrevious(
    selectedConversationId,
    selectedConversationId
  );

  const isScrollable = helper.isScrollable();

  let rowIndexToScrollTo: undefined | number;
  let scrollBehavior: ScrollBehavior;
  if (isScrollable) {
    rowIndexToScrollTo =
      previousSelectedConversationId === selectedConversationId
        ? undefined
        : helper.getRowIndexToScrollTo(selectedConversationId);
    scrollBehavior = ScrollBehavior.Default;
  } else {
    rowIndexToScrollTo = 0;
    scrollBehavior = ScrollBehavior.Hard;
  }

  // We ensure that the listKey differs between some modes (e.g. inbox/archived), ensuring
  //   that AutoSizer properly detects the new size of its slot in the flexbox. The
  //   archive explainer text at the top of the archive view causes problems otherwise.
  //   It also ensures that we scroll to the top when switching views.
  const listKey = preRowsNode ? 1 : 0;

  // We disable this lint rule because we're trying to capture bubbled events. See [the
  //   lint rule's docs][0].
  //
  // [0]: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/645900a0e296ca7053dbf6cd9e12cc85849de2d5/docs/rules/no-static-element-interactions.md#case-the-event-handler-is-only-being-used-to-capture-bubbled-events
  /* eslint-disable jsx-a11y/no-static-element-interactions */
  return (
    <div
      className="module-left-pane"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          const backAction = helper.getBackAction({
            showInbox,
            startComposing,
            showChooseGroupMembers,
          });
          if (backAction) {
            event.preventDefault();
            event.stopPropagation();
            backAction();
          }
        }
      }}
    >
      {/* eslint-enable jsx-a11y/no-static-element-interactions */}
      <div className="module-left-pane__header">
        {helper.getHeaderContents({
          i18n,
          showInbox,
          startComposing,
          showChooseGroupMembers,
        }) || renderMainHeader()}
      </div>
      {renderExpiredBuildDialog()}
      {renderRelinkDialog()}
      {helper.shouldRenderNetworkStatusAndUpdateDialog() && (
        <>
          {renderNetworkStatus()}
          {renderUpdateDialog()}
        </>
      )}
      {preRowsNode && <React.Fragment key={0}>{preRowsNode}</React.Fragment>}
      <Measure bounds>
        {({ contentRect, measureRef }: MeasuredComponentProps) => (
          <div className="module-left-pane__list--measure" ref={measureRef}>
            <div className="module-left-pane__list--wrapper">
              <div
                aria-live="polite"
                className="module-left-pane__list"
                key={listKey}
                role="presentation"
                tabIndex={-1}
              >
                <ConversationList
                  dimensions={contentRect.bounds}
                  getRow={getRow}
                  i18n={i18n}
                  onClickArchiveButton={showArchivedConversations}
                  onClickContactCheckbox={(
                    conversationId: string,
                    disabledReason: undefined | ContactCheckboxDisabledReason
                  ) => {
                    switch (disabledReason) {
                      case undefined:
                        toggleConversationInChooseMembers(conversationId);
                        break;
                      case ContactCheckboxDisabledReason.AlreadyAdded:
                      case ContactCheckboxDisabledReason.MaximumContactsSelected:
                        // These are no-ops.
                        break;
                      case ContactCheckboxDisabledReason.NotCapable:
                        cantAddContactToGroup(conversationId);
                        break;
                      default:
                        throw missingCaseError(disabledReason);
                    }
                  }}
                  onSelectConversation={(
                    conversationId: string,
                    messageId?: string
                  ) => {
                    openConversationInternal({
                      conversationId,
                      messageId,
                      switchToAssociatedView: true,
                    });
                  }}
                  renderMessageSearchResult={renderMessageSearchResult}
                  rowCount={helper.getRowCount()}
                  scrollBehavior={scrollBehavior}
                  scrollToRowIndex={rowIndexToScrollTo}
                  scrollable={isScrollable}
                  shouldRecomputeRowHeights={shouldRecomputeRowHeights}
                  showChooseGroupMembers={showChooseGroupMembers}
                  startNewConversationFromPhoneNumber={
                    startNewConversationFromPhoneNumber
                  }
                />
              </div>
            </div>
          </div>
        )}
      </Measure>
      {footerContents && (
        <div className="module-left-pane__footer">{footerContents}</div>
      )}
    </div>
  );
};

function keyboardKeyToNumericIndex(key: string): undefined | number {
  if (key.length !== 1) {
    return undefined;
  }
  const result = parseInt(key, 10) - 1;
  const isValidIndex = Number.isInteger(result) && result >= 0 && result <= 8;
  return isValidIndex ? result : undefined;
}
