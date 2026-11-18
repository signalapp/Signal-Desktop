// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type JSX,
} from 'react';
import classNames from 'classnames';
import { Popover } from 'radix-ui';
import { FocusScope } from 'radix-ui/internal';
import { tinykeys } from 'tinykeys';
import type { LinkPreviewForUIType } from '../types/message/LinkPreviews.std.ts';
import { ThemeType, type LocalizerType } from '../types/Util.std.ts';
import type { TextAttachmentType } from '../types/Attachment.std.ts';
import { Button, ButtonVariant } from './Button.dom.tsx';
import { AxoDropdownMenu } from '../axo/menus/AxoDropdownMenu.dom.tsx';
import { LinkPreviewSourceType, findLinks } from '../types/LinkPreview.std.ts';
import type { MaybeGrabLinkPreviewOptionsType } from '../types/LinkPreview.std.ts';
import { Input } from './Input.dom.tsx';
import { Slider } from './Slider.dom.tsx';
import { StoryLinkPreview } from './StoryLinkPreview.dom.tsx';
import { TextAttachment } from './TextAttachment.dom.tsx';
import { Theme, themeClassName } from '../util/theme.std.ts';
import { getRGBA, getRGBANumber } from '../mediaEditor/util/color.std.ts';
import {
  COLOR_BLACK_INT,
  COLOR_WHITE_INT,
  getBackgroundColor,
} from '../util/getStoryBackground.std.ts';
import { objectMap } from '../util/objectMap.std.ts';
import { Spinner } from './Spinner.dom.tsx';
import { FunEmojiPicker } from './fun/FunEmojiPicker.dom.tsx';
import type { FunEmojiSelection } from './fun/panels/FunPanelEmojis.dom.tsx';
import { FunEmojiPickerButton } from './fun/FunButton.dom.tsx';
import { useConfirmDiscard } from '../hooks/useConfirmDiscard.dom.tsx';
import { AxoTheme } from '../axo/AxoTheme.dom.tsx';
import { missingCaseError } from '../util/missingCaseError.std.ts';

export type PropsType = {
  /** A legacy modal is open on top, so focus must be able to leave */
  isCoveredByModal: boolean;
  debouncedMaybeGrabLinkPreview: (
    message: string,
    source: LinkPreviewSourceType,
    options?: MaybeGrabLinkPreviewOptionsType
  ) => unknown;
  i18n: LocalizerType;
  isSending: boolean;
  linkPreview?: LinkPreviewForUIType;
  onClose: () => unknown;
  onDone: (textAttachment: TextAttachmentType) => unknown;
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => unknown;
};

enum LinkPreviewApplied {
  None = 'None',
  Automatic = 'Automatic',
  Manual = 'Manual',
}

enum TextStyle {
  Default,
  Regular,
  Bold,
  Serif,
  Script,
  Condensed,
}

enum TextBackground {
  None,
  Background,
  Inverse,
}

const BackgroundStyle = {
  BG1: { color: 4285041620 },
  BG2: { color: 4287006657 },
  BG3: { color: 4290019212 },
  BG4: { color: 4287205768 },
  BG5: { color: 4283667331 },
  BG6: {
    angle: 180,
    colors: [0xff19a9fa, 0xff7097d7, 0xffd1998d, 0xffffc369],
    positions: [0, 0.33, 0.66, 1],
  },
  BG7: {
    angle: 180,
    colors: [0xff4437d8, 0xff6b70de, 0xffb774e0, 0xffff8e8e],
    positions: [0, 0.33, 0.66, 1],
  },
  BG8: {
    angle: 180,
    colors: [0xff004044, 0xff2c5f45, 0xff648e52, 0xff93b864],
    positions: [0, 0.33, 0.66, 1],
  },
};

type BackgroundStyleType =
  (typeof BackgroundStyle)[keyof typeof BackgroundStyle];

function getBackground(
  bgStyle: BackgroundStyleType
): Pick<TextAttachmentType, 'color' | 'gradient'> {
  if ('color' in bgStyle) {
    return { color: bgStyle.color };
  }

  const { angle, colors, positions } = bgStyle;

  return {
    gradient: {
      angle,
      startColor: colors.at(0),
      endColor: colors.at(-1),
      colors,
      positions,
    },
  };
}

