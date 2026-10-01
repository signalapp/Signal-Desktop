// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { tinykeys } from 'tinykeys';
import { createLogger } from '../logging/log.std.ts';
import { PanelType } from '../types/Panels.std.ts';
import { clearConversationDraftAttachments } from '../util/clearConversationDraftAttachments.preload.ts';
import { drop } from '../util/drop.std.ts';
import { matchOrQueryFocusable } from '../util/focusableSelectors.std.ts';
import { getQuotedMessageSelector } from '../state/selectors/composer.preload.ts';
import { removeLinkPreview } from './LinkPreview.preload.ts';
import { ForwardMessagesModalType } from '../components/ForwardMessagesModal.dom.tsx';
import { getSelectedConversationId as getSelectedConversationIdSelector } from '../state/selectors/nav.std.ts';
import { strictAssert } from '../util/assert.std.ts';
import type { ConversationModel } from '../models/conversations.preload.ts';
import { isShowingAnyModal } from '../state/selectors/globalModals.std.ts';

const log = createLogger('addGlobalKeyboardShortcuts');

function hasAnyOpenDialogs(): boolean {
  const state = window.reduxStore.getState();
  return isShowingAnyModal(state);
}

function getSelectedConversationId(): string | null {
  const state = window.reduxStore.getState();
  return getSelectedConversationIdSelector(state) ?? null;
}

function hasSelectedConversation(): boolean {
  return getSelectedConversationId() != null;
}

function getSelectedConversation(): ConversationModel | null {
  const selectedConversationId = getSelectedConversationId();
  if (selectedConversationId == null) {
    return null;
  }
  return window.ConversationController.get(selectedConversationId) ?? null;
}

function getTargetedMessageId(): string | null {
  if (!hasSelectedConversation()) {
    return null;
  }

  const state = window.reduxStore.getState();
  return state.conversations.targetedMessage;
}

function getSelectedMessageIds(): ReadonlyArray<string> | null {
  if (!hasSelectedConversation()) {
    return null;
  }

  const state = window.reduxStore.getState();
  const { selectedMessageIds } = state.conversations;

  if (selectedMessageIds == null || selectedMessageIds.length === 0) {
    return null;
  }

  return selectedMessageIds;
}

function getSelectedOrTargetedMessageIds(): ReadonlyArray<string> | null {
  if (!hasSelectedConversation()) {
    return null;
  }

  const selectedMessageIds = getSelectedMessageIds();
  if (selectedMessageIds != null) {
    return selectedMessageIds;
  }

  const targetedMessageId = getTargetedMessageId();
  if (targetedMessageId != null) {
    return [targetedMessageId];
  }

  return null;
}

export function addGlobalKeyboardShortcuts(): void {
  tinykeys(document, {
    // We need escape on the `document` because some event handlers
    // are preventing it from bubbling up to `window`
    Escape: onEscape,
  });

  tinykeys(
    window,
    {
      // NAVIGATION
      '$mod+/': onShowKeyboardShortcuts,
      '$mod+[Shift]+F6': onSuperTab,
      '$mod+T': onSuperTab,
      '$mod+Shift+T': onFocusComposer,
      '$mod+J': onFocusOldestUnreadOrLastMessage,
      '$mod+Shift+M': onOpenAllMediaPanel,
      '$mod+Shift+A': onArchiveConversation,
      '$mod+Shift+U': onUnarchiveConversation,
      '$mod+Shift+C': onCloseConversation,

      // MESSAGES
      '$mod+D': onOpenMessageDetails,
      '$mod+Shift+R': onToggleReplyToMessage,
      '$mod+S': onSaveAttachment,
      '$mod+Shift+D': onOpenDeleteMessagesDialog,
      '$mod+Shift+S': onOpenForwardMessagesDialog,

      // COMPOSER
      '$mod+P': onRemoveLinkPreview,
      '$mod+Shift+P': onClearAllDraftAttachments,
    },
    {
      // Override default ignore behavior so this fires in textfields too
      ignore: () => false,
    }
  );
}

/**
 * Show keyboard shortcuts - handled by Electron-managed keyboard shortcuts
 * However, on linux Ctrl+/ selects all text, so we prevent that
 */
function onShowKeyboardShortcuts(event: KeyboardEvent): void {
  event.stopPropagation();
  event.preventDefault();
  window.Events.showKeyboardShortcuts();
}

