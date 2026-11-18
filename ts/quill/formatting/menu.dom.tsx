// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect, type JSX } from 'react';
import classNames from 'classnames';
import { Popover, Toolbar } from 'radix-ui';
import lodash from 'lodash';
import Emitter from '@signalapp/quill-cjs/core/emitter.js';
import type Quill from '@signalapp/quill-cjs';
import type { Op } from '@signalapp/quill-cjs';
import { createLogger } from '../../logging/log.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { createKeybindingsHandler } from 'tinykeys';
import { AxoTooltip } from '../../axo/AxoTooltip.dom.tsx';

const { isString } = lodash;

const log = createLogger('menu');

const MENU_FADE_OUT_MS = 200;
const MENU_TEXT_BUFFER = 12; // pixels

type FormattingPickerOptions = {
  i18n: LocalizerType;
  isMenuEnabled: boolean;
  isMouseDown?: boolean;
  platform: string;
  setFormattingChooserElement: (element: JSX.Element | null) => void;
};

export enum QuillFormattingStyle {
  bold = 'bold',
  italic = 'italic',
  monospace = 'monospace',
  strike = 'strike',
  spoiler = 'spoiler',
}

/** "⌘⇧B" on macOS, "Ctrl+Shift+B" elsewhere */
function formatShortcut(
  platform: string,
  i18n: LocalizerType,
  key: string,
  modifiers: Readonly<{ shift: boolean }> = { shift: false }
): string {
  if (platform === 'darwin') {
    return `⌘${modifiers.shift ? '⇧' : ''}${key}`;
  }
  const ctrl = i18n('icu:Keyboard--Key--ctrl');
  if (modifiers.shift) {
    return `${ctrl}+${i18n('icu:Keyboard--Key--shift')}+${key}`;
  }
  return `${ctrl}+${key}`;
}

function isAllNewlines(ops: Array<Op>): boolean {
  return ops.every(isNewlineOnlyOp);
}

export function isNewlineOnlyOp(op: Op): boolean {
  return isString(op.insert) && /^\n+$/g.test(op.insert);
}

// oxlint-disable-next-line react/prefer-function-component
export class FormattingMenu {
  // Cache the results of our virtual elements's last rect calculation
  lastRect: DOMRect | undefined;

  // Keep a references to our originally passed (or updated) options
  options: FormattingPickerOptions;

  readonly #handleKeyDown: (event: KeyboardEvent) => void;

  // Maintaining a direct reference to quill
  quill: Quill;

  // The virtual element the menu is positioned against
  referenceElement: { getBoundingClientRect: () => DOMRect } | undefined;

  // Timer to track an animated fade-out, then DOM removal
  fadingOutTimeout?: NodeJS.Timeout;