function getBgButtonAriaLabel(
  i18n: LocalizerType,
  textBackground: TextBackground
): string {
  if (textBackground === TextBackground.Background) {
    return i18n('icu:StoryCreator__text-bg--background');
  }

  if (textBackground === TextBackground.Inverse) {
    return i18n('icu:StoryCreator__text-bg--inverse');
  }

  return i18n('icu:StoryCreator__text-bg--none');
}

function getTextStyleLabel(i18n: LocalizerType, textStyle: TextStyle): string {
  switch (textStyle) {
    case TextStyle.Bold:
      return i18n('icu:StoryCreator__text--bold');
    case TextStyle.Serif:
      return i18n('icu:StoryCreator__text--serif');
    case TextStyle.Script:
      return i18n('icu:StoryCreator__text--script');
    case TextStyle.Condensed:
      return i18n('icu:StoryCreator__text--condensed');
    case TextStyle.Default:
    case TextStyle.Regular:
      return i18n('icu:StoryCreator__text--regular');
    default:
      throw missingCaseError(textStyle);
  }
}

export function TextStoryCreator({
  debouncedMaybeGrabLinkPreview,
  i18n,
  isCoveredByModal,
  isSending,
  linkPreview,
  onClose,
  onDone,
  onSelectEmoji,
}: PropsType): JSX.Element {
  const tryClose = useRef<(() => void) | null>(null);
  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard({
    i18n,
    name: 'TextStoryCreator',
    tryClose,
    // @ts-expect-error ConfirmationDialog migration: Needs title
    title: null,
    // @ts-expect-error ConfirmationDialog migration: Needs description
    description: null,
  });
  const onTryClose = useCallback(() => {
    confirmDiscardIf(true, onClose);
  }, [confirmDiscardIf, onClose]);
  // oxlint-disable-next-line react/refs
  tryClose.current = onTryClose;

  const [isEditingText, setIsEditingText] = useState(false);
  const [selectedBackground, setSelectedBackground] =
    useState<BackgroundStyleType>(BackgroundStyle.BG1);
  const [textStyle, setTextStyle] = useState<TextStyle>(TextStyle.Regular);
  const [textBackground, setTextBackground] = useState<TextBackground>(
    TextBackground.None
  );
  const [sliderValue, setSliderValue] = useState<number>(100);
  const [text, setText] = useState<string>('');

  const [isColorPickerShowing, setIsColorPickerShowing] = useState(false);

  const [linkPreviewApplied, setLinkPreviewApplied] = useState(
    LinkPreviewApplied.None
  );
  const hasLinkPreviewApplied = linkPreviewApplied !== LinkPreviewApplied.None;
  const [linkPreviewInputValue, setLinkPreviewInputValue] = useState('');

  useEffect(() => {
    if (!linkPreviewInputValue) {
      return;
    }
    if (linkPreviewApplied === LinkPreviewApplied.Manual) {
      return;
    }
    debouncedMaybeGrabLinkPreview(
      linkPreviewInputValue,
      LinkPreviewSourceType.StoryCreator,
      {
        mode: 'story',
      }
    );
  }, [
    debouncedMaybeGrabLinkPreview,
    linkPreviewApplied,
    linkPreviewInputValue,
  ]);

  useEffect(() => {
    if (!text) {
      return;
    }
    if (linkPreviewApplied === LinkPreviewApplied.Manual) {
      return;
    }
    debouncedMaybeGrabLinkPreview(text, LinkPreviewSourceType.StoryCreator);
  }, [debouncedMaybeGrabLinkPreview, linkPreviewApplied, text]);

  useEffect(() => {
    if (!linkPreview || !text) {
      return;
    }

    const links = findLinks(text);

    const shouldApplyLinkPreview = links.includes(linkPreview.url);
    // oxlint-disable-next-line react/set-state-in-effect
    setLinkPreviewApplied(oldValue => {
      if (oldValue === LinkPreviewApplied.Manual) {
        return oldValue;
      }
      if (shouldApplyLinkPreview) {
        return LinkPreviewApplied.Automatic;
      }
      return LinkPreviewApplied.None;
    });
  }, [linkPreview, text]);

  const [isLinkPreviewInputShowing, setIsLinkPreviewInputShowing] =
    useState(false);

  const onEscapeShortcut = useEffectEvent((event: KeyboardEvent) => {
    // Runs before Radix's Escape handling, so let open layers close first
    if (
      event.target instanceof Element &&
      event.target.closest('[data-radix-popper-content-wrapper]') != null
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (isColorPickerShowing || isEditingText || isLinkPreviewInputShowing) {
      setIsColorPickerShowing(false);
      setIsEditingText(false);
      setIsLinkPreviewInputShowing(false);
    } else {
      onTryClose();
    }
  });

  useEffect(() => {
    return tinykeys(
      document,
      {
        Escape: onEscapeShortcut,
      },
      {
        capture: true,
        // Override default ignore so shortcuts work while textboxes are focused
        ignore: () => false,
      }
    );
  }, []);

  const sliderColorNumber = getRGBANumber(sliderValue);

  let textForegroundColor = sliderColorNumber;
  let textBackgroundColor: number | undefined;

  if (textBackground === TextBackground.Background) {
    textBackgroundColor = COLOR_WHITE_INT;
    textForegroundColor =
      sliderValue >= 95 ? COLOR_BLACK_INT : sliderColorNumber;
  } else if (textBackground === TextBackground.Inverse) {
    textBackgroundColor =
      sliderValue >= 95 ? COLOR_BLACK_INT : sliderColorNumber;
    textForegroundColor = COLOR_WHITE_INT;
  }

  const textAttachment: TextAttachmentType = {
    ...getBackground(selectedBackground),
    text,
    textStyle,
    textForegroundColor,
    textBackgroundColor,
    preview: hasLinkPreviewApplied ? linkPreview : undefined,
  };

  const hasChanges = Boolean(text || hasLinkPreviewApplied);

  const textEditorRef = useRef<HTMLTextAreaElement | null>(null);

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const handleEmojiPickerOpenChange = useCallback((open: boolean) => {
    setEmojiPickerOpen(open);
  }, []);

  const handleSelectEmoji = useCallback(
    (emojiSelection: FunEmojiSelection) => {
      const { emoji } = emojiSelection;

      onSelectEmoji(emojiSelection);

      setText(originalText => {
        const insertAt =
          textEditorRef.current?.selectionEnd ?? originalText.length;

        const before = originalText.substr(0, insertAt);
        const after = originalText.substr(insertAt, originalText.length);

        return `${before}${emoji}${after}`;
      });
    },
    [onSelectEmoji]
  );

  return (
    <AxoTheme.Override theme="force-dark">
      <FocusScope.Root asChild trapped={!isCoveredByModal} loop>
        <div className="StoryCreator dark-theme">
          <div className="StoryCreator__container">
            <TextAttachment
              disableLinkPreviewPopup
              i18n={i18n}
              isEditingText={isEditingText}
              onChange={setText}
              onClick={() => {
                if (!isEditingText) {
                  setIsEditingText(true);
                }
              }}
              onRemoveLinkPreview={() => {
                setLinkPreviewApplied(LinkPreviewApplied.None);
              }}
              ref={textEditorRef}
              textAttachment={textAttachment}
            />
          </div>
          <div className="StoryCreator__toolbar">
            {isEditingText ? (
              <div className="StoryCreator__tools">
                <Slider
                  handleStyle={{ backgroundColor: getRGBA(sliderValue) }}
                  label={getRGBA(sliderValue)}
                  className="HueSlider StoryCreator__tools__tool"
                  onChange={setSliderValue}
                  value={sliderValue}
                />
                <AxoDropdownMenu.Root>
                  <AxoDropdownMenu.Trigger>
                    <button
                      type="button"
                      aria-label={getTextStyleLabel(i18n, textStyle)}
                      className="StoryCreator__tools__icon-button"
                    >
                      <span
                        aria-hidden
                        className={classNames(
                          'StoryCreator__tools__icon-button-icon',
                          {
                            'StoryCreator__tools__button--font-regular':
                              textStyle === TextStyle.Regular,
                            'StoryCreator__tools__button--font-bold':
                              textStyle === TextStyle.Bold,
                            'StoryCreator__tools__button--font-serif':
                              textStyle === TextStyle.Serif,
                            'StoryCreator__tools__button--font-script':
                              textStyle === TextStyle.Script,
                            'StoryCreator__tools__button--font-condensed':
                              textStyle === TextStyle.Condensed,
                          }
                        )}
                      />
                    </button>
                  </AxoDropdownMenu.Trigger>
                  <AxoDropdownMenu.Content>
                    <AxoDropdownMenu.RadioGroup
                      value={`${textStyle}`}
                      onValueChange={value => setTextStyle(parseInt(value, 10))}
                    >
                      <AxoDropdownMenu.RadioItem value={`${TextStyle.Regular}`}>
                        {i18n('icu:StoryCreator__text--regular')}
                      </AxoDropdownMenu.RadioItem>
                      <AxoDropdownMenu.RadioItem value={`${TextStyle.Bold}`}>
                        {i18n('icu:StoryCreator__text--bold')}
                      </AxoDropdownMenu.RadioItem>
                      <AxoDropdownMenu.RadioItem value={`${TextStyle.Serif}`}>
                        {i18n('icu:StoryCreator__text--serif')}
                      </AxoDropdownMenu.RadioItem>
                      <AxoDropdownMenu.RadioItem value={`${TextStyle.Script}`}>
                        {i18n('icu:StoryCreator__text--script')}
                      </AxoDropdownMenu.RadioItem>
                      <AxoDropdownMenu.RadioItem
                        value={`${TextStyle.Condensed}`}
                      >
                        {i18n('icu:StoryCreator__text--condensed')}
                      </AxoDropdownMenu.RadioItem>
                    </AxoDropdownMenu.RadioGroup>
                  </AxoDropdownMenu.Content>
                </AxoDropdownMenu.Root>
                <button
                  aria-label={getBgButtonAriaLabel(i18n, textBackground)}
                  className="StoryCreator__tools__icon-button"
                  onClick={() => {
                    if (textBackground === TextBackground.None) {
                      setTextBackground(TextBackground.Background);
                    } else if (textBackground === TextBackground.Background) {
                      setTextBackground(TextBackground.Inverse);
                    } else {
                      setTextBackground(TextBackground.None);
                    }
                  }}
                  type="button"
                >
                  <span
                    aria-hidden
                    className={classNames(
                      'StoryCreator__tools__icon-button-icon',
                      {
                        'StoryCreator__tools__button--bg-none':
                          textBackground === TextBackground.None,
                        'StoryCreator__tools__button--bg':
                          textBackground === TextBackground.Background,
                        'StoryCreator__tools__button--bg-inverse':
                          textBackground === TextBackground.Inverse,
                      }
                    )}
                  />
                </button>
                <FunEmojiPicker
                  open={emojiPickerOpen}
                  onOpenChange={handleEmojiPickerOpenChange}
                  placement="top"
                  onSelectEmoji={handleSelectEmoji}
                  theme={ThemeType.dark}
                  closeOnSelect
                >
                  <FunEmojiPickerButton i18n={i18n} />
                </FunEmojiPicker>
              </div>
            ) : (
              <div className="StoryCreator__toolbar--space" />
            )}
            <div className="StoryCreator__toolbar--buttons">
              <Button
                onClick={onTryClose}
                theme={Theme.Dark}
                variant={ButtonVariant.Secondary}
              >
                {i18n('icu:discard')}
              </Button>
              <div className="StoryCreator__controls">
                <Popover.Root
                  open={isColorPickerShowing}
                  onOpenChange={setIsColorPickerShowing}
                  modal={false}
                >
                  <Popover.Trigger asChild>
                    <button
                      aria-label={i18n('icu:StoryCreator__story-bg')}
                      className={classNames({
                        StoryCreator__control: true,
                        'StoryCreator__control--bg': true,
                        'StoryCreator__control--bg--selected':
                          isColorPickerShowing,
                      })}
                      style={{
                        background: getBackgroundColor(
                          getBackground(selectedBackground)
                        ),
                      }}
                      type="button"
                    />
                  </Popover.Trigger>
                  {/* No portal: stays inside this component's focus scope */}
                  <Popover.Content
                    className="StoryCreator__popper"
                    side="top"
                    sideOffset={4}
                    aria-label={i18n('icu:StoryCreator__story-bg')}
                  >
                    <Popover.Arrow
                      className="StoryCreator__popper__arrow"
                      width={28}
                      height={14}
                    />
                    {objectMap(BackgroundStyle, (bg, backgroundValue) => (
                      <button
                        aria-label={i18n('icu:StoryCreator__story-bg')}
                        className={classNames({
                          StoryCreator__bg: true,
                          'StoryCreator__bg--selected':
                            selectedBackground === backgroundValue,
                        })}
                        key={bg}
                        onClick={() => {
                          setSelectedBackground(backgroundValue);
                          setIsColorPickerShowing(false);
                        }}
                        type="button"
                        style={{
                          background: getBackgroundColor(
                            getBackground(backgroundValue)
                          ),
                        }}
                      />
                    ))}
                  </Popover.Content>
                </Popover.Root>
                <button
                  aria-label={i18n('icu:StoryCreator__control--text')}
                  className={classNames({
                    StoryCreator__control: true,
                    'StoryCreator__control--text': true,
                    'StoryCreator__control--selected': isEditingText,
                  })}
                  onClick={() => {
                    setIsEditingText(!isEditingText);
                  }}
                  type="button"
                />
                <Popover.Root
                  open={isLinkPreviewInputShowing}
                  onOpenChange={setIsLinkPreviewInputShowing}
                  modal={false}
                >
                  <Popover.Trigger asChild>
                    <button
                      aria-label={i18n('icu:StoryCreator__control--link')}
                      className="StoryCreator__control StoryCreator__control--link"
                      type="button"
                    />
                  </Popover.Trigger>
                  {/* No portal: stays inside this component's focus scope */}
                  <Popover.Content
                    className={classNames(
                      'StoryCreator__popper StoryCreator__link-preview-input-popper',
                      themeClassName(Theme.Dark)
                    )}
                    side="top"
                    sideOffset={4}
                    aria-label={i18n('icu:StoryCreator__control--link')}
                    // Only Escape or the Add link button close the link input
                    onInteractOutside={event => event.preventDefault()}
                  >
                    <Popover.Arrow
                      className="StoryCreator__popper__arrow"
                      width={28}
                      height={14}
                    />
                    <Input
                      disableSpellcheck
                      i18n={i18n}
                      className="StoryCreator__link-preview-input"
                      onChange={setLinkPreviewInputValue}
                      placeholder={i18n(
                        'icu:StoryCreator__link-preview-placeholder'
                      )}
                      ref={el => el?.focus()}
                      value={linkPreviewInputValue}
                    />
                    <div className="StoryCreator__link-preview-container">
                      {linkPreview ? (
                        <>
                          <div className="StoryCreator__link-preview-wrapper">
                            <StoryLinkPreview
                              {...linkPreview}
                              forceCompactMode
                              i18n={i18n}
                            />
                          </div>
                          <Button
                            className="StoryCreator__link-preview-button"
                            onClick={() => {
                              setLinkPreviewApplied(LinkPreviewApplied.Manual);
                              setIsLinkPreviewInputShowing(false);
                            }}
                            theme={Theme.Dark}
                            variant={ButtonVariant.Primary}
                          >
                            {i18n('icu:StoryCreator__add-link')}
                          </Button>
                        </>
                      ) : (
                        <div className="StoryCreator__link-preview-empty">
                          <div className="StoryCreator__link-preview-empty__icon" />
                          {i18n('icu:StoryCreator__link-preview-empty')}
                        </div>
                      )}
                    </div>
                  </Popover.Content>
                </Popover.Root>
              </div>
              <Button
                disabled={!hasChanges || isSending}
                onClick={() => onDone(textAttachment)}
                theme={Theme.Dark}
                variant={ButtonVariant.Primary}
              >
                {isSending ? (
                  <Spinner svgSize="small" />
                ) : (
                  i18n('icu:StoryCreator__next')
                )}
              </Button>
            </div>
          </div>
          {confirmDiscardModal}
        </div>
      </FocusScope.Root>
    </AxoTheme.Override>
  );
}
