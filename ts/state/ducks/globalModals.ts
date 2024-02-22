// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import type { ExplodePromiseResultType } from '../../util/explodePromise';
import type {
  GroupV2PendingMemberType,
  MessageAttributesType,
} from '../../model-types.d';
import type {
  MessageChangedActionType,
  MessageDeletedActionType,
  MessageExpiredActionType,
} from './conversations';
import type { MessagePropsType } from '../selectors/message';
import type { RecipientsByConversation } from './stories';
import type { SafetyNumberChangeSource } from '../../components/SafetyNumberChangeDialog';
import type { EditState as ProfileEditorEditState } from '../../components/ProfileEditor';
import type { StateType as RootStateType } from '../reducer';
import * as Errors from '../../types/errors';
import * as SingleServePromise from '../../services/singleServePromise';
import * as Stickers from '../../types/Stickers';
import { UsernameOnboardingState } from '../../types/globalModals';
import * as log from '../../logging/log';
import { getMessagePropsSelector } from '../selectors/message';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { longRunningTaskWrapper } from '../../util/longRunningTaskWrapper';
import { useBoundActions } from '../../hooks/useBoundActions';
import { isGroupV1 } from '../../util/whatTypeOfConversation';
import { authorizeArtCreator } from '../../textsecure/authorizeArtCreator';
import type { AuthorizeArtCreatorOptionsType } from '../../textsecure/authorizeArtCreator';
import { getGroupMigrationMembers } from '../../groups';
import { ToastType } from '../../types/Toast';
import {
  MESSAGE_CHANGED,
  MESSAGE_DELETED,
  MESSAGE_EXPIRED,
  actions as conversationsActions,
} from './conversations';
import { SHOW_TOAST } from './toast';
import type { ShowToastActionType } from './toast';
import { isDownloaded } from '../../types/Attachment';
import type { ButtonVariant } from '../../components/Button';

// State

export type EditHistoryMessagesType = ReadonlyDeep<
  Array<MessageAttributesType>
>;
export type DeleteMessagesPropsType = ReadonlyDeep<{
  conversationId: string;
  messageIds: ReadonlyArray<string>;
  onDelete?: () => void;
}>;
export type ForwardMessagePropsType = ReadonlyDeep<MessagePropsType>;
export type ForwardMessagesPropsType = ReadonlyDeep<{
  messages: Array<ForwardMessagePropsType>;
  onForward?: () => void;
}>;
export type SafetyNumberChangedBlockingDataType = ReadonlyDeep<{
  promiseUuid: SingleServePromise.SingleServePromiseIdString;
  source?: SafetyNumberChangeSource;
}>;
export type FormattingWarningDataType = ReadonlyDeep<{
  explodedPromise: ExplodePromiseResultType<boolean>;
}>;
export type SendEditWarningDataType = ReadonlyDeep<{
  explodedPromise: ExplodePromiseResultType<boolean>;
}>;
export type AuthorizeArtCreatorDataType =
  ReadonlyDeep<AuthorizeArtCreatorOptionsType>;

type MigrateToGV2PropsType = ReadonlyDeep<{
  areWeInvited: boolean;
  conversationId: string;
  droppedMemberIds: Array<string>;
  hasMigrated: boolean;
  invitedMemberIds: Array<string>;
}>;

export type GlobalModalsStateType = ReadonlyDeep<{
  addUserToAnotherGroupModalContactId?: string;
  aboutContactModalContactId?: string;
  authArtCreatorData?: AuthorizeArtCreatorDataType;
  contactModalState?: ContactModalStateType;
  deleteMessagesProps?: DeleteMessagesPropsType;
  editHistoryMessages?: EditHistoryMessagesType;
  errorModalProps?: {
    buttonVariant?: ButtonVariant;
    description?: string;
    title?: string;
  };
  formattingWarningData?: FormattingWarningDataType;
  forwardMessagesProps?: ForwardMessagesPropsType;
  gv2MigrationProps?: MigrateToGV2PropsType;
  hasConfirmationModal: boolean;
  isAuthorizingArtCreator?: boolean;
  isProfileEditorVisible: boolean;
  isShortcutGuideModalVisible: boolean;
  isSignalConnectionsVisible: boolean;
  isStoriesSettingsVisible: boolean;
  isWhatsNewVisible: boolean;
  usernameOnboardingState: UsernameOnboardingState;
  profileEditorHasError: boolean;
  profileEditorInitialEditState: ProfileEditorEditState | undefined;
  safetyNumberChangedBlockingData?: SafetyNumberChangedBlockingDataType;
  safetyNumberModalContactId?: string;
  sendEditWarningData?: SendEditWarningDataType;
  stickerPackPreviewId?: string;
  userNotFoundModalState?: UserNotFoundModalStateType;
}>;

// Actions