function onSuperTab(event: KeyboardEvent): void {
  const focusedElement = document.activeElement;
  const targets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-supertab="true"]')
  );
  const focusedIndexes: Array<number> = [];

  targets.forEach((target, index) => {
    if (
      (focusedElement != null && target === focusedElement) ||
      target.contains(focusedElement)
    ) {
      focusedIndexes.push(index);
    }
  });

  if (focusedIndexes.length > 1) {
    log.error(
      `supertab: found multiple supertab elements containing the current active element: ${focusedIndexes.join(
        ', '
      )}`
    );
  }

  // Default to the last focusable element to avoid cycles when multiple
  // elements match (generally going to be a parent element)
  const focusedIndex = focusedIndexes.at(-1) ?? -1;

  const lastIndex = targets.length - 1;
  const increment = event.shiftKey ? -1 : 1;

  let index;
  if (focusedIndex < 0 || focusedIndex >= lastIndex) {
    index = 0;
  } else {
    index = focusedIndex + increment;
  }

  while (!targets[index]) {
    index += increment;
    if (index > lastIndex || index < 0) {
      index = 0;
    }
  }

  const node = targets[index];
  strictAssert(node, 'Missing node');
  const firstFocusableElement = matchOrQueryFocusable(node);

  if (firstFocusableElement) {
    firstFocusableElement.focus();
  } else {
    const nodeInfo = Array.from(node.attributes)
      .map(attr => `${attr.name}=${attr.value}`)
      .join(',');
    log.warn(
      `supertab: could not find focus for DOM node ${node.nodeName}<${nodeInfo}>`
    );
    const { activeElement } = document;
    if (
      activeElement &&
      'blur' in activeElement &&
      typeof activeElement.blur === 'function'
    ) {
      activeElement.blur();
    }
  }
}

