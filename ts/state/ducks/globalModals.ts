// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import type { ExplodePromiseResultType } from '../../util/explodePromise';
import type {
  GroupV2PendingMemberType,
  ReadonlyMessageAttributesType,
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
import * as SingleServePromise from '../../services/singleServePromise';
import * as Stickers from '../../types/Stickers';
import { UsernameOnboardingState } from '../../types/globalModals';
import * as log from '../../logging/log';
import { getMessagePropsSelector } from '../selectors/message';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { longRunningTaskWrapper } from '../../util/longRunningTaskWrapper';
import { useBoundActions } from '../../hooks/useBoundActions';
import { isGroupV1 } from '../../util/whatTypeOfConversation';
import { getGroupMigrationMembers } from '../../groups';
import {
  MESSAGE_CHANGED,
  MESSAGE_DELETED,
  MESSAGE_EXPIRED,
  actions as conversationsActions,
} from './conversations';
import {
  isDownloaded,
  isPermanentlyUndownloadable,
} from '../../types/Attachment';
import type { ButtonVariant } from '../../components/Button';
import type { MessageRequestState } from '../../components/conversation/MessageRequestActionsConfirmation';
import type { MessageForwardDraft } from '../../types/ForwardDraft';
import { hydrateRanges } from '../../types/BodyRange';
import {
  getConversationSelector,
  type GetConversationByIdType,
} from '../selectors/conversations';
import { missingCaseError } from '../../util/missingCaseError';
import { ForwardMessagesModalType } from '../../components/ForwardMessagesModal';
import type { CallLinkType } from '../../types/CallLink';
import type { LocalizerType } from '../../types/I18N';
import { linkCallRoute } from '../../util/signalRoutes';
import type { StartCallData } from '../../components/ConfirmLeaveCallModal';
import { getMessageById } from '../../messages/getMessageById';
import type { AttachmentNotAvailableModalType } from '../../components/AttachmentNotAvailableModal';

// State

export type EditHistoryMessagesType = ReadonlyDeep<
  Array<ReadonlyMessageAttributesType>
>;
export type EditNicknameAndNoteModalPropsType = ReadonlyDeep<{
  conversationId: string;
}>;
export type DeleteMessagesPropsType = ReadonlyDeep<{
  conversationId: string;
  messageIds: ReadonlyArray<string>;
  onDelete?: () => void;
}>;
export type ForwardMessagePropsType = ReadonlyDeep<MessagePropsType>;
export type ForwardMessagesPropsType = ReadonlyDeep<{
  type: ForwardMessagesModalType;
  messageDrafts: Array<MessageForwardDraft>;
  onForward?: () => void;
}>;
export type MessageRequestActionsConfirmationPropsType = ReadonlyDeep<{
  conversationId: string;
  state: MessageRequestState;
}>;
export type NotePreviewModalPropsType = ReadonlyDeep<{
  conversationId: string;
}>;
export type SafetyNumberChangedBlockingDataType = ReadonlyDeep<{
  promiseUuid: SingleServePromise.SingleServePromiseIdString;
  source?: SafetyNumberChangeSource;
}>;

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
  attachmentNotAvailableModalType: AttachmentNotAvailableModalType | undefined;
  callLinkAddNameModalRoomId: string | null;
  callLinkEditModalRoomId: string | null;
  callLinkPendingParticipantContactId: string | undefined;
  confirmLeaveCallModalState: StartCallData | null;
  contactModalState?: ContactModalStateType;
  deleteMessagesProps?: DeleteMessagesPropsType;
  editHistoryMessages?: EditHistoryMessagesType;
  editNicknameAndNoteModalProps: EditNicknameAndNoteModalPropsType | null;
  errorModalProps?: {
    buttonVariant?: ButtonVariant;
    description?: string;
    title?: string | null;
  };
  forwardMessagesProps?: ForwardMessagesPropsType;
  gv2MigrationProps?: MigrateToGV2PropsType;
  hasConfirmationModal: boolean;
  isProfileEditorVisible: boolean;
  isShortcutGuideModalVisible: boolean;
  isSignalConnectionsVisible: boolean;
  isStoriesSettingsVisible: boolean;
  isWhatsNewVisible: boolean;
  messageRequestActionsConfirmationProps: MessageRequestActionsConfirmationPropsType | null;
  notePreviewModalProps: NotePreviewModalPropsType | null;
  usernameOnboardingState: UsernameOnboardingState;
  profileEditorHasError: boolean;
  profileEditorInitialEditState: ProfileEditorEditState | undefined;
  safetyNumberChangedBlockingData?: SafetyNumberChangedBlockingDataType;
  safetyNumberModalContactId?: string;
  stickerPackPreviewId?: string;
  userNotFoundModalState?: UserNotFoundModalStateType;
}>;