const HIDE_CONTACT_MODAL = 'globalModals/HIDE_CONTACT_MODAL';
const SHOW_CONTACT_MODAL = 'globalModals/SHOW_CONTACT_MODAL';
const HIDE_WHATS_NEW_MODAL = 'globalModals/HIDE_WHATS_NEW_MODAL_MODAL';
const SHOW_WHATS_NEW_MODAL = 'globalModals/SHOW_WHATS_NEW_MODAL_MODAL';
const HIDE_SERVICE_ID_NOT_FOUND_MODAL =
  'globalModals/HIDE_SERVICE_ID_NOT_FOUND_MODAL';
const SHOW_SERVICE_ID_NOT_FOUND_MODAL =
  'globalModals/SHOW_SERVICE_ID_NOT_FOUND_MODAL';
const SHOW_STORIES_SETTINGS = 'globalModals/SHOW_STORIES_SETTINGS';
const HIDE_STORIES_SETTINGS = 'globalModals/HIDE_STORIES_SETTINGS';
const TOGGLE_DELETE_MESSAGES_MODAL =
  'globalModals/TOGGLE_DELETE_MESSAGES_MODAL';
const TOGGLE_FORWARD_MESSAGES_MODAL =
  'globalModals/TOGGLE_FORWARD_MESSAGES_MODAL';
const TOGGLE_PROFILE_EDITOR = 'globalModals/TOGGLE_PROFILE_EDITOR';
export const TOGGLE_PROFILE_EDITOR_ERROR =
  'globalModals/TOGGLE_PROFILE_EDITOR_ERROR';
const TOGGLE_SAFETY_NUMBER_MODAL = 'globalModals/TOGGLE_SAFETY_NUMBER_MODAL';
const TOGGLE_ADD_USER_TO_ANOTHER_GROUP_MODAL =
  'globalModals/TOGGLE_ADD_USER_TO_ANOTHER_GROUP_MODAL';
const TOGGLE_ABOUT_MODAL = 'globalModals/TOGGLE_ABOUT_MODAL';
const TOGGLE_SIGNAL_CONNECTIONS_MODAL =
  'globalModals/TOGGLE_SIGNAL_CONNECTIONS_MODAL';
export const SHOW_SEND_ANYWAY_DIALOG = 'globalModals/SHOW_SEND_ANYWAY_DIALOG';
const HIDE_SEND_ANYWAY_DIALOG = 'globalModals/HIDE_SEND_ANYWAY_DIALOG';
const SHOW_GV2_MIGRATION_DIALOG = 'globalModals/SHOW_GV2_MIGRATION_DIALOG';
const CLOSE_GV2_MIGRATION_DIALOG = 'globalModals/CLOSE_GV2_MIGRATION_DIALOG';
const SHOW_STICKER_PACK_PREVIEW = 'globalModals/SHOW_STICKER_PACK_PREVIEW';
const CLOSE_STICKER_PACK_PREVIEW = 'globalModals/CLOSE_STICKER_PACK_PREVIEW';
const CLOSE_ERROR_MODAL = 'globalModals/CLOSE_ERROR_MODAL';
export const SHOW_ERROR_MODAL = 'globalModals/SHOW_ERROR_MODAL';
const SHOW_FORMATTING_WARNING_MODAL =
  'globalModals/SHOW_FORMATTING_WARNING_MODAL';
const SHOW_SEND_EDIT_WARNING_MODAL =
  'globalModals/SHOW_SEND_EDIT_WARNING_MODAL';
const CLOSE_SHORTCUT_GUIDE_MODAL = 'globalModals/CLOSE_SHORTCUT_GUIDE_MODAL';
const SHOW_SHORTCUT_GUIDE_MODAL = 'globalModals/SHOW_SHORTCUT_GUIDE_MODAL';
const SHOW_AUTH_ART_CREATOR = 'globalModals/SHOW_AUTH_ART_CREATOR';
const TOGGLE_CONFIRMATION_MODAL = 'globalModals/TOGGLE_CONFIRMATION_MODAL';
const CANCEL_AUTH_ART_CREATOR = 'globalModals/CANCEL_AUTH_ART_CREATOR';
const CONFIRM_AUTH_ART_CREATOR_PENDING =
  'globalModals/CONFIRM_AUTH_ART_CREATOR_PENDING';
const CONFIRM_AUTH_ART_CREATOR_FULFILLED =
  'globalModals/CONFIRM_AUTH_ART_CREATOR_FULFILLED';
const SHOW_EDIT_HISTORY_MODAL = 'globalModals/SHOW_EDIT_HISTORY_MODAL';
const CLOSE_EDIT_HISTORY_MODAL = 'globalModals/CLOSE_EDIT_HISTORY_MODAL';
const TOGGLE_USERNAME_ONBOARDING = 'globalModals/TOGGLE_USERNAME_ONBOARDING';

export type ContactModalStateType = ReadonlyDeep<{
  contactId: string;
  conversationId?: string;
}>;

export type UserNotFoundModalStateType = ReadonlyDeep<
  | {
      type: 'phoneNumber';
      phoneNumber: string;
    }
  | {
      type: 'username';
      username: string;
    }
>;

type HideContactModalActionType = ReadonlyDeep<{
  type: typeof HIDE_CONTACT_MODAL;
}>;

