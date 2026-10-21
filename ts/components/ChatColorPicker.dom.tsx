// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MouseEvent, ReactNode, JSX, CSSProperties } from 'react';
import { useCallback, useState } from 'react';
import classNames from 'classnames';
import { CustomColorEditorDialog } from './CustomColorEditorDialog.dom.tsx';
import { ConversationColors, type ChatStyle } from '../types/ChatStyle.std.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { SampleMessageBubbles } from './SampleMessageBubbles.dom.tsx';
import {
  getCustomColorBackground,
  resolveBubbleColorRenderData,
} from '../util/getCustomColorStyle.std.ts';
import { useDelayedRestoreFocus } from '../hooks/useRestoreFocus.dom.ts';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import { AxoContainer } from '../axo/AxoContainer.dom.tsx';
import { AxoList } from '../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../axo/items/AxoItem.dom.tsx';
import { AxoClickableItem } from '../axo/items/AxoClickableItem.dom.tsx';
import { AxoTokens } from '../axo/AxoTokens.std.ts';
import { INITIAL_CUSTOM_CHAT_COLOR } from './CustomColorEditor.dom.tsx';

type GetConversationsWithCustomChatColor = (
  colorId: ChatStyle.CustomChatColor['id']
) => ReadonlyArray<ConversationType>;

type EditingCustomColor = Readonly<{
  id: ChatStyle.CustomChatColor['id'] | null;
  color: ChatStyle.CustomChatColor['color'];
}>;

export type ChatColorPickerProps = Readonly<{
  i18n: LocalizerType;
  conversationId: string | null;
  selectedBubbleColor: ChatStyle['bubbleColor'];
  defaultBubbleColor: ChatStyle['bubbleColor'];
  customChatColors: ReadonlyArray<ChatStyle.CustomChatColor>;
  getConversationsWithCustomColor: GetConversationsWithCustomChatColor;

  onAddCustomChatColor: (
    color: ChatStyle.CustomChatColor['color'],
    conversationId: string | null
  ) => void;
  onSelectBubbleColor: (payload: {
    conversationId: string;
    bubbleColor: ChatStyle['bubbleColor'] | null;
  }) => void;
  onEditCustomChatColor: (customChatColor: ChatStyle.CustomChatColor) => void;
  onRemoveCustomChatColor: (
    customChatColorId: ChatStyle.CustomChatColor['id']
  ) => void;
  onResetAllChatColors: () => void;
  onResetDefaultBubbleColor: () => void;
  onChangeGlobalDefaultBubbleColor: (
    bubbleColor: ChatStyle['bubbleColor']
  ) => void;
}>;

