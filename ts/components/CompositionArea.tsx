import * as React from 'react';
import { Editor } from 'draft-js';
import { get, noop } from 'lodash';
import classNames from 'classnames';
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
import { countStickers } from './stickers/lib';
import { LocalizerType } from '../types/Util';
import { EmojiPickDataType } from './emoji/EmojiPicker';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly messageRequestsEnabled?: boolean;
  readonly acceptedMessageRequest?: boolean;
  readonly compositionApi?: React.MutableRefObject<{
    focusInput: () => void;
    isDirty: () => boolean;
    setDisabled: (disabled: boolean) => void;
    setShowMic: (showMic: boolean) => void;
    setMicActive: (micActive: boolean) => void;
    attSlotRef: React.RefObject<HTMLDivElement>;
    reset: InputApi['reset'];
    resetEmojiResults: InputApi['resetEmojiResults'];
  }>;
  readonly micCellEl?: HTMLElement;
  readonly attCellEl?: HTMLElement;
  readonly attachmentListEl?: HTMLElement;
  onChooseAttachment(): unknown;
};

export type Props = Pick<
  CompositionInputProps,
  | 'onSubmit'
  | 'onEditorSizeChange'
  | 'onEditorStateChange'
  | 'onTextTooLong'
  | 'startingText'
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
  OwnProps;

const emptyElement = (el: HTMLElement) => {
  // Necessary to deal with Backbone views
  // eslint-disable-next-line no-param-reassign
  el.innerHTML = '';
};

export const CompositionArea = ({
  i18n,
  attachmentListEl,
  micCellEl,
  onChooseAttachment,
  // CompositionInput
  onSubmit,
  compositionApi,
  onEditorSizeChange,
  onEditorStateChange,
  onTextTooLong,
  startingText,
  clearQuotedMessage,
  getQuotedMessage,
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
  conversationType,
  isBlocked,
  messageRequestsEnabled,
  name,
  onAccept,
  onBlock,
  onBlockAndDelete,
  onDelete,
  onUnblock,
  phoneNumber,
  profileName,
  title,
}: Props): JSX.Element => {
  const [disabled, setDisabled] = React.useState(false);
  const [showMic, setShowMic] = React.useState(!startingText);
  const [micActive, setMicActive] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [large, setLarge] = React.useState(false);
  const editorRef = React.useRef<Editor>(null);
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
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [editorRef]);

  const withStickers =
    countStickers({
      knownPacks,
      blessedPacks,
      installedPacks,
      receivedPacks,
    }) > 0;

  // A ref to grab a slot where backbone can insert link previews and attachments
  const attSlotRef = React.useRef<HTMLDivElement>(null);

  if (compositionApi) {
    // Using a React.MutableRefObject, so we need to reassign this prop.
    // eslint-disable-next-line no-param-reassign
    compositionApi.current = {
      isDirty: () => dirty,
      focusInput,
      setDisabled,
      setShowMic,
      setMicActive,
      attSlotRef,
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

  React.useLayoutEffect(() => {
    const { current: attSlot } = attSlotRef;
    if (attSlot && attachmentListEl) {
      attSlot.appendChild(attachmentListEl);
    }

    return noop;
  }, [attSlotRef, attachmentListEl]);

  const emojiButtonFragment = (
    <div className="module-composition-area__button-cell">
      <EmojiButton
        i18n={i18n}
        doSend={handleForceSend}
        onPickEmoji={insertEmoji}
        recentEmojis={recentEmojis}
        skinTone={skinTone}
        onSetSkinTone={onSetSkinTone}
      />
    </div>
  );

  const micButtonFragment = showMic ? (
    <div
      className={classNames(
        'module-composition-area__button-cell',
        micActive ? 'module-composition-area__button-cell--mic-active' : null,
        large ? 'module-composition-area__button-cell--large-right' : null,
        micActive && large
          ? 'module-composition-area__button-cell--large-right-mic-active'
          : null
      )}
      ref={micCellRef}
    />
  ) : null;

  const attButton = (
    <div className="module-composition-area__button-cell">
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
        'module-composition-area__button-cell',
        large ? 'module-composition-area__button-cell--large-right' : null
      )}
    >
      <button
        type="button"
        className="module-composition-area__send-button"
        onClick={handleForceSend}
        aria-label={i18n('sendMessageToContact')}
      />
    </div>
  );

  const stickerButtonPlacement = large ? 'top-start' : 'top-end';
  const stickerButtonFragment = withStickers ? (
    <div className="module-composition-area__button-cell">
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

  if ((!acceptedMessageRequest || isBlocked) && messageRequestsEnabled) {
    return (
      <MessageRequestActions
        i18n={i18n}
        conversationType={conversationType}
        isBlocked={isBlocked}
        onBlock={onBlock}
        onBlockAndDelete={onBlockAndDelete}
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

  return (
    <div className="module-composition-area">
      <div className="module-composition-area__toggle-large">
        <button
          type="button"
          className={classNames(
            'module-composition-area__toggle-large__button',
            large
              ? 'module-composition-area__toggle-large__button--large-active'
              : null
          )}
          // This prevents the user from tabbing here
          tabIndex={-1}
          onClick={handleToggleLarge}
          aria-label={i18n('CompositionArea--expand')}
        />
      </div>
      <div
        className={classNames(
          'module-composition-area__row',
          'module-composition-area__row--column'
        )}
        ref={attSlotRef}
      />
      <div
        className={classNames(
          'module-composition-area__row',
          large ? 'module-composition-area__row--padded' : null
        )}
      >
        {!large ? emojiButtonFragment : null}
        <div className="module-composition-area__input">
          <CompositionInput
            i18n={i18n}
            disabled={disabled}
            large={large}
            editorRef={editorRef}
            inputApi={inputApiRef}
            onPickEmoji={onPickEmoji}
            onSubmit={handleSubmit}
            onEditorSizeChange={onEditorSizeChange}
            onEditorStateChange={onEditorStateChange}
            onTextTooLong={onTextTooLong}
            onDirtyChange={setDirty}
            skinTone={skinTone}
            startingText={startingText}
            clearQuotedMessage={clearQuotedMessage}
            getQuotedMessage={getQuotedMessage}
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
            'module-composition-area__row',
            'module-composition-area__row--control-row'
          )}
        >
          {emojiButtonFragment}
          {stickerButtonFragment}
          {attButton}
          {!dirty ? micButtonFragment : null}
          {dirty || !showMic ? sendButtonFragment : null}
        </div>
      ) : null}
    </div>
  );
};