type ShowContactModalActionType = ReadonlyDeep<{
  type: typeof SHOW_CONTACT_MODAL;
  payload: ContactModalStateType;
}>;

type HideWhatsNewModalActionType = ReadonlyDeep<{
  type: typeof HIDE_WHATS_NEW_MODAL;
}>;

type ShowWhatsNewModalActionType = ReadonlyDeep<{
  type: typeof SHOW_WHATS_NEW_MODAL;
}>;

type HideUserNotFoundModalActionType = ReadonlyDeep<{
  type: typeof HIDE_SERVICE_ID_NOT_FOUND_MODAL;
}>;

export type ShowUserNotFoundModalActionType = ReadonlyDeep<{
  type: typeof SHOW_SERVICE_ID_NOT_FOUND_MODAL;
  payload: UserNotFoundModalStateType;
}>;

type ToggleDeleteMessagesModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_DELETE_MESSAGES_MODAL;
  payload: DeleteMessagesPropsType | undefined;
}>;

type ToggleForwardMessagesModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_FORWARD_MESSAGES_MODAL;
  payload: ForwardMessagesPropsType | undefined;
}>;

type ToggleProfileEditorActionType = ReadonlyDeep<{
  type: typeof TOGGLE_PROFILE_EDITOR;
  payload: {
    initialEditState?: ProfileEditorEditState;
  };
}>;

export type ToggleProfileEditorErrorActionType = ReadonlyDeep<{
  type: typeof TOGGLE_PROFILE_EDITOR_ERROR;
}>;

type ToggleSafetyNumberModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_SAFETY_NUMBER_MODAL;
  payload: string | undefined;
}>;

type ToggleAddUserToAnotherGroupModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_ADD_USER_TO_ANOTHER_GROUP_MODAL;
  payload: string | undefined;
}>;

type ToggleAboutContactModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_ABOUT_MODAL;
  payload: string | undefined;
}>;

type ToggleSignalConnectionsModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_SIGNAL_CONNECTIONS_MODAL;
}>;

type ToggleConfirmationModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_CONFIRMATION_MODAL;
  payload: boolean;
}>;

type ToggleUsernameOnboardingActionType = ReadonlyDeep<{
  type: typeof TOGGLE_USERNAME_ONBOARDING;
}>;

type ShowStoriesSettingsActionType = ReadonlyDeep<{
  type: typeof SHOW_STORIES_SETTINGS;
}>;

type ShowFormattingWarningModalActionType = ReadonlyDeep<{
  type: typeof SHOW_FORMATTING_WARNING_MODAL;
  payload: {
    explodedPromise: ExplodePromiseResultType<boolean> | undefined;
  };
}>;

type ShowSendEditWarningModalActionType = ReadonlyDeep<{
  type: typeof SHOW_SEND_EDIT_WARNING_MODAL;
  payload: {
    explodedPromise: ExplodePromiseResultType<boolean> | undefined;
  };
}>;

type HideStoriesSettingsActionType = ReadonlyDeep<{
  type: typeof HIDE_STORIES_SETTINGS;
}>;

type StartMigrationToGV2ActionType = ReadonlyDeep<{
  type: typeof SHOW_GV2_MIGRATION_DIALOG;
  payload: MigrateToGV2PropsType;
}>;

type CloseGV2MigrationDialogActionType = ReadonlyDeep<{
  type: typeof CLOSE_GV2_MIGRATION_DIALOG;
}>;

export type ShowSendAnywayDialogActionType = ReadonlyDeep<{
  type: typeof SHOW_SEND_ANYWAY_DIALOG;
  payload: SafetyNumberChangedBlockingDataType & {
    untrustedByConversation: RecipientsByConversation;
  };
}>;

type HideSendAnywayDialogActiontype = ReadonlyDeep<{
  type: typeof HIDE_SEND_ANYWAY_DIALOG;
}>;

export type ShowStickerPackPreviewActionType = ReadonlyDeep<{
  type: typeof SHOW_STICKER_PACK_PREVIEW;
  payload: string;
}>;

type CloseStickerPackPreviewActionType = ReadonlyDeep<{
  type: typeof CLOSE_STICKER_PACK_PREVIEW;
}>;

type CloseErrorModalActionType = ReadonlyDeep<{
  type: typeof CLOSE_ERROR_MODAL;
}>;

export type ShowErrorModalActionType = ReadonlyDeep<{
  type: typeof SHOW_ERROR_MODAL;
  payload: {
    buttonVariant?: ButtonVariant;
    description?: string;
    title?: string;
  };
}>;

type CloseShortcutGuideModalActionType = ReadonlyDeep<{
  type: typeof CLOSE_SHORTCUT_GUIDE_MODAL;
}>;

type ShowShortcutGuideModalActionType = ReadonlyDeep<{
  type: typeof SHOW_SHORTCUT_GUIDE_MODAL;
}>;

