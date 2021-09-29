// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { get } from 'lodash';
import classNames from 'classnames';
import type { BodyRangeType, BodyRangesType } from '../types/Util';
import type { ErrorDialogAudioRecorderType } from '../state/ducks/audioRecorder';
import type { HandleAttachmentsProcessingArgsType } from '../util/handleAttachmentsProcessing';
import { Spinner } from './Spinner';
import { EmojiButton, Props as EmojiButtonProps } from './emoji/EmojiButton';
import {
  Props as StickerButtonProps,
  StickerButton,
} from './stickers/StickerButton';
import {
  CompositionInput,
  InputApi,
  Props as CompositionInputProps,
} from './CompositionInput';
import {
  MessageRequestActions,
  Props as MessageRequestActionsProps,
} from './conversation/MessageRequestActions';
import {
  GroupV1DisabledActions,
  PropsType as GroupV1DisabledActionsPropsType,
} from './conversation/GroupV1DisabledActions';
import {
  GroupV2PendingApprovalActions,
  PropsType as GroupV2PendingApprovalActionsPropsType,
} from './conversation/GroupV2PendingApprovalActions';
import { AnnouncementsOnlyGroupBanner } from './AnnouncementsOnlyGroupBanner';
import { AttachmentList } from './conversation/AttachmentList';
import { AttachmentType, isImageAttachment } from '../types/Attachment';
import { AudioCapture } from './conversation/AudioCapture';
import { CompositionUpload } from './CompositionUpload';
import { ConversationType } from '../state/ducks/conversations';
import { EmojiPickDataType } from './emoji/EmojiPicker';
import { LinkPreviewWithDomain } from '../types/LinkPreview';
import { LocalizerType } from '../types/Util';
import { MandatoryProfileSharingActions } from './conversation/MandatoryProfileSharingActions';
import { MediaQualitySelector } from './MediaQualitySelector';
import { Quote, Props as QuoteProps } from './conversation/Quote';
import { StagedLinkPreview } from './conversation/StagedLinkPreview';
import { countStickers } from './stickers/lib';

export type CompositionAPIType = {
  focusInput: () => void;
  isDirty: () => boolean;
  setDisabled: (disabled: boolean) => void;
  reset: InputApi['reset'];
  resetEmojiResults: InputApi['resetEmojiResults'];
};

export type OwnProps = Readonly<{
  acceptedMessageRequest?: boolean;
  addAttachment: (
    conversationId: string,
    attachment: AttachmentType
  ) => unknown;
  addPendingAttachment: (
    conversationId: string,
    pendingAttachment: AttachmentType
  ) => unknown;
  announcementsOnly?: boolean;
  areWeAdmin?: boolean;
  areWePending?: boolean;
  areWePendingApproval?: boolean;
  cancelRecording: () => unknown;
  completeRecording: (
    conversationId: string,
    onSendAudioRecording?: (rec: AttachmentType) => unknown
  ) => unknown;
  compositionApi?: MutableRefObject<CompositionAPIType>;
  conversationId: string;
  draftAttachments: ReadonlyArray<AttachmentType>;
  errorDialogAudioRecorderType?: ErrorDialogAudioRecorderType;
  errorRecording: (e: ErrorDialogAudioRecorderType) => unknown;
  groupAdmins: Array<ConversationType>;
  groupVersion?: 1 | 2;
  i18n: LocalizerType;
  isFetchingUUID?: boolean;
  isGroupV1AndDisabled?: boolean;
  isMissingMandatoryProfileSharing?: boolean;
  isRecording: boolean;
  isSMSOnly?: boolean;
  left?: boolean;
  linkPreviewLoading: boolean;
  linkPreviewResult?: LinkPreviewWithDomain;
  messageRequestsEnabled?: boolean;
  onClearAttachments(): unknown;
  onClickAttachment(): unknown;
  onClickQuotedMessage(): unknown;
  onCloseLinkPreview(): unknown;
  processAttachments: (options: HandleAttachmentsProcessingArgsType) => unknown;
  onSelectMediaQuality(isHQ: boolean): unknown;
  onSendMessage(options: {
    draftAttachments?: ReadonlyArray<AttachmentType>;
    mentions?: BodyRangesType;
    message?: string;
    timestamp?: number;
    voiceNoteAttachment?: AttachmentType;
  }): unknown;
  openConversation(conversationId: string): unknown;
  quotedMessageProps?: Omit<
    QuoteProps,
    'i18n' | 'onClick' | 'onClose' | 'withContentAbove'
  >;
  removeAttachment: (conversationId: string, filePath: string) => unknown;
  setQuotedMessage(message: undefined): unknown;
  shouldSendHighQualityAttachments: boolean;
  startRecording: () => unknown;
}>;

