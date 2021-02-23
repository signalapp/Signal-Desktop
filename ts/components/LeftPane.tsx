// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useEffect, useMemo, CSSProperties } from 'react';
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

import * as OS from '../OS';
import { LocalizerType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';

import { ConversationList } from './ConversationList';

export enum LeftPaneMode {
  Inbox,
  Search,
  Archive,
  Compose,
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
      } & LeftPaneComposePropsType);
  i18n: LocalizerType;
  selectedConversationId: undefined | string;
  selectedMessageId: undefined | string;
  regionCode: string;

  // Action Creators
  startNewConversationFromPhoneNumber: (e164: string) => void;
  openConversationInternal: (_: {
    conversationId: string;
    messageId?: string;
    switchToAssociatedView?: boolean;
  }) => void;
  showArchivedConversations: () => void;
  showInbox: () => void;
  startComposing: () => void;
  setComposeSearchTerm: (composeSearchTerm: string) => void;

  // Render Props
  renderExpiredBuildDialog: () => JSX.Element;
  renderMainHeader: () => JSX.Element;
  renderMessageSearchResult: (id: string, style: CSSProperties) => JSX.Element;
  renderNetworkStatus: () => JSX.Element;
  renderRelinkDialog: () => JSX.Element;
  renderUpdateDialog: () => JSX.Element;
};

export const LeftPane: React.FC<PropsType> = ({
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
  showArchivedConversations,
  showInbox,
  startComposing,
  startNewConversationFromPhoneNumber,
}) => {
  const previousModeSpecificPropsRef = useRef(modeSpecificProps);
  const previousModeSpecificProps = previousModeSpecificPropsRef.current;
  previousModeSpecificPropsRef.current = modeSpecificProps;

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
    i18n,
    onChangeComposeSearchTerm: event => {
      setComposeSearchTerm(event.target.value);
    },
  });
  const getRow = useMemo(() => helper.getRow.bind(helper), [helper]);

  // We ensure that the listKey differs between some modes (e.g. inbox/archived), ensuring
  //   that AutoSizer properly detects the new size of its slot in the flexbox. The
  //   archive explainer text at the top of the archive view causes problems otherwise.
  //   It also ensures that we scroll to the top when switching views.
  const listKey = preRowsNode ? 1 : 0;

  return (
    <div className="module-left-pane">
      <div className="module-left-pane__header">
        {helper.getHeaderContents({ i18n, showInbox }) || renderMainHeader()}
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
                  scrollToRowIndex={helper.getRowIndexToScrollTo(
                    selectedConversationId
                  )}
                  shouldRecomputeRowHeights={shouldRecomputeRowHeights}
                  startNewConversationFromPhoneNumber={
                    startNewConversationFromPhoneNumber
                  }
                />
              </div>
            </div>
          </div>
        )}
      </Measure>
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