export type ShowAuthArtCreatorActionType = ReadonlyDeep<{
  type: typeof SHOW_AUTH_ART_CREATOR;
  payload: AuthorizeArtCreatorDataType;
}>;

type CancelAuthArtCreatorActionType = ReadonlyDeep<{
  type: typeof CANCEL_AUTH_ART_CREATOR;
}>;

type ConfirmAuthArtCreatorPendingActionType = ReadonlyDeep<{
  type: typeof CONFIRM_AUTH_ART_CREATOR_PENDING;
}>;

type ConfirmAuthArtCreatorFulfilledActionType = ReadonlyDeep<{
  type: typeof CONFIRM_AUTH_ART_CREATOR_FULFILLED;
}>;

type ShowEditHistoryModalActionType = ReadonlyDeep<{
  type: typeof SHOW_EDIT_HISTORY_MODAL;
  payload: {
    messages: EditHistoryMessagesType;
  };
}>;

type CloseEditHistoryModalActionType = ReadonlyDeep<{
  type: typeof CLOSE_EDIT_HISTORY_MODAL;
}>;

export type GlobalModalsActionType = ReadonlyDeep<
  | CancelAuthArtCreatorActionType
  | CloseEditHistoryModalActionType
  | CloseErrorModalActionType
  | CloseGV2MigrationDialogActionType
  | CloseShortcutGuideModalActionType
  | CloseStickerPackPreviewActionType
  | ConfirmAuthArtCreatorFulfilledActionType
  | ConfirmAuthArtCreatorPendingActionType
  | HideContactModalActionType
  | HideSendAnywayDialogActiontype
  | HideStoriesSettingsActionType
  | HideUserNotFoundModalActionType
  | HideWhatsNewModalActionType
  | MessageChangedActionType
  | MessageDeletedActionType
  | MessageExpiredActionType
  | ShowAuthArtCreatorActionType
  | ShowContactModalActionType
  | ShowEditHistoryModalActionType
  | ShowErrorModalActionType
  | ShowFormattingWarningModalActionType
  | ShowSendAnywayDialogActionType
  | ShowSendEditWarningModalActionType
  | ShowShortcutGuideModalActionType
  | ShowStickerPackPreviewActionType
  | ShowStoriesSettingsActionType
  | ShowUserNotFoundModalActionType
  | ShowWhatsNewModalActionType
  | StartMigrationToGV2ActionType
  | ToggleAboutContactModalActionType
  | ToggleAddUserToAnotherGroupModalActionType
  | ToggleConfirmationModalActionType
  | ToggleDeleteMessagesModalActionType
  | ToggleForwardMessagesModalActionType
  | ToggleProfileEditorActionType
  | ToggleProfileEditorErrorActionType
  | ToggleSafetyNumberModalActionType
  | ToggleSignalConnectionsModalActionType
  | ToggleUsernameOnboardingActionType
>;

// Action Creators

export const actions = {
  cancelAuthorizeArtCreator,
  closeEditHistoryModal,
  closeErrorModal,
  closeGV2MigrationDialog,
  closeShortcutGuideModal,
  closeStickerPackPreview,
  confirmAuthorizeArtCreator,
  hideBlockingSafetyNumberChangeDialog,
  hideContactModal,
  hideStoriesSettings,
  hideUserNotFoundModal,
  hideWhatsNewModal,
  showAuthorizeArtCreator,
  showBlockingSafetyNumberChangeDialog,
  showContactModal,
  showEditHistoryModal,
  showErrorModal,
  showFormattingWarningModal,
  showSendEditWarningModal,
  showGV2MigrationDialog,
  showShortcutGuideModal,
  showStickerPackPreview,
  showStoriesSettings,
  showUserNotFoundModal,
  showWhatsNewModal,
  toggleAboutContactModal,
  toggleAddUserToAnotherGroupModal,
  toggleConfirmationModal,
  toggleDeleteMessagesModal,
  toggleForwardMessagesModal,
  toggleProfileEditor,
  toggleProfileEditorHasError,
  toggleSafetyNumberModal,
  toggleSignalConnectionsModal,
  toggleUsernameOnboarding,
};

export const useGlobalModalActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function hideContactModal(): HideContactModalActionType {
  return {
    type: HIDE_CONTACT_MODAL,
  };
}

function showContactModal(
  contactId: string,
  conversationId?: string
): ShowContactModalActionType {
  return {
    type: SHOW_CONTACT_MODAL,
    payload: {
      contactId,
      conversationId,
    },
  };
}

function hideWhatsNewModal(): HideWhatsNewModalActionType {
  return {
    type: HIDE_WHATS_NEW_MODAL,
  };
}

function showWhatsNewModal(): ShowWhatsNewModalActionType {
  return {
    type: SHOW_WHATS_NEW_MODAL,
  };
}

function hideUserNotFoundModal(): HideUserNotFoundModalActionType {
  return {
    type: HIDE_SERVICE_ID_NOT_FOUND_MODAL,
  };
}

