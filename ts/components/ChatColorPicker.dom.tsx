// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MouseEvent, ReactNode, JSX } from 'react';
import { useCallback, useState } from 'react';
import classNames from 'classnames';
import { CustomColorEditor } from './CustomColorEditor.dom.tsx';
import { Modal } from './Modal.dom.tsx';
import type {
  ConversationColorType,
  CustomColorType,
} from '../types/Colors.std.ts';
import { ConversationColors } from '../types/Colors.std.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { SampleMessageBubbles } from './SampleMessageBubbles.dom.tsx';
import { PanelRow } from './conversation/conversation-details/PanelRow.dom.tsx';
import { getCustomColorStyle } from '../util/getCustomColorStyle.dom.ts';
import { useDelayedRestoreFocus } from '../hooks/useRestoreFocus.dom.ts';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

type CustomColorDataType = {
  id?: string;
  value?: CustomColorType;
};

export type PropsDataType = {
  conversationId?: string;
  customColors?: Record<string, CustomColorType>;
  getConversationsWithCustomColor: (colorId: string) => Array<ConversationType>;
  i18n: LocalizerType;
  isGlobal?: boolean;
  selectedColor?: ConversationColorType;
  selectedCustomColor: CustomColorDataType;
};

type PropsActionType = {
  addCustomColor: (color: CustomColorType, conversationId?: string) => unknown;
  colorSelected: (payload: {
    conversationId: string;
    conversationColor?: ConversationColorType;
    customColorData?: {
      id: string;
      value: CustomColorType;
    };
  }) => unknown;
  editCustomColor: (colorId: string, color: CustomColorType) => unknown;
  removeCustomColor: (colorId: string) => unknown;
  removeCustomColorOnConversations: (colorId: string) => unknown;
  resetAllChatColors: () => void;
  resetDefaultChatColor: () => void;
  setGlobalDefaultConversationColor: (
    color: ConversationColorType,
    customColorData?: {
      id: string;
      value: CustomColorType;
    }
  ) => unknown;
};

export type PropsType = PropsDataType & PropsActionType;