export function ChatColorPicker({
  onAddCustomChatColor,
  onSelectBubbleColor,
  conversationId,
  customChatColors,
  onEditCustomChatColor,
  getConversationsWithCustomColor,
  i18n,
  onRemoveCustomChatColor,
  onResetAllChatColors,
  onResetDefaultBubbleColor,
  selectedBubbleColor,
  defaultBubbleColor,
  onChangeGlobalDefaultBubbleColor,
}: ChatColorPickerProps): JSX.Element {
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [confirmResetWhat, setConfirmResetWhat] = useState(false);
  const [customColorToEdit, setCustomColorToEdit] =
    useState<EditingCustomColor | null>(null);

  const [focusRef] = useDelayedRestoreFocus();

  const onSelectColor = (bubbleColor: ChatStyle['bubbleColor']): void => {
    if (conversationId) {
      onSelectBubbleColor({ conversationId, bubbleColor });
    } else {
      onChangeGlobalDefaultBubbleColor(bubbleColor);
    }
  };

  const renderCustomColorEditorDialog = () => (
    <CustomColorEditorDialog
      i18n={i18n}
      initialColor={customColorToEdit?.color ?? null}
      onClose={() => setCustomColorToEdit(null)}
      onSave={(color: ChatStyle.CustomChatColor['color']) => {
        if (customColorToEdit?.id != null) {
          onEditCustomChatColor({
            id: customColorToEdit.id,
            color,
          });
        } else {
          onAddCustomChatColor(color, conversationId);
        }
      }}
    />
  );

  return (
    <AxoContainer.Root>
      {customColorToEdit ? renderCustomColorEditorDialog() : null}

      <AxoConfirmDialog.Root
        open={confirmResetWhat}
        onOpenChange={setConfirmResetWhat}
        title={i18n('icu:ChatColorPicker__resetDefault')}
        description={i18n('icu:ChatColorPicker__confirm-reset-message')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-primary"
          onClick={onResetDefaultBubbleColor}
        >
          {i18n('icu:ChatColorPicker__confirm-reset-default')}
        </AxoConfirmDialog.Action>
        <AxoConfirmDialog.Action
          variant="strong-primary"
          onClick={() => {
            onResetDefaultBubbleColor();
            onResetAllChatColors();
          }}
        >
          {i18n('icu:ChatColorPicker__resetAll')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={confirmResetAll}
        onOpenChange={setConfirmResetAll}
        title={i18n('icu:ChatColorPicker__resetAll')}
        description={i18n('icu:ChatColorPicker__confirm-reset-message')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-primary"
          onClick={onResetAllChatColors}
        >
          {i18n('icu:ChatColorPicker__confirm-reset')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <div
        className={tw(
          'mb-4 bg-surface-primary',
          'border-[0.5px] border-secondary py-4',
          'curved-2xl'
        )}
      >
        <SampleMessageBubbles
          bubbleColor={resolveBubbleColorRenderData(
            selectedBubbleColor,
            defaultBubbleColor,
            customChatColors
          )}
          i18n={i18n}
        />
      </div>

      <AxoList.Group>
        <AxoList.Root>
          <AxoList.Body>
            <div className="ChatColorPicker__bubbles">
              <div role="listbox" className={tw('contents')}>
                {ConversationColors.map((color, i) => {
                  const isSelected =
                    selectedBubbleColor.bubbleColorPreset != null &&
                    color === selectedBubbleColor.bubbleColorPreset;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-label={color}
                      aria-selected={isSelected}
                      className={classNames('ChatColorPicker__bubble', {
                        'ChatColorPicker__bubble--selected': isSelected,
                      })}
                      key={color}
                      onClick={() =>
                        onSelectColor({ bubbleColorPreset: color })
                      }
                      ref={i === 0 ? focusRef : undefined}
                      style={
                        {
                          '--chat-color-picker-bg':
                            AxoTokens.ChatBubble.anyColorNameToCssBackground(
                              color
                            ),
                        } as CSSProperties
                      }
                    />
                  );
                })}
                {customChatColors.map(customChatColor => {
                  const isSelected =
                    selectedBubbleColor.customChatColorId ===
                    customChatColor.id;
                  return (
                    <CustomColorBubble
                      key={customChatColor.id}
                      color={customChatColor}
                      getConversationsWithCustomColor={
                        getConversationsWithCustomColor
                      }
                      i18n={i18n}
                      isSelected={isSelected}
                      onChoose={() => {
                        onSelectColor({
                          customChatColorId: customChatColor.id,
                        });
                      }}
                      onDelete={() => {
                        onRemoveCustomChatColor(customChatColor.id);
                      }}
                      onDupe={() => {
                        onAddCustomChatColor(
                          customChatColor.color,
                          conversationId
                        );
                      }}
                      onEdit={() => {
                        setCustomColorToEdit(customChatColor);
                      }}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                aria-label={i18n('icu:ChatColorPicker__custom-color--label')}
                className="ChatColorPicker__bubble ChatColorPicker__bubble--custom"
                onClick={() => {
                  setCustomColorToEdit({
                    id: null,
                    color: INITIAL_CUSTOM_CHAT_COLOR,
                  });
                }}
              >
                <i className="ChatColorPicker__add-icon" />
              </button>
            </div>
          </AxoList.Body>
        </AxoList.Root>

        <AxoList.Root>
          <AxoList.Body>
            <AxoItem.Group>
              {conversationId != null && (
                <AxoClickableItem.Root
                  label={i18n('icu:ChatColorPicker__reset')}
                  onClick={() => {
                    onSelectBubbleColor({ conversationId, bubbleColor: null });
                  }}
                />
              )}

              <AxoClickableItem.Root
                label={i18n('icu:ChatColorPicker__resetAll')}
                onClick={() => {
                  if (conversationId == null) {
                    setConfirmResetWhat(true);
                  } else {
                    setConfirmResetAll(true);
                  }
                }}
              />
            </AxoItem.Group>
          </AxoList.Body>
        </AxoList.Root>
      </AxoList.Group>
    </AxoContainer.Root>
  );
}

type CustomColorBubblePropsType = {
  color: ChatStyle.CustomChatColor;
  getConversationsWithCustomColor: GetConversationsWithCustomChatColor;
  i18n: LocalizerType;
  isSelected: boolean;
  onDelete: () => void;
  onDupe: () => void;
  onEdit: () => void;
  onChoose: () => void;
};

function CustomColorBubble({
  color,
  getConversationsWithCustomColor,
  i18n,
  isSelected,
  onDelete,
  onDupe,
  onEdit,
  onChoose,
}: CustomColorBubblePropsType): JSX.Element {
  const [confirmDeleteCount, setConfirmDeleteCount] = useState<
    number | undefined
  >(undefined);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (!isSelected) {
        onChoose();
        event.currentTarget.focus();
      }
    },
    [isSelected, onChoose]
  );

  const handleDelete = useCallback(() => {
    const conversations = getConversationsWithCustomColor(color.id);
    if (!conversations.length) {
      onDelete();
    } else {
      setConfirmDeleteCount(conversations.length);
    }
  }, [getConversationsWithCustomColor, color.id, onDelete]);

  return (
    <>
      <AxoConfirmDialog.Root
        open={confirmDeleteCount != null}
        onOpenChange={() => setConfirmDeleteCount(undefined)}
        title={i18n('icu:ChatColorPicker__delete--title')}
        description={i18n('icu:ChatColorPicker__delete--message', {
          num: confirmDeleteCount ?? 0,
        })}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={onDelete}
        >
          {i18n('icu:ChatColorPicker__context--delete')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
      <CustomColorBubbleDropdownMenu
        i18n={i18n}
        onEdit={onEdit}
        onDupe={onDupe}
        onDelete={handleDelete}
        disabled={!isSelected}
      >
        <button
          type="button"
          role="option"
          aria-label={`${color.id}`}
          aria-selected={isSelected}
          className={classNames({
            ChatColorPicker__bubble: true,
            'ChatColorPicker__bubble--custom-selected': isSelected,
            'ChatColorPicker__bubble--selected': isSelected,
          })}
          onClick={handleClick}
          style={
            {
              '--chat-color-picker-bg': getCustomColorBackground(color.color),
            } as CSSProperties
          }
        />
      </CustomColorBubbleDropdownMenu>
    </>
  );
}

function CustomColorBubbleDropdownMenu(props: {
  i18n: LocalizerType;
  disabled: boolean;
  onEdit: () => void;
  onDupe: () => void;
  onDelete: () => void;
  children: ReactNode;
}): JSX.Element {
  const { i18n, disabled } = props;
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!disabled) {
        setOpen(nextOpen);
      }
    },
    [disabled]
  );

  return (
    <AxoDropdownMenu.Root open={open} onOpenChange={handleOpenChange}>
      <AxoDropdownMenu.Trigger>{props.children}</AxoDropdownMenu.Trigger>
      <AxoDropdownMenu.Content>
        <AxoDropdownMenu.Item onSelect={props.onEdit}>
          {i18n('icu:ChatColorPicker__context--edit')}
        </AxoDropdownMenu.Item>
        <AxoDropdownMenu.Item onSelect={props.onDupe}>
          {i18n('icu:ChatColorPicker__context--duplicate')}
        </AxoDropdownMenu.Item>
        <AxoDropdownMenu.Item onSelect={props.onDelete}>
          {i18n('icu:ChatColorPicker__context--delete')}
        </AxoDropdownMenu.Item>
      </AxoDropdownMenu.Content>
    </AxoDropdownMenu.Root>
  );
}