function showUserNotFoundModal(
  payload: UserNotFoundModalStateType
): ShowUserNotFoundModalActionType {
  return {
    type: SHOW_SERVICE_ID_NOT_FOUND_MODAL,
    payload,
  };
}

function hideStoriesSettings(): HideStoriesSettingsActionType {
  return { type: HIDE_STORIES_SETTINGS };
}

function showStoriesSettings(): ShowStoriesSettingsActionType {
  return { type: SHOW_STORIES_SETTINGS };
}

function showFormattingWarningModal(
  explodedPromise: ExplodePromiseResultType<boolean> | undefined
): ShowFormattingWarningModalActionType {
  return { type: SHOW_FORMATTING_WARNING_MODAL, payload: { explodedPromise } };
}

function showSendEditWarningModal(
  explodedPromise: ExplodePromiseResultType<boolean> | undefined
): ShowSendEditWarningModalActionType {
  return { type: SHOW_SEND_EDIT_WARNING_MODAL, payload: { explodedPromise } };
}

function showGV2MigrationDialog(
  conversationId: string
): ThunkAction<void, RootStateType, unknown, StartMigrationToGV2ActionType> {
  return async dispatch => {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error(
        'showGV2MigrationDialog: Expected a conversation to be found. Doing nothing'
      );
    }

    const idForLogging = conversation.idForLogging();

    if (!isGroupV1(conversation.attributes)) {
      throw new Error(
        `showGV2MigrationDialog/${idForLogging}: Cannot start, not a GroupV1 group`
      );
    }

    // Note: this call will throw if, after generating member lists, we are no longer a
    //   member or are in the pending member list.
    const { droppedGV2MemberIds, pendingMembersV2 } =
      await longRunningTaskWrapper({
        idForLogging,
        name: 'getGroupMigrationMembers',
        task: () => getGroupMigrationMembers(conversation),
      });

    const invitedMemberIds = pendingMembersV2.map(
      (item: GroupV2PendingMemberType) => item.serviceId
    );

    dispatch({
      type: SHOW_GV2_MIGRATION_DIALOG,
      payload: {
        areWeInvited: false,
        conversationId,
        droppedMemberIds: droppedGV2MemberIds,
        hasMigrated: false,
        invitedMemberIds,
      },
    });
  };
}

function closeGV2MigrationDialog(): CloseGV2MigrationDialogActionType {
  return {
    type: CLOSE_GV2_MIGRATION_DIALOG,
  };
}

function toggleDeleteMessagesModal(
  props: DeleteMessagesPropsType | undefined
): ToggleDeleteMessagesModalActionType {
  return {
    type: TOGGLE_DELETE_MESSAGES_MODAL,
    payload: props,
  };
}

function toggleForwardMessagesModal(
  messageIds?: ReadonlyArray<string>,
  onForward?: () => void
): ThunkAction<
  void,
  RootStateType,
  unknown,
  ToggleForwardMessagesModalActionType
> {
  return async (dispatch, getState) => {
    if (!messageIds) {
      dispatch({
        type: TOGGLE_FORWARD_MESSAGES_MODAL,
        payload: undefined,
      });
      return;
    }

    const messagesProps = await Promise.all(
      messageIds.map(async messageId => {
        const messageAttributes = await window.MessageCache.resolveAttributes(
          'toggleForwardMessagesModal',
          messageId
        );

        const { attachments = [] } = messageAttributes;

        if (!attachments.every(isDownloaded)) {
          dispatch(
            conversationsActions.kickOffAttachmentDownload({ messageId })
          );
        }

        const messagePropsSelector = getMessagePropsSelector(getState());
        const messageProps = messagePropsSelector(messageAttributes);

        return messageProps;
      })
    );

    dispatch({
      type: TOGGLE_FORWARD_MESSAGES_MODAL,
      payload: { messages: messagesProps, onForward },
    });
  };
}

function toggleProfileEditor(
  initialEditState?: ProfileEditorEditState
): ToggleProfileEditorActionType {
  return { type: TOGGLE_PROFILE_EDITOR, payload: { initialEditState } };
}

function toggleProfileEditorHasError(): ToggleProfileEditorErrorActionType {
  return { type: TOGGLE_PROFILE_EDITOR_ERROR };
}

function toggleSafetyNumberModal(
  safetyNumberModalContactId?: string
): ToggleSafetyNumberModalActionType {
  return {
    type: TOGGLE_SAFETY_NUMBER_MODAL,
    payload: safetyNumberModalContactId,
  };
}

function toggleAddUserToAnotherGroupModal(
  contactId?: string
): ToggleAddUserToAnotherGroupModalActionType {
  return {
    type: TOGGLE_ADD_USER_TO_ANOTHER_GROUP_MODAL,
    payload: contactId,
  };
}

function toggleAboutContactModal(
  contactId?: string
): ToggleAboutContactModalActionType {
  return {
    type: TOGGLE_ABOUT_MODAL,
    payload: contactId,
  };
}

function toggleSignalConnectionsModal(): ToggleSignalConnectionsModalActionType {
  return {
    type: TOGGLE_SIGNAL_CONNECTIONS_MODAL,
  };
}