// Actions

const SHOW_ATTACHMENT_NOT_AVAILABLE_MODAL =
  'globalModals/SHOW_ATTACHMENT_NOT_AVAILABLE_MODAL';
const HIDE_ATTACHMENT_NOT_AVAILABLE_MODAL =
  'globalModals/HIDE_ATTACHMENT_NOT_AVAILABLE_MODAL';
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
const TOGGLE_NOTE_PREVIEW_MODAL = 'globalModals/TOGGLE_NOTE_PREVIEW_MODAL';
const TOGGLE_PROFILE_EDITOR = 'globalModals/TOGGLE_PROFILE_EDITOR';
export const TOGGLE_PROFILE_EDITOR_ERROR =
  'globalModals/TOGGLE_PROFILE_EDITOR_ERROR';
const TOGGLE_SAFETY_NUMBER_MODAL = 'globalModals/TOGGLE_SAFETY_NUMBER_MODAL';
const TOGGLE_ADD_USER_TO_ANOTHER_GROUP_MODAL =
  'globalModals/TOGGLE_ADD_USER_TO_ANOTHER_GROUP_MODAL';
const TOGGLE_CALL_LINK_ADD_NAME_MODAL =
  'globalModals/TOGGLE_CALL_LINK_ADD_NAME_MODAL';
const TOGGLE_CALL_LINK_EDIT_MODAL = 'globalModals/TOGGLE_CALL_LINK_EDIT_MODAL';
const TOGGLE_CALL_LINK_PENDING_PARTICIPANT_MODAL =
  'globalModals/TOGGLE_CALL_LINK_PENDING_PARTICIPANT_MODAL';
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
const TOGGLE_EDIT_NICKNAME_AND_NOTE_MODAL =
  'globalModals/TOGGLE_EDIT_NICKNAME_AND_NOTE_MODAL';
const TOGGLE_MESSAGE_REQUEST_ACTIONS_CONFIRMATION =
  'globalModals/TOGGLE_MESSAGE_REQUEST_ACTIONS_CONFIRMATION';
const CLOSE_SHORTCUT_GUIDE_MODAL = 'globalModals/CLOSE_SHORTCUT_GUIDE_MODAL';
const SHOW_SHORTCUT_GUIDE_MODAL = 'globalModals/SHOW_SHORTCUT_GUIDE_MODAL';
const TOGGLE_CONFIRMATION_MODAL = 'globalModals/TOGGLE_CONFIRMATION_MODAL';
const SHOW_EDIT_HISTORY_MODAL = 'globalModals/SHOW_EDIT_HISTORY_MODAL';
const CLOSE_EDIT_HISTORY_MODAL = 'globalModals/CLOSE_EDIT_HISTORY_MODAL';
const TOGGLE_USERNAME_ONBOARDING = 'globalModals/TOGGLE_USERNAME_ONBOARDING';
const TOGGLE_CONFIRM_LEAVE_CALL_MODAL =
  'globalModals/TOGGLE_CONFIRM_LEAVE_CALL_MODAL';

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

type HideAttachmentNotAvailableModalActionType = ReadonlyDeep<{
  type: typeof HIDE_ATTACHMENT_NOT_AVAILABLE_MODAL;
}>;

type ShowAttachmentNotAvailableModalActionType = ReadonlyDeep<{
  type: typeof SHOW_ATTACHMENT_NOT_AVAILABLE_MODAL;
  payload: AttachmentNotAvailableModalType;
}>;

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

export type ToggleConfirmLeaveCallModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_CONFIRM_LEAVE_CALL_MODAL;
  payload: StartCallData | null;
}>;

type ToggleNotePreviewModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_NOTE_PREVIEW_MODAL;
  payload: NotePreviewModalPropsType | null;
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

type ToggleCallLinkAddNameModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_CALL_LINK_ADD_NAME_MODAL;
  payload: string | null;
}>;

type ToggleCallLinkEditModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_CALL_LINK_EDIT_MODAL;
  payload: string | null;
}>;

type ToggleCallLinkPendingParticipantModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_CALL_LINK_PENDING_PARTICIPANT_MODAL;
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
    title?: string | null;
  };
}>;

type ToggleEditNicknameAndNoteModalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_EDIT_NICKNAME_AND_NOTE_MODAL;
  payload: EditNicknameAndNoteModalPropsType | null;
}>;

