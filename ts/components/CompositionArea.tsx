import * as React from 'react';
import { Editor } from 'draft-js';
import {
  EmojiButton,
  EmojiPickDataType,
  Props as EmojiButtonProps,
} from './emoji/EmojiButton';
import {
  Props as StickerButtonProps,
  StickerButton,
} from './stickers/StickerButton';
import {
  CompositionInput,
  InputApi,
  Props as CompositionInputProps,
} from './CompositionInput';
import { countStickers } from './stickers/lib';
import { LocalizerType } from '../types/Util';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly compositionApi?: React.MutableRefObject<{
    focusInput: () => void;
    setDisabled: (disabled: boolean) => void;
    reset: InputApi['reset'];
    resetEmojiResults: InputApi['resetEmojiResults'];
  }>;
};

export type Props = CompositionInputProps &
  Pick<
    EmojiButtonProps,
    'onPickEmoji' | 'onSetSkinTone' | 'recentEmojis' | 'skinTone'
  > &
  Pick<
    StickerButtonProps,
    | 'knownPacks'
    | 'receivedPacks'
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
  OwnProps;

// tslint:disable-next-line max-func-body-length
export const CompositionArea = ({
  i18n,
  // CompositionInput
  onDirtyChange,
  onSubmit,
  compositionApi,
  onEditorSizeChange,
  onEditorStateChange,
  // EmojiButton
  onPickEmoji,
  onSetSkinTone,
  recentEmojis,
  skinTone,
  // StickerButton
  knownPacks,
  receivedPacks,
  installedPacks,
  blessedPacks,
  recentStickers,
  clearInstalledStickerPack,
  onClickAddPack,
  onPickSticker,
  clearShowIntroduction,
  showPickerHint,
  clearShowPickerHint,
}: Props) => {
  const [disabled, setDisabled] = React.useState(false);
  const editorRef = React.useRef<Editor>(null);
  const inputApiRef = React.useRef<InputApi | undefined>();

  const handleForceSend = React.useCallback(
    () => {
      if (inputApiRef.current) {
        inputApiRef.current.submit();
      }
    },
    [inputApiRef]
  );

  const focusInput = React.useCallback(
    () => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    },
    [editorRef]
  );

  const withStickers =
    countStickers({
      knownPacks,
      blessedPacks,
      installedPacks,
      receivedPacks,
    }) > 0;

  if (compositionApi) {
    compositionApi.current = {
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

  const insertEmoji = React.useCallback(
    (e: EmojiPickDataType) => {
      if (inputApiRef.current) {
        inputApiRef.current.insertEmoji(e);
        onPickEmoji(e);
      }
    },
    [inputApiRef, onPickEmoji]
  );

  return (
    <div className="module-composition-area">
      <div className="module-composition-area__button-cell">
        <EmojiButton
          i18n={i18n}
          doSend={handleForceSend}
          onPickEmoji={insertEmoji}
          recentEmojis={recentEmojis}
          skinTone={skinTone}
          onSetSkinTone={onSetSkinTone}
          onClose={focusInput}
        />
      </div>
      <div className="module-composition-area__input">
        <CompositionInput
          i18n={i18n}
          disabled={disabled}
          editorRef={editorRef}
          inputApi={inputApiRef}
          onPickEmoji={onPickEmoji}
          onSubmit={onSubmit}
          onEditorSizeChange={onEditorSizeChange}
          onEditorStateChange={onEditorStateChange}
          onDirtyChange={onDirtyChange}
          skinTone={skinTone}
        />
      </div>
      {withStickers ? (
        <div className="module-composition-area__button-cell">
          <StickerButton
            i18n={i18n}
            knownPacks={knownPacks}
            receivedPacks={receivedPacks}
            installedPacks={installedPacks}
            blessedPacks={blessedPacks}
            recentStickers={recentStickers}
            clearInstalledStickerPack={clearInstalledStickerPack}
            onClickAddPack={onClickAddPack}
            onPickSticker={onPickSticker}
            clearShowIntroduction={clearShowIntroduction}
            showPickerHint={showPickerHint}
            clearShowPickerHint={clearShowPickerHint}
          />
        </div>
      ) : null}
    </div>
  );
};
