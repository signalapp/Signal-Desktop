// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { get, noop } from 'lodash';
import classNames from 'classnames';
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
import { MandatoryProfileSharingActions } from './conversation/MandatoryProfileSharingActions';
import { countStickers } from './stickers/lib';
import { LocalizerType } from '../types/Util';
import { EmojiPickDataType } from './emoji/EmojiPicker';
import { AttachmentType, isImageAttachment } from '../types/Attachment';
import { AttachmentList } from './conversation/AttachmentList';
import { MediaQualitySelector } from './MediaQualitySelector';
import { Quote, Props as QuoteProps } from './conversation/Quote';
import { StagedLinkPreview } from './conversation/StagedLinkPreview';
import { LinkPreviewWithDomain } from '../types/LinkPreview';
import { ConversationType } from '../state/ducks/conversations';
import { AnnouncementsOnlyGroupBanner } from './AnnouncementsOnlyGroupBanner';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly areWePending?: boolean;
  readonly areWePendingApproval?: boolean;
  readonly announcementsOnly?: boolean;
  readonly areWeAdmin?: boolean;
  readonly groupAdmins: Array<ConversationType>;
  readonly groupVersion?: 1 | 2;
  readonly isGroupV1AndDisabled?: boolean;
  readonly isMissingMandatoryProfileSharing?: boolean;
  readonly isSMSOnly?: boolean;
  readonly isFetchingUUID?: boolean;
  readonly left?: boolean;
  readonly messageRequestsEnabled?: boolean;
  readonly acceptedMessageRequest?: boolean;
  readonly compositionApi?: React.MutableRefObject<{
    focusInput: () => void;
    isDirty: () => boolean;
    setDisabled: (disabled: boolean) => void;
    setShowMic: (showMic: boolean) => void;
    setMicActive: (micActive: boolean) => void;
    reset: InputApi['reset'];
    resetEmojiResults: InputApi['resetEmojiResults'];
  }>;
  readonly micCellEl?: HTMLElement;
  readonly draftAttachments: Array<AttachmentType>;
  readonly shouldSendHighQualityAttachments: boolean;
  onChooseAttachment(): unknown;
  onAddAttachment(): unknown;
  onClickAttachment(): unknown;
  onCloseAttachment(): unknown;
  onClearAttachments(): unknown;
  onSelectMediaQuality(isHQ: boolean): unknown;
  readonly quotedMessageProps?: QuoteProps;
  onClickQuotedMessage(): unknown;
  setQuotedMessage(message: undefined): unknown;
  linkPreviewLoading: boolean;
  linkPreviewResult?: LinkPreviewWithDomain;
  onCloseLinkPreview(): unknown;
  openConversation(conversationId: string): unknown;
};

export type Props = Pick<
  CompositionInputProps,
  | 'sortedGroupMembers'
  | 'onSubmit'
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

const emptyElement = (el: HTMLElement) => {
  // Necessary to deal with Backbone views
  // eslint-disable-next-line no-param-reassign
  el.innerHTML = '';
};

export const CompositionArea = ({
  i18n,
  micCellEl,
  onChooseAttachment,
  // AttachmentList
  draftAttachments,
  onAddAttachment,
  onClearAttachments,
  onClickAttachment,
  onCloseAttachment,
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
  onSubmit,
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
  name,
  onAccept,
  onBlock,
  onBlockAndReportSpam,
  onDelete,
  onUnblock,
  phoneNumber,
  profileName,
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
  const [disabled, setDisabled] = React.useState(false);
  const [showMic, setShowMic] = React.useState(!draftText);
  const [micActive, setMicActive] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [large, setLarge] = React.useState(false);
  const inputApiRef = React.useRef<InputApi | undefined>();

  const handleForceSend = React.useCallback(() => {
    setLarge(false);
    if (inputApiRef.current) {
      inputApiRef.current.submit();
    }
  }, [inputApiRef, setLarge]);

  const handleSubmit = React.useCallback<typeof onSubmit>(
    (...args) => {
      setLarge(false);
      onSubmit(...args);
    },
    [setLarge, onSubmit]
  );

  const focusInput = React.useCallback(() => {
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
      setShowMic,
      setMicActive,
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

  const insertEmoji = React.useCallback(
    (e: EmojiPickDataType) => {
      if (inputApiRef.current) {
        inputApiRef.current.insertEmoji(e);
        onPickEmoji(e);
      }
    },
    [inputApiRef, onPickEmoji]
  );

  const handleToggleLarge = React.useCallback(() => {
    setLarge(l => !l);
  }, [setLarge]);

  // The following is a work-around to allow react to lay-out backbone-managed
  // dom nodes until those functions are in React
  const micCellRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const { current: micCellContainer } = micCellRef;
    if (micCellContainer && micCellEl) {
      emptyElement(micCellContainer);
      micCellContainer.appendChild(micCellEl);
    }

    return noop;
  }, [micCellRef, micCellEl, large, dirty, showMic]);

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

  const micButtonFragment = showMic ? (
    <div
      className={classNames(
        'CompositionArea__button-cell',
        micActive ? 'CompositionArea__button-cell--mic-active' : null,
        large ? 'CompositionArea__button-cell--large-right' : null,
        micActive && large
          ? 'CompositionArea__button-cell--large-right-mic-active'
          : null
      )}
      ref={micCellRef}
    />
  ) : null;

  const attButton = (
    <div className="CompositionArea__button-cell">
      <div className="choose-file">
        <button
          type="button"
          className="paperclip thumbnail"
          onClick={onChooseAttachment}
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
  React.useEffect(() => {
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
        name={name}
        profileName={profileName}
        phoneNumber={phoneNumber}
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
        name={name}
        profileName={profileName}
        phoneNumber={phoneNumber}
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
              onAddAttachment={onAddAttachment}
              onClickAttachment={onClickAttachment}
              onClose={onClearAttachments}
              onCloseAttachment={onCloseAttachment}
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
          {dirty || !showMic ? sendButtonFragment : null}
        </div>
      ) : null}
    </div>
  );
};
