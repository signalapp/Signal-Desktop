// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import type { MeasuredComponentProps } from 'react-measure';
import Measure from 'react-measure';
import classNames from 'classnames';
import { clamp, isNumber, noop } from 'lodash';

import type { LeftPaneHelper, ToFindType } from './leftPane/LeftPaneHelper';
import { FindDirection } from './leftPane/LeftPaneHelper';
import type { LeftPaneInboxPropsType } from './leftPane/LeftPaneInboxHelper';
import { LeftPaneInboxHelper } from './leftPane/LeftPaneInboxHelper';
import type { LeftPaneSearchPropsType } from './leftPane/LeftPaneSearchHelper';
import { LeftPaneSearchHelper } from './leftPane/LeftPaneSearchHelper';
import type { LeftPaneArchivePropsType } from './leftPane/LeftPaneArchiveHelper';
import { LeftPaneArchiveHelper } from './leftPane/LeftPaneArchiveHelper';
import type { LeftPaneComposePropsType } from './leftPane/LeftPaneComposeHelper';
import { LeftPaneComposeHelper } from './leftPane/LeftPaneComposeHelper';
import type { LeftPaneChooseGroupMembersPropsType } from './leftPane/LeftPaneChooseGroupMembersHelper';
import { LeftPaneChooseGroupMembersHelper } from './leftPane/LeftPaneChooseGroupMembersHelper';
import type { LeftPaneSetGroupMetadataPropsType } from './leftPane/LeftPaneSetGroupMetadataHelper';
import { LeftPaneSetGroupMetadataHelper } from './leftPane/LeftPaneSetGroupMetadataHelper';

import * as OS from '../OS';
import type { LocalizerType, ThemeType } from '../types/Util';
import { ScrollBehavior } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import { usePrevious } from '../hooks/usePrevious';
import { missingCaseError } from '../util/missingCaseError';
import type { WidthBreakpoint } from './_util';
import { getConversationListWidthBreakpoint } from './_util';
import * as KeyboardLayout from '../services/keyboardLayout';
import {
  MIN_WIDTH,
  SNAP_WIDTH,
  MIN_FULL_WIDTH,
  MAX_WIDTH,
  getWidthFromPreferredWidth,
} from '../util/leftPaneWidth';
import type { LookupConversationWithoutUuidActionsType } from '../util/lookupConversationWithoutUuid';
import type { ShowConversationType } from '../state/ducks/conversations';

import { ConversationList } from './ConversationList';
import { ContactCheckboxDisabledReason } from './conversationList/ContactCheckbox';

import type {
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../types/Avatar';

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
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  preferredWidthFromStorage: number;
  selectedConversationId: undefined | string;
  selectedMessageId: undefined | string;
  regionCode: string | undefined;
  challengeStatus: 'idle' | 'required' | 'pending';
  setChallengeStatus: (status: 'idle') => void;
  crashReportCount: number;
  theme: ThemeType;

  // Action Creators
  clearConversationSearch: () => void;
  clearGroupCreationError: () => void;
  clearSearch: () => void;
  closeMaximumGroupSizeModal: () => void;
  closeRecommendedGroupSizeModal: () => void;
  composeDeleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  composeReplaceAvatar: ReplaceAvatarActionType;
  composeSaveAvatarToDisk: SaveAvatarToDiskActionType;
  createGroup: () => void;
  savePreferredLeftPaneWidth: (_: number) => void;
  searchInConversation: (conversationId: string) => unknown;
  setComposeGroupAvatar: (_: undefined | Uint8Array) => void;
  setComposeGroupExpireTimer: (_: number) => void;
  setComposeGroupName: (_: string) => void;
  setComposeSearchTerm: (composeSearchTerm: string) => void;
  showArchivedConversations: () => void;
  showChooseGroupMembers: () => void;
  showConversation: ShowConversationType;
  showInbox: () => void;
  startComposing: () => void;
  startSearch: () => unknown;
  startSettingGroupMetadata: () => void;
  toggleComposeEditingAvatar: () => unknown;
  toggleConversationInChooseMembers: (conversationId: string) => void;
  updateSearchTerm: (_: string) => void;

  // Render Props
  renderExpiredBuildDialog: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderMainHeader: () => JSX.Element;
  renderMessageSearchResult: (id: string) => JSX.Element;
  renderNetworkStatus: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderRelinkDialog: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderUpdateDialog: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderCaptchaDialog: (props: { onSkip(): void }) => JSX.Element;
  renderCrashReportDialog: () => JSX.Element;
} & LookupConversationWithoutUuidActionsType;

