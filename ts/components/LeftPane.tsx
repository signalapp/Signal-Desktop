// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import classNames from 'classnames';
import { isNumber } from 'lodash';

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

import type { LocalizerType, ThemeType } from '../types/Util';
import { ScrollBehavior } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import { usePrevious } from '../hooks/usePrevious';
import { missingCaseError } from '../util/missingCaseError';
import type { DurationInSeconds } from '../util/durations';
import { WidthBreakpoint, getNavSidebarWidthBreakpoint } from './_util';
import * as KeyboardLayout from '../services/keyboardLayout';
import type { LookupConversationWithoutServiceIdActionsType } from '../util/lookupConversationWithoutServiceId';
import type { ShowConversationType } from '../state/ducks/conversations';
import type { PropsType as UnsupportedOSDialogPropsType } from '../state/smart/UnsupportedOSDialog';

import { ConversationList } from './ConversationList';
import { ContactCheckboxDisabledReason } from './conversationList/ContactCheckbox';
import type { PropsType as DialogExpiredBuildPropsType } from './DialogExpiredBuild';
import { LeftPaneBanner } from './LeftPaneBanner';

import type {
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../types/Avatar';
import { useSizeObserver } from '../hooks/useSizeObserver';
import {
  NavSidebar,
  NavSidebarActionButton,
  NavSidebarSearchHeader,
} from './NavSidebar';
import { ContextMenu } from './ContextMenu';
import { EditState as ProfileEditorEditState } from './ProfileEditor';
import type { UnreadStats } from '../util/countUnreadStats';

export enum LeftPaneMode {
  Inbox,
  Search,
  Archive,
  Compose,
  ChooseGroupMembers,
  SetGroupMetadata,
}

export type PropsType = {
  otherTabsUnreadStats: UnreadStats;
  hasExpiredDialog: boolean;
  hasFailedStorySends: boolean;
  hasNetworkDialog: boolean;
  hasPendingUpdate: boolean;
  hasRelinkDialog: boolean;
  hasUpdateDialog: boolean;
  isUpdateDownloaded: boolean;
  unsupportedOSDialogType: 'error' | 'warning' | undefined;
  usernameCorrupted: boolean;
  usernameLinkCorrupted: boolean;

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
  isMacOS: boolean;
  preferredWidthFromStorage: number;
  selectedConversationId: undefined | string;
  targetedMessageId: undefined | string;
  regionCode: string | undefined;
  challengeStatus: 'idle' | 'required' | 'pending';
  setChallengeStatus: (status: 'idle') => void;
  crashReportCount: number;
  theme: ThemeType;

  // Action Creators
  blockConversation: (conversationId: string) => void;
  clearConversationSearch: () => void;
  clearGroupCreationError: () => void;
  clearSearch: () => void;
  closeMaximumGroupSizeModal: () => void;
  closeRecommendedGroupSizeModal: () => void;
  composeDeleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  composeReplaceAvatar: ReplaceAvatarActionType;
  composeSaveAvatarToDisk: SaveAvatarToDiskActionType;
  createGroup: () => void;
  navTabsCollapsed: boolean;
  openUsernameReservationModal: () => void;
  onOutgoingAudioCallInConversation: (conversationId: string) => void;
  onOutgoingVideoCallInConversation: (conversationId: string) => void;
  removeConversation: (conversationId: string) => void;
  savePreferredLeftPaneWidth: (_: number) => void;
  searchInConversation: (conversationId: string) => unknown;
  setComposeGroupAvatar: (_: undefined | Uint8Array) => void;
  setComposeGroupExpireTimer: (_: DurationInSeconds) => void;
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
  toggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  toggleProfileEditor: (initialEditState?: ProfileEditorEditState) => void;
  updateSearchTerm: (_: string) => void;

  // Render Props
  renderMessageSearchResult: (id: string) => JSX.Element;
  renderNetworkStatus: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderUnsupportedOSDialog: (
    _: Readonly<UnsupportedOSDialogPropsType>
  ) => JSX.Element;
  renderRelinkDialog: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderUpdateDialog: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderCaptchaDialog: (props: { onSkip(): void }) => JSX.Element;
  renderCrashReportDialog: () => JSX.Element;
  renderExpiredBuildDialog: (_: DialogExpiredBuildPropsType) => JSX.Element;
  renderToastManager: (_: {
    containerWidthBreakpoint: WidthBreakpoint;
  }) => JSX.Element;
} & LookupConversationWithoutServiceIdActionsType;

export function LeftPane({
  otherTabsUnreadStats,
  blockConversation,
  challengeStatus,
  clearConversationSearch,
  clearGroupCreationError,
  clearSearch,
  closeMaximumGroupSizeModal,
  closeRecommendedGroupSizeModal,
  composeDeleteAvatarFromDisk,
  composeReplaceAvatar,
  composeSaveAvatarToDisk,
  crashReportCount,
  createGroup,
  getPreferredBadge,
  hasExpiredDialog,
  hasFailedStorySends,
  hasNetworkDialog,
  hasPendingUpdate,
  hasRelinkDialog,
  hasUpdateDialog,
  i18n,
  lookupConversationWithoutServiceId,
  isMacOS,
  isUpdateDownloaded,
  modeSpecificProps,
  navTabsCollapsed,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,

  openUsernameReservationModal,
  preferredWidthFromStorage,
  removeConversation,
  renderCaptchaDialog,
  renderCrashReportDialog,
  renderExpiredBuildDialog,
  renderMessageSearchResult,
  renderNetworkStatus,
  renderUnsupportedOSDialog,
  renderRelinkDialog,
  renderUpdateDialog,
  renderToastManager,
  savePreferredLeftPaneWidth,
  searchInConversation,
  selectedConversationId,
  targetedMessageId,
  toggleNavTabsCollapse,
  toggleProfileEditor,
  setChallengeStatus,
  setComposeGroupAvatar,
  setComposeGroupExpireTimer,
  setComposeGroupName,
  setComposeSearchTerm,
  setIsFetchingUUID,
  showArchivedConversations,
  showChooseGroupMembers,
  showConversation,
  showInbox,
  showUserNotFoundModal,
  startComposing,
  startSearch,
  startSettingGroupMetadata,
  theme,
  toggleComposeEditingAvatar,
  toggleConversationInChooseMembers,
  unsupportedOSDialogType,
  usernameCorrupted,
  usernameLinkCorrupted,
  updateSearchTerm,
}: PropsType): JSX.Element {
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
      const commandOrCtrl = isMacOS ? metaKey : ctrlKey;
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
            targetedMessageId
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
    isMacOS,
    searchInConversation,
    selectedConversationId,
    targetedMessageId,
    showChooseGroupMembers,
    showConversation,
    showInbox,
    startComposing,
    startSearch,
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

  const measureRef = useRef<HTMLDivElement>(null);
  const measureSize = useSizeObserver(measureRef);

  const widthBreakpoint = getNavSidebarWidthBreakpoint(
    measureSize?.width ?? preferredWidthFromStorage
  );

  const commonDialogProps = {
    i18n,
    containerWidthBreakpoint: widthBreakpoint,
  };

  // Yellow dialogs
  let maybeYellowDialog: JSX.Element | undefined;

  if (unsupportedOSDialogType === 'warning') {
    maybeYellowDialog = renderUnsupportedOSDialog({
      type: 'warning',
      ...commonDialogProps,
    });
  } else if (hasNetworkDialog) {
    maybeYellowDialog = renderNetworkStatus(commonDialogProps);
  } else if (hasRelinkDialog) {
    maybeYellowDialog = renderRelinkDialog(commonDialogProps);
  }

  // Update dialog
  let maybeUpdateDialog: JSX.Element | undefined;
  if (hasUpdateDialog && (!hasNetworkDialog || isUpdateDownloaded)) {
    maybeUpdateDialog = renderUpdateDialog(commonDialogProps);
  }

  // Red dialogs
  let maybeRedDialog: JSX.Element | undefined;
  if (unsupportedOSDialogType === 'error') {
    maybeRedDialog = renderUnsupportedOSDialog({
      type: 'error',
      ...commonDialogProps,
    });
  } else if (hasExpiredDialog) {
    maybeRedDialog = renderExpiredBuildDialog(commonDialogProps);
  }

  const dialogs = new Array<{ key: string; dialog: JSX.Element }>();

  if (maybeRedDialog) {
    dialogs.push({ key: 'red', dialog: maybeRedDialog });
    if (maybeUpdateDialog) {
      dialogs.push({ key: 'update', dialog: maybeUpdateDialog });
    } else if (maybeYellowDialog) {
      dialogs.push({ key: 'yellow', dialog: maybeYellowDialog });
    }
  } else {
    if (maybeUpdateDialog) {
      dialogs.push({ key: 'update', dialog: maybeUpdateDialog });
    }
    if (maybeYellowDialog) {
      dialogs.push({ key: 'yellow', dialog: maybeYellowDialog });
    }
  }

  let maybeBanner: JSX.Element | undefined;
  if (usernameCorrupted) {
    maybeBanner = (
      <LeftPaneBanner
        actionText={i18n('icu:LeftPane--corrupted-username--action-text')}
        onClick={() => {
          openUsernameReservationModal();
          toggleProfileEditor(ProfileEditorEditState.Username);
        }}
      >
        {i18n('icu:LeftPane--corrupted-username--text')}
      </LeftPaneBanner>
    );
  } else if (usernameLinkCorrupted) {
    maybeBanner = (
      <LeftPaneBanner
        actionText={i18n('icu:LeftPane--corrupted-username-link--action-text')}
        onClick={() => toggleProfileEditor(ProfileEditorEditState.UsernameLink)}
      >
        {i18n('icu:LeftPane--corrupted-username-link--text')}
      </LeftPaneBanner>
    );
  }

  if (maybeBanner) {
    dialogs.push({ key: 'banner', dialog: maybeBanner });
  }

  return (
    <NavSidebar
      title="Chats"
      hideHeader={
        modeSpecificProps.mode === LeftPaneMode.Archive ||
        modeSpecificProps.mode === LeftPaneMode.Compose ||
        modeSpecificProps.mode === LeftPaneMode.ChooseGroupMembers ||
        modeSpecificProps.mode === LeftPaneMode.SetGroupMetadata
      }
      i18n={i18n}
      otherTabsUnreadStats={otherTabsUnreadStats}
      hasFailedStorySends={hasFailedStorySends}
      hasPendingUpdate={hasPendingUpdate}
      navTabsCollapsed={navTabsCollapsed}
      onToggleNavTabsCollapse={toggleNavTabsCollapse}
      preferredLeftPaneWidth={preferredWidthFromStorage}
      requiresFullWidth={
        modeSpecificProps.mode !== LeftPaneMode.Inbox ||
        modeSpecificProps.isAboutToSearch
      }
      savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
      renderToastManager={renderToastManager}
      actions={
        <>
          <NavSidebarActionButton
            label={i18n('icu:newConversation')}
            icon={<span className="module-left-pane__startComposingIcon" />}
            onClick={startComposing}
          />
          <ContextMenu
            i18n={i18n}
            menuOptions={[
              {
                label: i18n('icu:avatarMenuViewArchive'),
                onClick: showArchivedConversations,
              },
            ]}
            popperOptions={{
              placement: 'bottom',
              strategy: 'absolute',
            }}
            portalToRoot
          >
            {({ openMenu, onKeyDown }) => {
              return (
                <NavSidebarActionButton
                  onClick={openMenu}
                  onKeyDown={onKeyDown}
                  icon={<span className="module-left-pane__moreActionsIcon" />}
                  label="More Actions"
                />
              );
            }}
          </ContextMenu>
        </>
      }
    >
      <nav
        className={classNames(
          'module-left-pane',
          modeSpecificProps.mode === LeftPaneMode.ChooseGroupMembers &&
            'module-left-pane--mode-choose-group-members',
          modeSpecificProps.mode === LeftPaneMode.Compose &&
            'module-left-pane--mode-compose'
        )}
      >
        <div className="module-left-pane__header">
          {helper.getHeaderContents({
            i18n,
            showInbox,
            startComposing,
            showChooseGroupMembers,
          })}
        </div>
        {(widthBreakpoint === WidthBreakpoint.Wide ||
          modeSpecificProps.mode !== LeftPaneMode.Inbox) && (
          <NavSidebarSearchHeader>
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
          </NavSidebarSearchHeader>
        )}
        <div className="module-left-pane__dialogs">
          {dialogs.map(({ key, dialog }) => (
            <React.Fragment key={key}>{dialog}</React.Fragment>
          ))}
        </div>
        {preRowsNode && <React.Fragment key={0}>{preRowsNode}</React.Fragment>}
        <div className="module-left-pane__list--measure" ref={measureRef}>
          <div className="module-left-pane__list--wrapper">
            <div
              aria-live="polite"
              className="module-left-pane__list"
              data-supertab
              key={listKey}
              role="presentation"
              tabIndex={-1}
            >
              <ConversationList
                dimensions={measureSize ?? undefined}
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
                lookupConversationWithoutServiceId={
                  lookupConversationWithoutServiceId
                }
                showConversation={showConversation}
                blockConversation={blockConversation}
                onSelectConversation={onSelectConversation}
                onOutgoingAudioCallInConversation={
                  onOutgoingAudioCallInConversation
                }
                onOutgoingVideoCallInConversation={
                  onOutgoingVideoCallInConversation
                }
                removeConversation={removeConversation}
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
        {footerContents && (
          <div className="module-left-pane__footer">{footerContents}</div>
        )}

        {challengeStatus !== 'idle' &&
          renderCaptchaDialog({
            onSkip() {
              setChallengeStatus('idle');
            },
          })}
        {crashReportCount > 0 && renderCrashReportDialog()}
      </nav>
    </NavSidebar>
  );
}

function keyboardKeyToNumericIndex(key: string): undefined | number {
  if (key.length !== 1) {
    return undefined;
  }
  const result = parseInt(key, 10) - 1;
  const isValidIndex = Number.isInteger(result) && result >= 0 && result <= 8;
  return isValidIndex ? result : undefined;
}