  constructor(quill: Quill, options: FormattingPickerOptions) {
    this.quill = quill;
    this.options = options;

    this.quill.on(Emitter.events.EDITOR_CHANGE, this.onEditorChange.bind(this));

    // We override these keybindings, so we need to remove them from the defaults
    this.quill.keyboard.bindings.b = [];
    this.quill.keyboard.bindings.i = [];

    const onBold = () => {
      this.toggleForStyle(QuillFormattingStyle.bold);
    };
    const onItalic = () => {
      this.toggleForStyle(QuillFormattingStyle.italic);
    };
    const onMonospace = () => {
      this.toggleForStyle(QuillFormattingStyle.monospace);
    };
    const onStrike = () => {
      this.toggleForStyle(QuillFormattingStyle.strike);
    };
    const onSpoiler = () => {
      this.toggleForStyle(QuillFormattingStyle.spoiler);
    };

    this.#handleKeyDown = createKeybindingsHandler({
      '$mod+B': onBold,
      '$mod+I': onItalic,
      '$mod+E': onMonospace,
      '$mod+Shift+X': onStrike,
      '$mod+Shift+B': onSpoiler,
    });

    this.quill.root.addEventListener('keydown', this.#handleKeyDown);
  }

  destroy(): void {
    this.quill.root.removeEventListener('keydown', this.#handleKeyDown);
  }

  updateOptions(options: Partial<FormattingPickerOptions>): void {
    this.options = { ...this.options, ...options };
    this.onEditorChange();
  }

  scheduleRemoval(): void {
    // Nothing to do
    if (!this.referenceElement) {
      return;
    }

    // Already scheduled
    if (this.fadingOutTimeout) {
      return;
    }

    this.fadingOutTimeout = setTimeout(() => {
      this.referenceElement = undefined;
      this.lastRect = undefined;
      this.fadingOutTimeout = undefined;
      this.render();
    }, MENU_FADE_OUT_MS);

    this.render();
  }

  cancelRemoval(): void {
    if (this.fadingOutTimeout) {
      clearTimeout(this.fadingOutTimeout);
      this.fadingOutTimeout = undefined;
    }
  }

  onEditorChange(): void {
    if (!this.options.isMenuEnabled) {
      this.scheduleRemoval();
      return;
    }

    const isFocused = this.quill.hasFocus();
    if (!isFocused) {
      this.scheduleRemoval();
      return;
    }

    const quillSelection = this.quill.getSelection();

    if (!quillSelection || quillSelection.length === 0) {
      this.scheduleRemoval();
      return;
    }

    // Note: we special-case all-newline ops because Quill doesn't apply styles to them
    const contents = this.quill.getContents(
      quillSelection.index,
      quillSelection.length
    );
    if (isAllNewlines(contents.ops)) {
      this.scheduleRemoval();
      return;
    }

    // a virtual reference to the text we are trying to format
    this.cancelRemoval();
    this.referenceElement = {
      getBoundingClientRect: () => {
        const selection = window.getSelection();

        // there's a selection and at least one range
        if (selection != null && selection.rangeCount !== 0) {
          // grab the first range, the one the user is actually on right now
          const range = selection.getRangeAt(0);

          const { activeElement } = document;
          const editorElement = activeElement?.closest(
            '.module-composition-input__input'
          );
          const editorRect = editorElement?.getClientRects()[0];
          if (!editorRect) {
            // Note: this will happen when a user dismisses a panel; and if we don't
            //   cache here, the formatting menu will show in the very top-left
            if (this.lastRect) {
              return this.lastRect;
            }
            log.warn('No editor rect when showing formatting menu');
            return new DOMRect();
          }

          const rect = range.getBoundingClientRect();
          if (!rect) {
            if (this.lastRect) {
              return this.lastRect;
            }
            log.warn('No maximum rect when showing formatting menu');
            return new DOMRect();
          }

          // If we've scrolled down and the top of the composer text is invisible, above
          //   where the editor ends, we fix the popover so it stays connected to the
          //   visible editor. Important for the 'Cmd-A' scenario when scrolled down.
          const updatedY = Math.max(
            (editorRect.y || 0) - MENU_TEXT_BUFFER,
            (rect.y || 0) - MENU_TEXT_BUFFER
          );
          const updatedHeight = rect.height + (rect.y - updatedY);

          this.lastRect = DOMRect.fromRect({
            x: rect.x,
            y: updatedY,
            height: updatedHeight,
            width: rect.width,
          });

          return this.lastRect;
        }

        log.warn('No selection range when showing formatting menu');
        return new DOMRect();
      },
    };

    this.render();
  }

  static isStyleEnabledForOps(
    ops: Array<Op>,
    style: QuillFormattingStyle
  ): boolean {
    // Note: we special-case single \n ops because Quill doesn't apply formatting to them
    if (isAllNewlines(ops)) {
      return false;
    }

    return ops.every(op => op.attributes?.[style] || isNewlineOnlyOp(op));
  }

  isStyleEnabledInSelection(style: QuillFormattingStyle): boolean {
    const selection = this.quill.getSelection();
    if (selection == null) {
      return false;
    }
    return this.quill.getFormat(selection)[style] != null;
  }

  toggleForStyle(style: QuillFormattingStyle): void {
    this.quill.format(style, !this.isStyleEnabledInSelection(style));
  }

  readonly #handleOpenChange = (open: boolean): void => {
    if (!open) {
      this.scheduleRemoval();
    }
  };

  render(): void {
    if (!this.referenceElement) {
      this.options.setFormattingChooserElement(null);
      return;
    }

    const element = (
      <Popover.Root open onOpenChange={this.#handleOpenChange} modal={false}>
        <Popover.Anchor virtualRef={{ current: this.referenceElement }} />
        <Popover.Portal>
          <FormattingMenuContent
            i18n={this.options.i18n}
            platform={this.options.platform}
            isVisible={!this.options.isMouseDown && !this.fadingOutTimeout}
            isStyleEnabledInSelection={this.isStyleEnabledInSelection.bind(
              this
            )}
            toggleForStyle={this.toggleForStyle.bind(this)}
          />
        </Popover.Portal>
      </Popover.Root>
    );

    this.options.setFormattingChooserElement(element);
  }
}

type FormattingMenuContentProps = Readonly<{
  i18n: LocalizerType;
  platform: string;
  isVisible: boolean;
  isStyleEnabledInSelection: (style: QuillFormattingStyle) => boolean;
  toggleForStyle: (style: QuillFormattingStyle) => void;
}>;