export const LeftPane: React.FC<PropsType> = ({
  challengeStatus,
  crashReportCount,
  clearConversationSearch,
  clearGroupCreationError,
  clearSearch,
  closeMaximumGroupSizeModal,
  closeRecommendedGroupSizeModal,
  composeDeleteAvatarFromDisk,
  composeReplaceAvatar,
  composeSaveAvatarToDisk,
  createGroup,
  getPreferredBadge,
  i18n,
  modeSpecificProps,
  preferredWidthFromStorage,
  renderCaptchaDialog,
  renderCrashReportDialog,
  renderExpiredBuildDialog,
  renderMainHeader,
  renderMessageSearchResult,
  renderNetworkStatus,
  renderRelinkDialog,
  renderUpdateDialog,
  savePreferredLeftPaneWidth,
  searchInConversation,
  selectedConversationId,
  selectedMessageId,
  setChallengeStatus,
  setComposeGroupAvatar,
  setComposeGroupExpireTimer,
  setComposeGroupName,
  setComposeSearchTerm,
  showArchivedConversations,
  showChooseGroupMembers,
  showInbox,
  startComposing,
  startSearch,
  showUserNotFoundModal,
  setIsFetchingUUID,
  lookupConversationWithoutUuid,
  toggleConversationInChooseMembers,
  showConversation,
  startSettingGroupMetadata,
  theme,
  toggleComposeEditingAvatar,
  updateSearchTerm,
}) => {
  const [preferredWidth, setPreferredWidth] = useState(
    // This clamp is present just in case we get a bogus value from storage.
    clamp(preferredWidthFromStorage, MIN_WIDTH, MAX_WIDTH)
  );
  const [isResizing, setIsResizing] = useState(false);

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
  //    Switching between modes can cause noticeable hiccups.
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
      const { ctrlKey, shiftKey, altKey, metaKey } = event;
      const commandOrCtrl = OS.isMacOS() ? metaKey : ctrlKey;
      const key = KeyboardLayout.lookup(event);

      if (key === 'Escape') {
        const backAction = helper.getBackAction({
          showInbox,
          startComposing,
          showChooseGroupMembers,
        });
        if (backAction) {
          event.preventDefault();
          event.stopPropagation();
          backAction();
          return;
        }
      }

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
      const openedByNumber = commandOrCtrl && isNumber(numericIndex);
      if (openedByNumber) {
        conversationToOpen =
          helper.getConversationAndMessageAtIndex(numericIndex);
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
        showConversation({ conversationId, messageId });
        if (openedByNumber) {
          clearSearch();
        }
        event.preventDefault();
        event.stopPropagation();
      }

      helper.onKeyDown(event, {
        searchInConversation,
        selectedConversationId,
        startSearch,
      });
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [
    clearSearch,
    helper,
    searchInConversation,
    selectedConversationId,
    selectedMessageId,
    showChooseGroupMembers,
    showConversation,
    showInbox,
    startComposing,
    startSearch,
  ]);

  const requiresFullWidth = helper.requiresFullWidth();

  useEffect(() => {
    if (!isResizing) {
      return noop;
    }

    const onMouseMove = (event: MouseEvent) => {
      let width: number;
      if (requiresFullWidth) {
        width = Math.max(event.clientX, MIN_FULL_WIDTH);
      } else if (event.clientX < SNAP_WIDTH) {
        width = MIN_WIDTH;
      } else {
        width = clamp(event.clientX, MIN_FULL_WIDTH, MAX_WIDTH);
      }
      setPreferredWidth(Math.min(width, MAX_WIDTH));

      event.preventDefault();
    };

    const stopResizing = () => {
      setIsResizing(false);
    };

    document.body.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseup', stopResizing);
    document.body.addEventListener('mouseleave', stopResizing);

    return () => {
      document.body.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('mouseup', stopResizing);
      document.body.removeEventListener('mouseleave', stopResizing);
    };
  }, [isResizing, requiresFullWidth]);

  useEffect(() => {
    if (!isResizing) {
      return noop;
    }

    document.body.classList.add('is-resizing-left-pane');
    return () => {
      document.body.classList.remove('is-resizing-left-pane');
    };
  }, [isResizing]);

  useEffect(() => {
    if (isResizing || preferredWidth === preferredWidthFromStorage) {
      return;
    }

    const timeout = setTimeout(() => {
      savePreferredLeftPaneWidth(preferredWidth);
    }, 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, [
    isResizing,
    preferredWidth,
    preferredWidthFromStorage,
    savePreferredLeftPaneWidth,
  ]);

  const preRowsNode = helper.getPreRowsNode({
    clearConversationSearch,
    clearGroupCreationError,
    clearSearch,
    closeMaximumGroupSizeModal,
    closeRecommendedGroupSizeModal,
    composeDeleteAvatarFromDisk,
    composeReplaceAvatar,
    composeSaveAvatarToDisk,
    createGroup,
    i18n,
    removeSelectedContact: toggleConversationInChooseMembers,
    setComposeGroupAvatar,
    setComposeGroupExpireTimer,
    setComposeGroupName,
    toggleComposeEditingAvatar,
  });
  const footerContents = helper.getFooterContents({
    createGroup,
    i18n,
    startSettingGroupMetadata,
  });

  const getRow = useMemo(() => helper.getRow.bind(helper), [helper]);

  const onSelectConversation = useCallback(
    (conversationId: string, messageId?: string) => {
      showConversation({
        conversationId,
        messageId,
        switchToAssociatedView: true,
      });
    },
    [showConversation]
  );

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

  const width = getWidthFromPreferredWidth(preferredWidth, {
    requiresFullWidth,
  });

  const widthBreakpoint = getConversationListWidthBreakpoint(width);

  return (
    <div
      className={classNames(
        'module-left-pane',
        isResizing && 'module-left-pane--is-resizing',
        `module-left-pane--width-${widthBreakpoint}`
      )}
      style={{ width }}
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
      {helper.getSearchInput({
        clearConversationSearch,
        clearSearch,
        i18n,
        onChangeComposeSearchTerm: event => {
          setComposeSearchTerm(event.target.value);
        },
        updateSearchTerm,
        showConversation,
      })}
      <div className="module-left-pane__dialogs">
        {renderExpiredBuildDialog({
          containerWidthBreakpoint: widthBreakpoint,
        })}
        {renderRelinkDialog({ containerWidthBreakpoint: widthBreakpoint })}
        {renderNetworkStatus({ containerWidthBreakpoint: widthBreakpoint })}
        {renderUpdateDialog({ containerWidthBreakpoint: widthBreakpoint })}
      </div>
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
                  dimensions={{
                    width,
                    height: contentRect.bounds?.height || 0,
                  }}
                  getPreferredBadge={getPreferredBadge}
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
                      default:
                        throw missingCaseError(disabledReason);
                    }
                  }}
                  showUserNotFoundModal={showUserNotFoundModal}
                  setIsFetchingUUID={setIsFetchingUUID}
                  lookupConversationWithoutUuid={lookupConversationWithoutUuid}
                  showConversation={showConversation}
                  onSelectConversation={onSelectConversation}
                  renderMessageSearchResult={renderMessageSearchResult}
                  rowCount={helper.getRowCount()}
                  scrollBehavior={scrollBehavior}
                  scrollToRowIndex={rowIndexToScrollTo}
                  scrollable={isScrollable}
                  shouldRecomputeRowHeights={shouldRecomputeRowHeights}
                  showChooseGroupMembers={showChooseGroupMembers}
                  theme={theme}
                />
              </div>
            </div>
          </div>
        )}
      </Measure>
      {footerContents && (
        <div className="module-left-pane__footer">{footerContents}</div>
      )}
      <>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className="module-left-pane__resize-grab-area"
          onMouseDown={() => {
            setIsResizing(true);
          }}
        />
      </>
      {challengeStatus !== 'idle' &&
        renderCaptchaDialog({
          onSkip() {
            setChallengeStatus('idle');
          },
        })}
      {crashReportCount > 0 && renderCrashReportDialog()}
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