function onEscape(event: KeyboardEvent): void {
  // Cancel out of keyboard shortcut screen - has first precedence
  const isShortcutGuideModalVisible = window.reduxStore
    ? window.reduxStore.getState().globalModals.isShortcutGuideModalVisible
    : false;

  if (isShortcutGuideModalVisible) {
    window.reduxActions.globalModals.closeShortcutGuideModal();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  // Escape is heavily overloaded - here we avoid clashes with other Escape handlers

  // Check origin - if within a react component which handles escape, don't handle.
  //   Why? Because React's synthetic events can cause events to be handled twice.
  const target = document.activeElement;

  // We might want to use NamedNodeMap.getNamedItem('class')
  /* oxlint-disable @typescript-eslint/no-explicit-any */
  if (
    target &&
    target.attributes &&
    (target.attributes as any).class &&
    (target.attributes as any).class.value
  ) {
    const className = (target.attributes as any).class.value;
    /* oxlint-enable @typescript-eslint/no-explicit-any */

    // Search box wants to handle events internally
    if (className.includes('LeftPaneSearchInput__input')) {
      return;
    }
  }

  // These add listeners to document, but we'll run first
  const confirmationModal = document.querySelector(
    '.module-confirmation-dialog__overlay'
  );
  if (confirmationModal) {
    return;
  }

  const emojiPicker = document.querySelector('.module-emoji-picker');
  if (emojiPicker) {
    return;
  }

  const lightBox = document.querySelector('.Lightbox');
  if (lightBox) {
    return;
  }

  const stickerPicker = document.querySelector('.module-sticker-picker');
  if (stickerPicker) {
    return;
  }

  const stickerPreview = document.querySelector(
    '.module-sticker-manager__preview-modal__overlay'
  );
  if (stickerPreview) {
    return;
  }

  const reactionViewer = document.querySelector('.module-reaction-viewer');
  if (reactionViewer) {
    return;
  }

  const reactionPicker = document.querySelector('.module-ReactionPicker');
  if (reactionPicker) {
    return;
  }

  const contactModal = document.querySelector('.module-contact-modal');
  if (contactModal) {
    return;
  }

  const modalHost = document.querySelector('.module-modal-host__overlay');
  if (modalHost) {
    return;
  }

  // Send Escape to active conversation so it can close panels
  if (hasSelectedConversation()) {
    window.reduxActions.nav.popPanelForConversation();
    event.preventDefault();
    event.stopPropagation();
    return;
  }
}

function onFocusComposer(event: KeyboardEvent) {
  const selectedConversationId = getSelectedConversationId();
  if (selectedConversationId == null) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  window.reduxActions.composer.setComposerFocus(selectedConversationId);
}

function onFocusOldestUnreadOrLastMessage(event: KeyboardEvent) {
  if (!hasSelectedConversation()) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const item: HTMLElement | null =
    document.querySelector(
      '.module-last-seen-indicator ~ div .module-message'
    ) ||
    document.querySelector('.module-timeline__last-message .module-message');
  item?.focus();
}

function onOpenAllMediaPanel(event: KeyboardEvent): void {
  if (!hasSelectedConversation()) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  window.reduxActions.nav.pushPanelForConversation({
    type: PanelType.AllMedia,
  });
}

function onArchiveConversation(event: KeyboardEvent): void {
  const conversation = getSelectedConversation();
  if (conversation == null) {
    return;
  }

  if (conversation.get('isArchived')) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  window.reduxActions.conversations.onArchive(conversation.id);

  // It's very likely that the act of archiving a conversation will set focus to
  //   'none,' or the top-level body element. This resets it to the left pane.
  if (document.activeElement === document.body) {
    const leftPaneEl: HTMLElement | null = document.querySelector(
      '.module-left-pane__list'
    );
    if (leftPaneEl) {
      leftPaneEl.focus();
    }
  }
}

function onUnarchiveConversation(event: KeyboardEvent): void {
  const selectedConversation = getSelectedConversation();
  if (selectedConversation == null) {
    return;
  }

  if (!selectedConversation.get('isArchived')) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  window.reduxActions.conversations.onMoveToInbox(selectedConversation.id);
}

function onCloseConversation(event: KeyboardEvent): void {
  const selectedConversationId = getSelectedConversationId();
  if (selectedConversationId == null) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  window.reduxActions.conversations.onConversationClosed(
    selectedConversationId,
    'keyboard shortcut close'
  );
  window.reduxActions.conversations.showConversation({
    conversationId: undefined,
    messageId: undefined,
  });
}

function onOpenMessageDetails(event: KeyboardEvent): void {
  if (!hasSelectedConversation()) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const targetedMessageId = getTargetedMessageId();
  if (targetedMessageId == null) {
    return;
  }

  window.reduxActions.nav.pushPanelForConversation({
    type: PanelType.MessageDetails,
    args: {
      messageId: targetedMessageId,
    },
  });
}

function onToggleReplyToMessage(event: KeyboardEvent) {
  const selectedConversationId = getSelectedConversationId();
  if (selectedConversationId == null) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const state = window.reduxStore.getState();
  const quotedMessageSelector = getQuotedMessageSelector(state);
  const quote = quotedMessageSelector(selectedConversationId);

  if (quote != null) {
    window.reduxActions.composer.setQuoteByMessageId(
      selectedConversationId,
      undefined
    );
    return;
  }

  const targetedMessageId = getTargetedMessageId();
  if (targetedMessageId == null) {
    return;
  }

  window.reduxActions.composer.setQuoteByMessageId(
    selectedConversationId,
    targetedMessageId
  );
}

function onSaveAttachment(event: KeyboardEvent): void {
  if (!hasSelectedConversation()) {
    return;
  }

  const targetedMessageId = getTargetedMessageId();
  if (targetedMessageId == null) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  window.reduxActions.conversations.saveAttachmentFromMessage(
    targetedMessageId
  );
}

function onOpenDeleteMessagesDialog(event: KeyboardEvent): void {
  const selectedConversationId = getSelectedConversationId();
  if (selectedConversationId == null) {
    return;
  }

  if (hasAnyOpenDialogs()) {
    return;
  }

  const messageIds = getSelectedOrTargetedMessageIds();
  if (messageIds == null) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  window.reduxActions.globalModals.toggleDeleteMessagesModal({
    conversationId: selectedConversationId,
    messageIds,
    onDelete() {
      window.reduxActions.conversations.toggleSelectMode(false);
    },
  });
}

function onOpenForwardMessagesDialog(event: KeyboardEvent) {
  if (!hasSelectedConversation()) {
    return;
  }

  if (hasAnyOpenDialogs()) {
    return;
  }

  const messageIds = getSelectedOrTargetedMessageIds();
  if (messageIds == null) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  window.reduxActions.globalModals.toggleForwardMessagesModal(
    { type: ForwardMessagesModalType.Forward, messageIds },
    () => {
      window.reduxActions.conversations.toggleSelectMode(false);
    }
  );
}

function onRemoveLinkPreview(event: KeyboardEvent): void {
  const selectedConversationId = getSelectedConversationId();
  if (selectedConversationId == null) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  removeLinkPreview(selectedConversationId);
}

function onClearAllDraftAttachments(event: KeyboardEvent) {
  const selectedConversation = getSelectedConversation();
  if (selectedConversation == null) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  drop(
    clearConversationDraftAttachments(
      selectedConversation.id,
      selectedConversation.get('draftAttachments')
    )
  );
}