function FormattingMenuContent(props: FormattingMenuContentProps): JSX.Element {
  const { i18n, isStyleEnabledInSelection, toggleForStyle } = props;
  const { platform } = props;

  // Stays transparent until positioned, so it fades in where it's placed
  const [isPlaced, setIsPlaced] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsPlaced(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <Popover.Content
      asChild
      side="top"
      // Shows and hides with the selection; focus stays in the editor
      onOpenAutoFocus={event => event.preventDefault()}
      onCloseAutoFocus={event => event.preventDefault()}
      onFocusOutside={event => event.preventDefault()}
      onInteractOutside={event => event.preventDefault()}
    >
      <Toolbar.Root
        // Otherwise Popover.Content's role="dialog" passes through
        role="toolbar"
        className="module-composition-input__format-menu"
        style={{ opacity: isPlaced && props.isVisible ? 1 : 0 }}
        aria-label={i18n('icu:FormatMenu__ToolbarLabel')}
      >
        <FormattingButton
          isActive={isStyleEnabledInSelection(QuillFormattingStyle.bold)}
          label={i18n('icu:Keyboard--composer--bold')}
          popupGuideShortcut={formatShortcut(platform, i18n, 'B')}
          popupGuideText={i18n('icu:FormatMenu--guide--bold')}
          style={QuillFormattingStyle.bold}
          toggleForStyle={toggleForStyle}
        />
        <FormattingButton
          isActive={isStyleEnabledInSelection(QuillFormattingStyle.italic)}
          label={i18n('icu:Keyboard--composer--italic')}
          popupGuideShortcut={formatShortcut(platform, i18n, 'I')}
          popupGuideText={i18n('icu:FormatMenu--guide--italic')}
          style={QuillFormattingStyle.italic}
          toggleForStyle={toggleForStyle}
        />
        <FormattingButton
          isActive={isStyleEnabledInSelection(QuillFormattingStyle.strike)}
          label={i18n('icu:Keyboard--composer--strikethrough')}
          popupGuideShortcut={formatShortcut(platform, i18n, 'X', {
            shift: true,
          })}
          popupGuideText={i18n('icu:FormatMenu--guide--strikethrough')}
          style={QuillFormattingStyle.strike}
          toggleForStyle={toggleForStyle}
        />
        <FormattingButton
          isActive={isStyleEnabledInSelection(QuillFormattingStyle.monospace)}
          label={i18n('icu:Keyboard--composer--monospace')}
          popupGuideShortcut={formatShortcut(platform, i18n, 'E')}
          popupGuideText={i18n('icu:FormatMenu--guide--monospace')}
          style={QuillFormattingStyle.monospace}
          toggleForStyle={toggleForStyle}
        />
        <FormattingButton
          isActive={isStyleEnabledInSelection(QuillFormattingStyle.spoiler)}
          popupGuideShortcut={formatShortcut(platform, i18n, 'B', {
            shift: true,
          })}
          popupGuideText={i18n('icu:FormatMenu--guide--spoiler')}
          label={i18n('icu:Keyboard--composer--spoiler')}
          style={QuillFormattingStyle.spoiler}
          toggleForStyle={toggleForStyle}
        />
      </Toolbar.Root>
    </Popover.Content>
  );
}

const FORMATTING_STYLE_ICONS: Record<QuillFormattingStyle, string> = {
  [QuillFormattingStyle.bold]:
    'module-composition-input__format-menu__item__icon--bold',
  [QuillFormattingStyle.italic]:
    'module-composition-input__format-menu__item__icon--italic',
  [QuillFormattingStyle.strike]:
    'module-composition-input__format-menu__item__icon--strike',
  [QuillFormattingStyle.monospace]:
    'module-composition-input__format-menu__item__icon--monospace',
  [QuillFormattingStyle.spoiler]:
    'module-composition-input__format-menu__item__icon--spoiler',
};

function FormattingButton({
  isActive,
  label,
  popupGuideText,
  popupGuideShortcut,
  style,
  toggleForStyle,
}: {
  isActive: boolean | undefined;
  label: string;
  popupGuideText: string;
  popupGuideShortcut: string;
  style: QuillFormattingStyle;
  toggleForStyle: (style: QuillFormattingStyle) => unknown;
}): JSX.Element {
  return (
    <AxoTooltip.Root
      label={popupGuideText}
      keyboardShortcut={popupGuideShortcut}
    >
      <Toolbar.Button asChild>
        <button
          type="button"
          aria-pressed={isActive ?? false}
          className={classNames(
            'module-composition-input__format-menu__item',
            isActive
              ? 'module-composition-input__format-menu__item--active'
              : null
          )}
          aria-label={label}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            toggleForStyle(style);
          }}
        >
          <div
            className={classNames(
              'module-composition-input__format-menu__item__icon',
              FORMATTING_STYLE_ICONS[style],
              isActive
                ? 'module-composition-input__format-menu__item__icon--active'
                : null
            )}
          />
        </button>
      </Toolbar.Button>
    </AxoTooltip.Root>
  );
}