type ToggleMessageRequestActionsConfirmationActionType = ReadonlyDeep<{
  type: typeof TOGGLE_MESSAGE_REQUEST_ACTIONS_CONFIRMATION;
  payload: MessageRequestActionsConfirmationPropsType | null;
}>;

type CloseShortcutGuideModalActionType = ReadonlyDeep<{
  type: typeof CLOSE_SHORTCUT_GUIDE_MODAL;
}>;

type ShowShortcutGuideModalActionType = ReadonlyDeep<{
  type: typeof SHOW_SHORTCUT_GUIDE_MODAL;
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
  | CloseEditHistoryModalActionType
  | CloseErrorModalActionType
  | CloseGV2MigrationDialogActionType
  | CloseShortcutGuideModalActionType
  | CloseStickerPackPreviewActionType
  | HideAttachmentNotAvailableModalActionType
  | HideContactModalActionType
  | HideSendAnywayDialogActiontype
  | HideStoriesSettingsActionType
  | HideUserNotFoundModalActionType
  | HideWhatsNewModalActionType
  | MessageChangedActionType
  | MessageDeletedActionType
  | MessageExpiredActionType
  | ShowAttachmentNotAvailableModalActionType
  | ShowContactModalActionType
  | ShowEditHistoryModalActionType
  | ShowErrorModalActionType
  | ToggleEditNicknameAndNoteModalActionType
  | ToggleMessageRequestActionsConfirmationActionType
  | ShowSendAnywayDialogActionType
  | ShowShortcutGuideModalActionType
  | ShowStickerPackPreviewActionType
  | ShowStoriesSettingsActionType
  | ShowUserNotFoundModalActionType
  | ShowWhatsNewModalActionType
  | StartMigrationToGV2ActionType
  | ToggleAboutContactModalActionType
  | ToggleAddUserToAnotherGroupModalActionType
  | ToggleCallLinkAddNameModalActionType
  | ToggleCallLinkEditModalActionType
  | ToggleCallLinkPendingParticipantModalActionType
  | ToggleConfirmationModalActionType
  | ToggleConfirmLeaveCallModalActionType
  | ToggleDeleteMessagesModalActionType
  | ToggleForwardMessagesModalActionType
  | ToggleNotePreviewModalActionType
  | ToggleProfileEditorActionType
  | ToggleProfileEditorErrorActionType
  | ToggleSafetyNumberModalActionType
  | ToggleSignalConnectionsModalActionType
  | ToggleUsernameOnboardingActionType
>;

// Action Creators

export const actions = {
  closeEditHistoryModal,
  closeErrorModal,
  closeGV2MigrationDialog,
  closeShortcutGuideModal,
  closeStickerPackPreview,
  hideAttachmentNotAvailableModal,
  hideBlockingSafetyNumberChangeDialog,
  hideContactModal,
  hideStoriesSettings,
  hideUserNotFoundModal,
  hideWhatsNewModal,
  showAttachmentNotAvailableModal,
  showBlockingSafetyNumberChangeDialog,
  showContactModal,
  showEditHistoryModal,
  showErrorModal,
  toggleEditNicknameAndNoteModal,
  toggleMessageRequestActionsConfirmation,
  showGV2MigrationDialog,
  showShareCallLinkViaSignal,
  showShortcutGuideModal,
  showStickerPackPreview,
  showStoriesSettings,
  showUserNotFoundModal,
  showWhatsNewModal,
  toggleAboutContactModal,
  toggleAddUserToAnotherGroupModal,
  toggleCallLinkAddNameModal,
  toggleCallLinkEditModal,
  toggleCallLinkPendingParticipantModal,
  toggleConfirmationModal,
  toggleConfirmLeaveCallModal,
  toggleDeleteMessagesModal,
  toggleForwardMessagesModal,
  toggleNotePreviewModal,
  toggleProfileEditor,
  toggleProfileEditorHasError,
  toggleSafetyNumberModal,
  toggleSignalConnectionsModal,
  toggleUsernameOnboarding,
};

export const useGlobalModalActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function hideAttachmentNotAvailableModal(): HideAttachmentNotAvailableModalActionType {
  return {
    type: HIDE_ATTACHMENT_NOT_AVAILABLE_MODAL,
  };
}

function showAttachmentNotAvailableModal(
  payload: AttachmentNotAvailableModalType
): ShowAttachmentNotAvailableModalActionType {
  return {
    type: SHOW_ATTACHMENT_NOT_AVAILABLE_MODAL,
    payload,
  };
}

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

function toMessageForwardDraft(
  props: ForwardMessagePropsType,
  getConversation: GetConversationByIdType
): MessageForwardDraft {
  return {
    attachments: props.attachments ?? [],
    bodyRanges: hydrateRanges(props.bodyRanges, getConversation),
    hasContact: Boolean(props.contact),
    isSticker: Boolean(props.isSticker),
    messageBody: props.text,
    originalMessageId: props.id,
    previews: props.previews ?? [],
  };
}

export type ForwardMessagesPayload = ReadonlyDeep<
  | {
      type: ForwardMessagesModalType.Forward;
      messageIds: ReadonlyArray<string>;
    }
  | {
      type: ForwardMessagesModalType.ShareCallLink;
      draft: MessageForwardDraft;
    }
>;

function toggleForwardMessagesModal(
  payload: ForwardMessagesPayload | null,
  onForward?: () => void
): ThunkAction<
  void,
  RootStateType,
  unknown,
  ToggleForwardMessagesModalActionType
> {
  return async (dispatch, getState) => {
    if (payload == null) {
      dispatch({
        type: TOGGLE_FORWARD_MESSAGES_MODAL,
        payload: undefined,
      });
      return;
    }

    let messageDrafts: ReadonlyArray<MessageForwardDraft>;

    if (payload.type === ForwardMessagesModalType.Forward) {
      messageDrafts = await Promise.all(
        payload.messageIds.map(async messageId => {
          const message = await getMessageById(messageId);
          if (!message) {
            throw new Error(
              'toggleForwardMessagesModal: failed to find target message'
            );
          }
          const { attachments = [] } = message.attributes;

          if (
            !attachments.every(
              attachment =>
                isDownloaded(attachment) ||
                isPermanentlyUndownloadable(attachment)
            )
          ) {
            dispatch(
              conversationsActions.kickOffAttachmentDownload({ messageId })
            );
          }

          const state = getState();
          const messagePropsSelector = getMessagePropsSelector(state);
          const conversationSelector = getConversationSelector(state);

          const messageProps = messagePropsSelector(message.attributes);
          const messageDraft = toMessageForwardDraft(
            {
              ...messageProps,
              attachments: (messageProps.attachments ?? []).filter(
                attachment => !isPermanentlyUndownloadable(attachment)
              ),
            },
            conversationSelector
          );

          return messageDraft;
        })
      );
    } else if (payload.type === ForwardMessagesModalType.ShareCallLink) {
      messageDrafts = [payload.draft];
    } else {
      throw missingCaseError(payload);
    }

    dispatch({
      type: TOGGLE_FORWARD_MESSAGES_MODAL,
      payload: { type: payload.type, messageDrafts, onForward },
    });
  };
}

function showShareCallLinkViaSignal(
  callLink: CallLinkType,
  i18n: LocalizerType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  ToggleForwardMessagesModalActionType
> {
  return dispatch => {
    const url = linkCallRoute
      .toWebUrl({
        key: callLink.rootKey,
      })
      .toString();
    dispatch(
      toggleForwardMessagesModal({
        type: ForwardMessagesModalType.ShareCallLink,
        draft: {
          originalMessageId: null,
          hasContact: false,
          isSticker: false,
          previews: [
            {
              title: callLink.name,
              url,
              isCallLink: true,
            },
          ],
          messageBody: i18n(
            'icu:ShareCallLinkViaSignal__DraftMessageText',
            { url },
            { bidi: 'strip' }
          ),
        },
      })
    );
  };
}

export function toggleConfirmLeaveCallModal(
  payload: StartCallData | null
): ToggleConfirmLeaveCallModalActionType {
  return {
    type: TOGGLE_CONFIRM_LEAVE_CALL_MODAL,
    payload,
  };
}

function toggleNotePreviewModal(
  payload: NotePreviewModalPropsType | null
): ToggleNotePreviewModalActionType {
  return {
    type: TOGGLE_NOTE_PREVIEW_MODAL,
    payload,
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

function toggleCallLinkAddNameModal(
  roomId: string | null
): ToggleCallLinkAddNameModalActionType {
  return {
    type: TOGGLE_CALL_LINK_ADD_NAME_MODAL,
    payload: roomId,
  };
}

function toggleCallLinkEditModal(
  roomId: string | null
): ToggleCallLinkEditModalActionType {
  return {
    type: TOGGLE_CALL_LINK_EDIT_MODAL,
    payload: roomId,
  };
}

function toggleCallLinkPendingParticipantModal(
  contactId?: string
): ToggleCallLinkPendingParticipantModalActionType {
  return {
    type: TOGGLE_CALL_LINK_PENDING_PARTICIPANT_MODAL,
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

function toggleEditNicknameAndNoteModal(
  payload: EditNicknameAndNoteModalPropsType | null
): ToggleEditNicknameAndNoteModalActionType {
  return {
    type: TOGGLE_EDIT_NICKNAME_AND_NOTE_MODAL,
    payload,
  };
}

function toggleMessageRequestActionsConfirmation(
  payload: {
    conversationId: string;
    state: MessageRequestState;
  } | null
): ToggleMessageRequestActionsConfirmationActionType {
  return {
    type: TOGGLE_MESSAGE_REQUEST_ACTIONS_CONFIRMATION,
    payload,
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

function copyOverMessageAttributesIntoEditHistory(
  messageAttributes: ReadonlyDeep<ReadonlyMessageAttributesType>
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
    const message = await getMessageById(messageId);
    if (!message) {
      throw new Error('showEditHistoryModal: failed to find target message');
    }

    const nextEditHistoryMessages = copyOverMessageAttributesIntoEditHistory(
      message.attributes
    );

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

function copyOverMessageAttributesIntoForwardMessages(
  messageDrafts: ReadonlyArray<MessageForwardDraft>,
  attributes: ReadonlyDeep<ReadonlyMessageAttributesType>
): ReadonlyArray<MessageForwardDraft> {
  return messageDrafts.map(messageDraft => {
    if (messageDraft.originalMessageId !== attributes.id) {
      return messageDraft;
    }
    return {
      ...messageDraft,
      attachments: attributes.attachments,
    };
  });
}

// Reducer

export function getEmptyState(): GlobalModalsStateType {
  return {
    attachmentNotAvailableModalType: undefined,
    hasConfirmationModal: false,
    callLinkAddNameModalRoomId: null,
    callLinkEditModalRoomId: null,
    callLinkPendingParticipantContactId: undefined,
    confirmLeaveCallModalState: null,
    editNicknameAndNoteModalProps: null,
    isProfileEditorVisible: false,
    isShortcutGuideModalVisible: false,
    isSignalConnectionsVisible: false,
    isStoriesSettingsVisible: false,
    isWhatsNewVisible: false,
    usernameOnboardingState: UsernameOnboardingState.NeverShown,
    profileEditorHasError: false,
    profileEditorInitialEditState: undefined,
    messageRequestActionsConfirmationProps: null,
    notePreviewModalProps: null,
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

  if (action.type === TOGGLE_CONFIRM_LEAVE_CALL_MODAL) {
    return {
      ...state,
      confirmLeaveCallModalState: action.payload,
    };
  }

  if (action.type === TOGGLE_NOTE_PREVIEW_MODAL) {
    return {
      ...state,
      notePreviewModalProps: action.payload,
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

  if (action.type === HIDE_ATTACHMENT_NOT_AVAILABLE_MODAL) {
    return {
      ...state,
      attachmentNotAvailableModalType: undefined,
    };
  }

  if (action.type === SHOW_ATTACHMENT_NOT_AVAILABLE_MODAL) {
    return {
      ...state,
      attachmentNotAvailableModalType: action.payload,
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

  if (action.type === TOGGLE_CALL_LINK_ADD_NAME_MODAL) {
    return {
      ...state,
      callLinkAddNameModalRoomId: action.payload,
    };
  }

  if (action.type === TOGGLE_CALL_LINK_EDIT_MODAL) {
    return {
      ...state,
      callLinkEditModalRoomId: action.payload,
    };
  }

  if (action.type === TOGGLE_CALL_LINK_PENDING_PARTICIPANT_MODAL) {
    return {
      ...state,
      callLinkPendingParticipantContactId: action.payload,
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

  if (action.type === TOGGLE_EDIT_NICKNAME_AND_NOTE_MODAL) {
    return {
      ...state,
      editNicknameAndNoteModalProps: action.payload,
    };
  }

  if (action.type === TOGGLE_MESSAGE_REQUEST_ACTIONS_CONFIRMATION) {
    return {
      ...state,
      messageRequestActionsConfirmationProps: action.payload,
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
        !state.forwardMessagesProps.messageDrafts.some(message => {
          return message.originalMessageId === action.payload.id;
        })
      ) {
        return state;
      }

      return {
        ...state,
        forwardMessagesProps: {
          ...state.forwardMessagesProps,
          messageDrafts: copyOverMessageAttributesIntoForwardMessages(
            state.forwardMessagesProps.messageDrafts,
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