export type Props = Pick<
  CompositionInputProps,
  | 'sortedGroupMembers'
  | 'onEditorStateChange'
  | 'onTextTooLong'
  | 'draftText'
  | 'draftBodyRanges'
  | 'clearQuotedMessage'
  | 'getQuotedMessage'
> &
  Pick<
    EmojiButtonProps,
    'onPickEmoji' | 'onSetSkinTone' | 'recentEmojis' | 'skinTone'
  > &
  Pick<
    StickerButtonProps,
    | 'knownPacks'
    | 'receivedPacks'
    | 'installedPack'
    | 'installedPacks'
    | 'blessedPacks'
    | 'recentStickers'
    | 'clearInstalledStickerPack'
    | 'onClickAddPack'
    | 'onPickSticker'
    | 'clearShowIntroduction'
    | 'showPickerHint'
    | 'clearShowPickerHint'
  > &
  MessageRequestActionsProps &
  Pick<GroupV1DisabledActionsPropsType, 'onStartGroupMigration'> &
  Pick<GroupV2PendingApprovalActionsPropsType, 'onCancelJoinRequest'> &
  OwnProps;

export const CompositionArea = ({
  // Base props
  addAttachment,
  addPendingAttachment,
  conversationId,
  i18n,
  onSendMessage,
  processAttachments,
  removeAttachment,

  // AttachmentList
  draftAttachments,
  onClearAttachments,
  onClickAttachment,
  // AudioCapture
  cancelRecording,
  completeRecording,
  errorDialogAudioRecorderType,
  errorRecording,
  isRecording,
  startRecording,
  // StagedLinkPreview
  linkPreviewLoading,
  linkPreviewResult,
  onCloseLinkPreview,
  // Quote
  quotedMessageProps,
  onClickQuotedMessage,
  setQuotedMessage,
  // MediaQualitySelector
  onSelectMediaQuality,
  shouldSendHighQualityAttachments,
  // CompositionInput
  compositionApi,
  onEditorStateChange,
  onTextTooLong,
  draftText,
  draftBodyRanges,
  clearQuotedMessage,
  getQuotedMessage,
  sortedGroupMembers,
  // EmojiButton
  onPickEmoji,
  onSetSkinTone,
  recentEmojis,
  skinTone,
  // StickerButton
  knownPacks,
  receivedPacks,
  installedPack,
  installedPacks,
  blessedPacks,
  recentStickers,
  clearInstalledStickerPack,
  onClickAddPack,
  onPickSticker,
  clearShowIntroduction,
  showPickerHint,
  clearShowPickerHint,
  // Message Requests
  acceptedMessageRequest,
  areWePending,
  areWePendingApproval,
  conversationType,
  groupVersion,
  isBlocked,
  isMissingMandatoryProfileSharing,
  left,
  messageRequestsEnabled,
  onAccept,
  onBlock,
  onBlockAndReportSpam,
  onDelete,
  onUnblock,
  title,
  // GroupV1 Disabled Actions
  isGroupV1AndDisabled,
  onStartGroupMigration,
  // GroupV2
  announcementsOnly,
  areWeAdmin,
  groupAdmins,
  onCancelJoinRequest,
  openConversation,
  // SMS-only contacts
  isSMSOnly,
  isFetchingUUID,
}: Props): JSX.Element => {
  const [disabled, setDisabled] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [large, setLarge] = useState(false);
  const inputApiRef = useRef<InputApi | undefined>();
  const fileInputRef = useRef<null | HTMLInputElement>(null);

  const handleForceSend = useCallback(() => {
    setLarge(false);
    if (inputApiRef.current) {
      inputApiRef.current.submit();
    }
  }, [inputApiRef, setLarge]);

  const handleSubmit = useCallback(
    (message: string, mentions: Array<BodyRangeType>, timestamp: number) => {
      setLarge(false);
      onSendMessage({
        draftAttachments,
        mentions,
        message,
        timestamp,
      });
    },
    [draftAttachments, onSendMessage, setLarge]
  );

  const launchAttachmentPicker = () => {
    const fileInput = fileInputRef.current;
    if (fileInput) {
      // Setting the value to empty so that onChange always fires in case
      // you add multiple photos.
      fileInput.value = '';
      fileInput.click();
    }
  };

  const focusInput = useCallback(() => {
    if (inputApiRef.current) {
      inputApiRef.current.focus();
    }
  }, [inputApiRef]);

  const withStickers =
    countStickers({
      knownPacks,
      blessedPacks,
      installedPacks,
      receivedPacks,
    }) > 0;

  if (compositionApi) {
    // Using a React.MutableRefObject, so we need to reassign this prop.
    // eslint-disable-next-line no-param-reassign
    compositionApi.current = {
      isDirty: () => dirty,
      focusInput,
      setDisabled,
      reset: () => {
        if (inputApiRef.current) {
          inputApiRef.current.reset();
        }
      },
      resetEmojiResults: () => {
        if (inputApiRef.current) {
          inputApiRef.current.resetEmojiResults();
        }
      },
    };
  }

  const insertEmoji = useCallback(
    (e: EmojiPickDataType) => {
      if (inputApiRef.current) {
        inputApiRef.current.insertEmoji(e);
        onPickEmoji(e);
      }
    },
    [inputApiRef, onPickEmoji]
  );

  const handleToggleLarge = useCallback(() => {
    setLarge(l => !l);
  }, [setLarge]);

  const shouldShowMicrophone = !draftAttachments.length && !draftText;

  const showMediaQualitySelector = draftAttachments.some(isImageAttachment);

  const leftHandSideButtonsFragment = (
    <>
      <div className="CompositionArea__button-cell">
        <EmojiButton
          i18n={i18n}
          doSend={handleForceSend}
          onPickEmoji={insertEmoji}
          onClose={focusInput}
          recentEmojis={recentEmojis}
          skinTone={skinTone}
          onSetSkinTone={onSetSkinTone}
        />
      </div>
      {showMediaQualitySelector ? (
        <div className="CompositionArea__button-cell">
          <MediaQualitySelector
            i18n={i18n}
            isHighQuality={shouldSendHighQualityAttachments}
            onSelectQuality={onSelectMediaQuality}
          />
        </div>
      ) : null}
    </>
  );

  const micButtonFragment = shouldShowMicrophone ? (
    <AudioCapture
      cancelRecording={cancelRecording}
      completeRecording={completeRecording}
      conversationId={conversationId}
      draftAttachments={draftAttachments}
      errorDialogAudioRecorderType={errorDialogAudioRecorderType}
      errorRecording={errorRecording}
      i18n={i18n}
      isRecording={isRecording}
      onSendAudioRecording={(voiceNoteAttachment: AttachmentType) => {
        onSendMessage({ voiceNoteAttachment });
      }}
      startRecording={startRecording}
    />
  ) : null;

  const attButton = (
    <div className="CompositionArea__button-cell">
      <div className="choose-file">
        <button
          type="button"
          className="paperclip thumbnail"
          onClick={launchAttachmentPicker}
          aria-label={i18n('CompositionArea--attach-file')}
        />
      </div>
    </div>
  );

  const sendButtonFragment = (
    <div
      className={classNames(
        'CompositionArea__button-cell',
        large ? 'CompositionArea__button-cell--large-right' : null
      )}
    >
      <button
        type="button"
        className="CompositionArea__send-button"
        onClick={handleForceSend}
        aria-label={i18n('sendMessageToContact')}
      />
    </div>
  );

  const stickerButtonPlacement = large ? 'top-start' : 'top-end';
  const stickerButtonFragment = withStickers ? (
    <div className="CompositionArea__button-cell">
      <StickerButton
        i18n={i18n}
        knownPacks={knownPacks}
        receivedPacks={receivedPacks}
        installedPack={installedPack}
        installedPacks={installedPacks}
        blessedPacks={blessedPacks}
        recentStickers={recentStickers}
        clearInstalledStickerPack={clearInstalledStickerPack}
        onClickAddPack={onClickAddPack}
        onPickSticker={onPickSticker}
        clearShowIntroduction={clearShowIntroduction}
        showPickerHint={showPickerHint}
        clearShowPickerHint={clearShowPickerHint}
        position={stickerButtonPlacement}
      />
    </div>
  ) : null;

  // Listen for cmd/ctrl-shift-x to toggle large composition mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { key, shiftKey, ctrlKey, metaKey } = e;
      // When using the ctrl key, `key` is `'X'`. When using the cmd key, `key` is `'x'`
      const xKey = key === 'x' || key === 'X';
      const commandKey = get(window, 'platform') === 'darwin' && metaKey;
      const controlKey = get(window, 'platform') !== 'darwin' && ctrlKey;
      const commandOrCtrl = commandKey || controlKey;

      // cmd/ctrl-shift-x
      if (xKey && shiftKey && commandOrCtrl) {
        e.preventDefault();
        setLarge(x => !x);
      }
    };

    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [setLarge]);

  if (
    isBlocked ||
    areWePending ||
    (messageRequestsEnabled && !acceptedMessageRequest)
  ) {
    return (
      <MessageRequestActions
        i18n={i18n}
        conversationType={conversationType}
        isBlocked={isBlocked}
        onBlock={onBlock}
        onBlockAndReportSpam={onBlockAndReportSpam}
        onUnblock={onUnblock}
        onDelete={onDelete}
        onAccept={onAccept}
        title={title}
      />
    );
  }

  if (conversationType === 'direct' && isSMSOnly) {
    return (
      <div
        className={classNames([
          'CompositionArea',
          'CompositionArea--sms-only',
          isFetchingUUID ? 'CompositionArea--pending' : null,
        ])}
      >
        {isFetchingUUID ? (
          <Spinner
            ariaLabel={i18n('CompositionArea--sms-only__spinner-label')}
            role="presentation"
            moduleClassName="module-image-spinner"
            svgSize="small"
          />
        ) : (
          <>
            <h2 className="CompositionArea--sms-only__title">
              {i18n('CompositionArea--sms-only__title')}
            </h2>
            <p className="CompositionArea--sms-only__body">
              {i18n('CompositionArea--sms-only__body')}
            </p>
          </>
        )}
      </div>
    );
  }

  // If no message request, but we haven't shared profile yet, we show profile-sharing UI
  if (
    !left &&
    (conversationType === 'direct' ||
      (conversationType === 'group' && groupVersion === 1)) &&
    isMissingMandatoryProfileSharing
  ) {
    return (
      <MandatoryProfileSharingActions
        i18n={i18n}
        conversationType={conversationType}
        onBlock={onBlock}
        onBlockAndReportSpam={onBlockAndReportSpam}
        onDelete={onDelete}
        onAccept={onAccept}
        title={title}
      />
    );
  }

  // If this is a V1 group, now disabled entirely, we show UI to help them upgrade
  if (!left && isGroupV1AndDisabled) {
    return (
      <GroupV1DisabledActions
        i18n={i18n}
        onStartGroupMigration={onStartGroupMigration}
      />
    );
  }

  if (areWePendingApproval) {
    return (
      <GroupV2PendingApprovalActions
        i18n={i18n}
        onCancelJoinRequest={onCancelJoinRequest}
      />
    );
  }

  if (announcementsOnly && !areWeAdmin) {
    return (
      <AnnouncementsOnlyGroupBanner
        groupAdmins={groupAdmins}
        i18n={i18n}
        openConversation={openConversation}
      />
    );
  }

  return (
    <div className="CompositionArea">
      <div className="CompositionArea__toggle-large">
        <button
          type="button"
          className={classNames(
            'CompositionArea__toggle-large__button',
            large ? 'CompositionArea__toggle-large__button--large-active' : null
          )}
          // This prevents the user from tabbing here
          tabIndex={-1}
          onClick={handleToggleLarge}
          aria-label={i18n('CompositionArea--expand')}
        />
      </div>
      <div
        className={classNames(
          'CompositionArea__row',
          'CompositionArea__row--column'
        )}
      >
        {quotedMessageProps && (
          <div className="quote-wrapper">
            <Quote
              {...quotedMessageProps}
              i18n={i18n}
              onClick={onClickQuotedMessage}
              onClose={() => {
                // This one is for redux...
                setQuotedMessage(undefined);
                // and this is for conversation_view.
                clearQuotedMessage();
              }}
              withContentAbove
            />
          </div>
        )}
        {linkPreviewLoading && (
          <div className="preview-wrapper">
            <StagedLinkPreview
              {...(linkPreviewResult || {})}
              i18n={i18n}
              onClose={onCloseLinkPreview}
            />
          </div>
        )}
        {draftAttachments.length ? (
          <div className="CompositionArea__attachment-list">
            <AttachmentList
              attachments={draftAttachments}
              i18n={i18n}
              onAddAttachment={launchAttachmentPicker}
              onClickAttachment={onClickAttachment}
              onClose={onClearAttachments}
              onCloseAttachment={attachment => {
                if (attachment.path) {
                  removeAttachment(conversationId, attachment.path);
                }
              }}
            />
          </div>
        ) : null}
      </div>
      <div
        className={classNames(
          'CompositionArea__row',
          large ? 'CompositionArea__row--padded' : null
        )}
      >
        {!large ? leftHandSideButtonsFragment : null}
        <div className="CompositionArea__input">
          <CompositionInput
            i18n={i18n}
            disabled={disabled}
            large={large}
            inputApi={inputApiRef}
            onPickEmoji={onPickEmoji}
            onSubmit={handleSubmit}
            onEditorStateChange={onEditorStateChange}
            onTextTooLong={onTextTooLong}
            onDirtyChange={setDirty}
            skinTone={skinTone}
            draftText={draftText}
            draftBodyRanges={draftBodyRanges}
            clearQuotedMessage={clearQuotedMessage}
            getQuotedMessage={getQuotedMessage}
            sortedGroupMembers={sortedGroupMembers}
          />
        </div>
        {!large ? (
          <>
            {stickerButtonFragment}
            {!dirty ? micButtonFragment : null}
            {attButton}
          </>
        ) : null}
      </div>
      {large ? (
        <div
          className={classNames(
            'CompositionArea__row',
            'CompositionArea__row--control-row'
          )}
        >
          {leftHandSideButtonsFragment}
          {stickerButtonFragment}
          {attButton}
          {!dirty ? micButtonFragment : null}
          {dirty || !shouldShowMicrophone ? sendButtonFragment : null}
        </div>
      ) : null}
      <CompositionUpload
        addAttachment={addAttachment}
        addPendingAttachment={addPendingAttachment}
        conversationId={conversationId}
        draftAttachments={draftAttachments}
        i18n={i18n}
        processAttachments={processAttachments}
        removeAttachment={removeAttachment}
        ref={fileInputRef}
      />
    </div>
  );
};