function toggleConfirmationModal(
  isOpen: boolean
): ToggleConfirmationModalActionType {
  return {
    type: TOGGLE_CONFIRMATION_MODAL,
    payload: isOpen,
  };
}

function toggleUsernameOnboarding(): ToggleUsernameOnboardingActionType {
  return { type: TOGGLE_USERNAME_ONBOARDING };
}

function showBlockingSafetyNumberChangeDialog(
  untrustedByConversation: RecipientsByConversation,
  explodedPromise: ExplodePromiseResultType<boolean>,
  source?: SafetyNumberChangeSource
): ThunkAction<void, RootStateType, unknown, ShowSendAnywayDialogActionType> {
  const promiseUuid = SingleServePromise.set<boolean>(explodedPromise);

  return dispatch => {
    dispatch({
      type: SHOW_SEND_ANYWAY_DIALOG,
      payload: {
        untrustedByConversation,
        promiseUuid,
        source,
      },
    });
  };
}

function hideBlockingSafetyNumberChangeDialog(): HideSendAnywayDialogActiontype {
  return {
    type: HIDE_SEND_ANYWAY_DIALOG,
  };
}

function closeStickerPackPreview(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CloseStickerPackPreviewActionType
> {
  return async (dispatch, getState) => {
    const packId = getState().globalModals.stickerPackPreviewId;

    if (packId && Stickers.getStickerPack(packId) !== undefined) {
      await Stickers.removeEphemeralPack(packId);
    }

    dispatch({
      type: CLOSE_STICKER_PACK_PREVIEW,
    });
  };
}

export function showStickerPackPreview(
  packId: string,
  packKey: string
): ShowStickerPackPreviewActionType {
  // Intentionally not awaiting this so that we can show the modal right away.
  // The modal has a loading spinner on it.
  void Stickers.downloadEphemeralPack(packId, packKey);

  return {
    type: SHOW_STICKER_PACK_PREVIEW,
    payload: packId,
  };
}

function closeErrorModal(): CloseErrorModalActionType {
  return {
    type: CLOSE_ERROR_MODAL,
  };
}

function showErrorModal({
  buttonVariant,
  description,
  title,
}: {
  buttonVariant?: ButtonVariant;
  description?: string;
  title?: string;
}): ShowErrorModalActionType {
  return {
    type: SHOW_ERROR_MODAL,
    payload: {
      buttonVariant,
      description,
      title,
    },
  };
}

function closeShortcutGuideModal(): CloseShortcutGuideModalActionType {
  return {
    type: CLOSE_SHORTCUT_GUIDE_MODAL,
  };
}

function showShortcutGuideModal(): ShowShortcutGuideModalActionType {
  return {
    type: SHOW_SHORTCUT_GUIDE_MODAL,
  };
}

function cancelAuthorizeArtCreator(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CancelAuthArtCreatorActionType
> {
  return async (dispatch, getState) => {
    const data = getState().globalModals.authArtCreatorData;

    if (!data) {
      return;
    }

    dispatch({
      type: CANCEL_AUTH_ART_CREATOR,
    });
  };
}

function copyOverMessageAttributesIntoEditHistory(
  messageAttributes: ReadonlyDeep<MessageAttributesType>
): EditHistoryMessagesType | undefined {
  if (!messageAttributes.editHistory) {
    return;
  }

  return messageAttributes.editHistory.map(editedMessageAttributes => ({
    ...messageAttributes,
    // Always take attachments from the edited message (they might be absent)
    attachments: undefined,
    editMessageTimestamp: undefined,
    quote: undefined,
    preview: [],
    ...editedMessageAttributes,
    // For timestamp uniqueness of messages
    sent_at: editedMessageAttributes.timestamp,
  }));
}

function showEditHistoryModal(
  messageId: string
): ThunkAction<void, RootStateType, unknown, ShowEditHistoryModalActionType> {
  return async dispatch => {
    const messageAttributes = await window.MessageCache.resolveAttributes(
      'showEditHistoryModal',
      messageId
    );
    const nextEditHistoryMessages =
      copyOverMessageAttributesIntoEditHistory(messageAttributes);

    if (!nextEditHistoryMessages) {
      log.warn('showEditHistoryModal: no edit history for message');
      return;
    }

    dispatch({
      type: SHOW_EDIT_HISTORY_MODAL,
      payload: {
        messages: nextEditHistoryMessages,
      },
    });
  };
}

function closeEditHistoryModal(): CloseEditHistoryModalActionType {
  return {
    type: CLOSE_EDIT_HISTORY_MODAL,
  };
}

export function showAuthorizeArtCreator(
  data: AuthorizeArtCreatorDataType
): ShowAuthArtCreatorActionType {
  return {
    type: SHOW_AUTH_ART_CREATOR,
    payload: data,
  };
}

export function confirmAuthorizeArtCreator(): ThunkAction<
  void,
  RootStateType,
  unknown,
  | ConfirmAuthArtCreatorPendingActionType
  | ConfirmAuthArtCreatorFulfilledActionType
  | CancelAuthArtCreatorActionType
  | ShowToastActionType
> {
  return async (dispatch, getState) => {
    const data = getState().globalModals.authArtCreatorData;

    if (!data) {
      dispatch({ type: CANCEL_AUTH_ART_CREATOR });
      return;
    }

    dispatch({
      type: CONFIRM_AUTH_ART_CREATOR_PENDING,
    });

    try {
      await authorizeArtCreator(data);
    } catch (err) {
      log.error('authorizeArtCreator failed', Errors.toLogFormat(err));
      dispatch({
        type: SHOW_TOAST,
        payload: {
          toastType: ToastType.Error,
        },
      });
    }

    dispatch({
      type: CONFIRM_AUTH_ART_CREATOR_FULFILLED,
    });
  };
}

function copyOverMessageAttributesIntoForwardMessages(
  messagesProps: ReadonlyArray<ForwardMessagePropsType>,
  attributes: ReadonlyDeep<MessageAttributesType>
): ReadonlyArray<ForwardMessagePropsType> {
  return messagesProps.map(messageProps => {
    if (messageProps.id !== attributes.id) {
      return messageProps;
    }
    return {
      ...messageProps,
      attachments: attributes.attachments,
    };
  });
}

// Reducer

export function getEmptyState(): GlobalModalsStateType {
  return {
    hasConfirmationModal: false,
    isProfileEditorVisible: false,
    isShortcutGuideModalVisible: false,
    isSignalConnectionsVisible: false,
    isStoriesSettingsVisible: false,
    isWhatsNewVisible: false,
    usernameOnboardingState: UsernameOnboardingState.NeverShown,
    profileEditorHasError: false,
    profileEditorInitialEditState: undefined,
  };
}

export function reducer(
  state: Readonly<GlobalModalsStateType> = getEmptyState(),
  action: Readonly<GlobalModalsActionType>
): GlobalModalsStateType {
  if (action.type === TOGGLE_ABOUT_MODAL) {
    return {
      ...state,
      aboutContactModalContactId: action.payload,
    };
  }

  if (action.type === TOGGLE_PROFILE_EDITOR) {
    return {
      ...state,
      isProfileEditorVisible: !state.isProfileEditorVisible,
      profileEditorInitialEditState: action.payload.initialEditState,
    };
  }

  if (action.type === TOGGLE_PROFILE_EDITOR_ERROR) {
    return {
      ...state,
      profileEditorHasError: !state.profileEditorHasError,
    };
  }

  if (action.type === SHOW_WHATS_NEW_MODAL) {
    return {
      ...state,
      isWhatsNewVisible: true,
    };
  }

  if (action.type === HIDE_WHATS_NEW_MODAL) {
    return {
      ...state,
      isWhatsNewVisible: false,
    };
  }

  if (action.type === HIDE_SERVICE_ID_NOT_FOUND_MODAL) {
    return {
      ...state,
      userNotFoundModalState: undefined,
    };
  }

  if (action.type === SHOW_SERVICE_ID_NOT_FOUND_MODAL) {
    return {
      ...state,
      userNotFoundModalState: {
        ...action.payload,
      },
    };
  }

  if (action.type === SHOW_CONTACT_MODAL) {
    const ourId = window.ConversationController.getOurConversationIdOrThrow();
    if (action.payload.contactId === ourId) {
      return {
        ...state,
        aboutContactModalContactId: ourId,
      };
    }

    return {
      ...state,
      contactModalState: action.payload,
    };
  }

  if (action.type === HIDE_CONTACT_MODAL) {
    return {
      ...state,
      contactModalState: undefined,
    };
  }

  if (action.type === TOGGLE_SAFETY_NUMBER_MODAL) {
    return {
      ...state,
      safetyNumberModalContactId: action.payload,
    };
  }

  if (action.type === TOGGLE_ADD_USER_TO_ANOTHER_GROUP_MODAL) {
    return {
      ...state,
      addUserToAnotherGroupModalContactId: action.payload,
    };
  }

  if (action.type === TOGGLE_DELETE_MESSAGES_MODAL) {
    return {
      ...state,
      deleteMessagesProps: action.payload,
    };
  }

  if (action.type === TOGGLE_FORWARD_MESSAGES_MODAL) {
    return {
      ...state,
      forwardMessagesProps: action.payload,
    };
  }

  if (action.type === HIDE_STORIES_SETTINGS) {
    return {
      ...state,
      isStoriesSettingsVisible: false,
    };
  }

  if (action.type === SHOW_STORIES_SETTINGS) {
    return {
      ...state,
      isStoriesSettingsVisible: true,
    };
  }

  if (action.type === TOGGLE_SIGNAL_CONNECTIONS_MODAL) {
    return {
      ...state,
      isSignalConnectionsVisible: !state.isSignalConnectionsVisible,
    };
  }

  if (action.type === TOGGLE_CONFIRMATION_MODAL) {
    return {
      ...state,
      hasConfirmationModal: action.payload,
    };
  }

  if (action.type === TOGGLE_USERNAME_ONBOARDING) {
    return {
      ...state,
      usernameOnboardingState:
        state.usernameOnboardingState === UsernameOnboardingState.Open
          ? UsernameOnboardingState.Closed
          : UsernameOnboardingState.Open,
    };
  }

  if (action.type === SHOW_SEND_ANYWAY_DIALOG) {
    const { promiseUuid, source } = action.payload;

    return {
      ...state,
      safetyNumberChangedBlockingData: {
        promiseUuid,
        source,
      },
    };
  }

  if (action.type === HIDE_SEND_ANYWAY_DIALOG) {
    return {
      ...state,
      safetyNumberChangedBlockingData: undefined,
    };
  }

  if (action.type === CLOSE_STICKER_PACK_PREVIEW) {
    return {
      ...state,
      stickerPackPreviewId: undefined,
    };
  }

  if (action.type === SHOW_FORMATTING_WARNING_MODAL) {
    const { explodedPromise } = action.payload;
    if (!explodedPromise) {
      return {
        ...state,
        formattingWarningData: undefined,
      };
    }

    return {
      ...state,
      formattingWarningData: { explodedPromise },
    };
  }

  if (action.type === SHOW_SEND_EDIT_WARNING_MODAL) {
    const { explodedPromise } = action.payload;
    if (!explodedPromise) {
      return {
        ...state,
        sendEditWarningData: undefined,
      };
    }

    return {
      ...state,
      sendEditWarningData: { explodedPromise },
    };
  }

  if (action.type === SHOW_STICKER_PACK_PREVIEW) {
    return {
      ...state,
      stickerPackPreviewId: action.payload,
    };
  }

  if (action.type === CLOSE_ERROR_MODAL) {
    return {
      ...state,
      errorModalProps: undefined,
    };
  }

  if (action.type === SHOW_ERROR_MODAL) {
    return {
      ...state,
      errorModalProps: action.payload,
    };
  }

  if (action.type === CLOSE_SHORTCUT_GUIDE_MODAL) {
    return {
      ...state,
      isShortcutGuideModalVisible: false,
    };
  }

  if (action.type === SHOW_SHORTCUT_GUIDE_MODAL) {
    return {
      ...state,
      isShortcutGuideModalVisible: true,
    };
  }

  if (action.type === CANCEL_AUTH_ART_CREATOR) {
    return {
      ...state,
      authArtCreatorData: undefined,
    };
  }

  if (action.type === SHOW_AUTH_ART_CREATOR) {
    return {
      ...state,
      isAuthorizingArtCreator: false,
      authArtCreatorData: action.payload,
    };
  }

  if (action.type === CONFIRM_AUTH_ART_CREATOR_PENDING) {
    return {
      ...state,
      isAuthorizingArtCreator: true,
    };
  }

  if (action.type === CONFIRM_AUTH_ART_CREATOR_FULFILLED) {
    return {
      ...state,
      isAuthorizingArtCreator: false,
      authArtCreatorData: undefined,
    };
  }

  if (action.type === SHOW_EDIT_HISTORY_MODAL) {
    return {
      ...state,
      editHistoryMessages: action.payload.messages,
    };
  }

  if (action.type === CLOSE_EDIT_HISTORY_MODAL) {
    return {
      ...state,
      editHistoryMessages: undefined,
    };
  }

  if (state.forwardMessagesProps != null) {
    if (action.type === MESSAGE_CHANGED) {
      if (
        !state.forwardMessagesProps.messages.some(message => {
          return message.id === action.payload.id;
        })
      ) {
        return state;
      }

      return {
        ...state,
        forwardMessagesProps: {
          ...state.forwardMessagesProps,
          messages: copyOverMessageAttributesIntoForwardMessages(
            state.forwardMessagesProps.messages,
            action.payload.data
          ),
        },
      };
    }
  }

  if (state.editHistoryMessages != null) {
    if (
      action.type === MESSAGE_CHANGED ||
      action.type === MESSAGE_DELETED ||
      action.type === MESSAGE_EXPIRED
    ) {
      if (action.type === MESSAGE_DELETED || action.type === MESSAGE_EXPIRED) {
        const hasMessageId = state.editHistoryMessages.some(
          edit => edit.id === action.payload.id
        );

        if (!hasMessageId) {
          return state;
        }

        return {
          ...state,
          editHistoryMessages: undefined,
        };
      }

      if (action.type === MESSAGE_CHANGED) {
        if (!action.payload.data.editHistory) {
          return state;
        }

        const hasMessageId = state.editHistoryMessages.some(
          edit => edit.id === action.payload.id
        );

        if (!hasMessageId) {
          return state;
        }

        const nextEditHistoryMessages =
          copyOverMessageAttributesIntoEditHistory(action.payload.data);

        if (!nextEditHistoryMessages) {
          return state;
        }

        return {
          ...state,
          editHistoryMessages: nextEditHistoryMessages,
        };
      }
    }
  }

  return state;
}