export function ChatColorPicker({
  addCustomColor,
  colorSelected,
  conversationId,
  customColors = {},
  editCustomColor,
  getConversationsWithCustomColor,
  i18n,
  isGlobal = false,
  removeCustomColor,
  removeCustomColorOnConversations,
  resetAllChatColors,
  resetDefaultChatColor,
  selectedColor = ConversationColors[0],
  selectedCustomColor,
  setGlobalDefaultConversationColor,
}: PropsType): JSX.Element {
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [confirmResetWhat, setConfirmResetWhat] = useState(false);
  const [customColorToEdit, setCustomColorToEdit] = useState<
    CustomColorDataType | undefined
  >(undefined);

  const [focusRef] = useDelayedRestoreFocus();

  const onSelectColor = (
    conversationColor: ConversationColorType,
    customColorData?: { id: string; value: CustomColorType }
  ): void => {
    if (conversationId) {
      colorSelected({
        conversationId,
        conversationColor,
        customColorData,
      });
    } else {
      setGlobalDefaultConversationColor(conversationColor, customColorData);
    }
  };

  const renderCustomColorEditorWrapper = () => (
    <CustomColorEditorWrapper
      customColorToEdit={customColorToEdit}
      i18n={i18n}
      onClose={() => setCustomColorToEdit(undefined)}
      onSave={(color: CustomColorType) => {
        if (customColorToEdit?.id) {
          editCustomColor(customColorToEdit.id, color);
          onSelectColor('custom', {
            id: customColorToEdit.id,
            value: color,
          });
        } else {
          addCustomColor(color, conversationId);
        }
      }}
    />
  );

  return (
    <div className="ChatColorPicker__container">
      {customColorToEdit ? renderCustomColorEditorWrapper() : null}
      <AxoConfirmDialog.Root
        open={confirmResetWhat}
        onOpenChange={setConfirmResetWhat}
        title={i18n('icu:ChatColorPicker__resetDefault')}
        description={i18n('icu:ChatColorPicker__confirm-reset-message')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="primary"
          onClick={resetDefaultChatColor}
        >
          {i18n('icu:ChatColorPicker__confirm-reset-default')}
        </AxoConfirmDialog.Action>
        <AxoConfirmDialog.Action
          variant="primary"
          onClick={() => {
            resetDefaultChatColor();
            resetAllChatColors();
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
        <AxoConfirmDialog.Action variant="primary" onClick={resetAllChatColors}>
          {i18n('icu:ChatColorPicker__confirm-reset')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
      <SampleMessageBubbles
        backgroundStyle={getCustomColorStyle(selectedCustomColor.value)}
        color={selectedColor}
        i18n={i18n}
      />
      <hr />
      <div className="ChatColorPicker__bubbles">
        <div role="listbox" className={tw('contents')}>
          {ConversationColors.map((color, i) => (
            <button
              type="button"
              role="option"
              aria-label={color}
              aria-selected={color === selectedColor}
              className={classNames(
                `ChatColorPicker__bubble ChatColorPicker__bubble--${color}`,
                {
                  'ChatColorPicker__bubble--selected': color === selectedColor,
                }
              )}
              key={color}
              onClick={() => onSelectColor(color)}
              ref={i === 0 ? focusRef : undefined}
            />
          ))}
          {Object.entries(customColors).map(([colorId, colorValues]) => {
            return (
              <CustomColorBubble
                color={colorValues}
                colorId={colorId}
                getConversationsWithCustomColor={
                  getConversationsWithCustomColor
                }
                key={colorId}
                i18n={i18n}
                isSelected={colorId === selectedCustomColor.id}
                onChoose={() => {
                  onSelectColor('custom', {
                    id: colorId,
                    value: colorValues,
                  });
                }}
                onDelete={() => {
                  removeCustomColor(colorId);
                  removeCustomColorOnConversations(colorId);
                }}
                onDupe={() => {
                  addCustomColor(colorValues, conversationId);
                }}
                onEdit={() => {
                  setCustomColorToEdit({ id: colorId, value: colorValues });
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
            setCustomColorToEdit({ id: undefined, value: undefined });
          }}
        >
          <i className="ChatColorPicker__add-icon" />
        </button>
      </div>
      <hr />
      {conversationId ? (
        <PanelRow
          label={i18n('icu:ChatColorPicker__reset')}
          onClick={() => {
            colorSelected({ conversationId });
          }}
        />
      ) : null}
      <PanelRow
        label={i18n('icu:ChatColorPicker__resetAll')}
        onClick={() => {
          if (isGlobal) {
            setConfirmResetWhat(true);
          } else {
            setConfirmResetAll(true);
          }
        }}
      />
    </div>
  );
}

type CustomColorBubblePropsType = {
  color: CustomColorType;
  colorId: string;
  getConversationsWithCustomColor: (colorId: string) => Array<ConversationType>;
  i18n: LocalizerType;
  isSelected: boolean;
  onDelete: () => void;
  onDupe: () => unknown;
  onEdit: () => unknown;
  onChoose: () => unknown;
};

function CustomColorBubble({
  color,
  colorId,
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
    const conversations = getConversationsWithCustomColor(colorId);
    if (!conversations.length) {
      onDelete();
    } else {
      setConfirmDeleteCount(conversations.length);
    }
  }, [getConversationsWithCustomColor, colorId, onDelete]);

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
        <AxoConfirmDialog.Action variant="destructive" onClick={onDelete}>
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
          aria-label={colorId}
          aria-selected={isSelected}
          className={classNames({
            ChatColorPicker__bubble: true,
            'ChatColorPicker__bubble--custom-selected': isSelected,
            'ChatColorPicker__bubble--selected': isSelected,
          })}
          onClick={handleClick}
          style={getCustomColorStyle(color)}
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

type CustomColorEditorWrapperPropsType = {
  customColorToEdit?: CustomColorDataType;
  i18n: LocalizerType;
  onClose: () => unknown;
  onSave: (color: CustomColorType) => unknown;
};

function CustomColorEditorWrapper({
  customColorToEdit,
  i18n,
  onClose,
  onSave,
}: CustomColorEditorWrapperPropsType): JSX.Element {
  const editor = (
    <CustomColorEditor
      customColor={customColorToEdit?.value}
      i18n={i18n}
      onClose={onClose}
      onSave={onSave}
    />
  );

  return (
    <Modal
      modalName="ChatColorPicker"
      hasXButton
      i18n={i18n}
      moduleClassName="ChatColorPicker__modal"
      noMouseClose
      onClose={onClose}
      title={i18n('icu:CustomColorEditor__title')}
    >
      {editor}
    </Modal>
  );
}
