// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEvent, MouseEvent } from 'react';
import React, { useRef, useState } from 'react';
import classNames from 'classnames';
import { ContextMenu, ContextMenuTrigger, MenuItem } from 'react-contextmenu';
import { ConfirmationDialog } from './ConfirmationDialog';
import { CustomColorEditor } from './CustomColorEditor';
import { Modal } from './Modal';
import type { ConversationColorType, CustomColorType } from '../types/Colors';
import { ConversationColors } from '../types/Colors';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { SampleMessageBubbles } from './SampleMessageBubbles';
import { PanelRow } from './conversation/conversation-details/PanelRow';
import { getCustomColorStyle } from '../util/getCustomColorStyle';

import { useDelayedRestoreFocus } from '../hooks/useRestoreFocus';

type CustomColorDataType = {
  id?: string;
  value?: CustomColorType;
};

export type PropsDataType = {
  conversationId?: string;
  customColors?: Record<string, CustomColorType>;
  getConversationsWithCustomColor: (
    colorId: string
  ) => Promise<Array<ConversationType>>;
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
  resetAllChatColors: () => unknown;
  resetDefaultChatColor: () => unknown;
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
      {confirmResetWhat ? (
        <ConfirmationDialog
          dialogName="ChatColorPicker.confirmReset"
          actions={[
            {
              action: resetDefaultChatColor,
              style: 'affirmative',
              text: i18n('icu:ChatColorPicker__confirm-reset-default'),
            },
            {
              action: () => {
                resetDefaultChatColor();
                resetAllChatColors();
              },
              style: 'affirmative',
              text: i18n('icu:ChatColorPicker__resetAll'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmResetWhat(false);
          }}
          title={i18n('icu:ChatColorPicker__resetDefault')}
        >
          {i18n('icu:ChatColorPicker__confirm-reset-message')}
        </ConfirmationDialog>
      ) : null}
      {confirmResetAll ? (
        <ConfirmationDialog
          dialogName="ChatColorPicker.confirmResetAll"
          actions={[
            {
              action: resetAllChatColors,
              style: 'affirmative',
              text: i18n('icu:ChatColorPicker__confirm-reset'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmResetAll(false);
          }}
          title={i18n('icu:ChatColorPicker__resetAll')}
        >
          {i18n('icu:ChatColorPicker__confirm-reset-message')}
        </ConfirmationDialog>
      ) : null}
      <SampleMessageBubbles
        backgroundStyle={getCustomColorStyle(selectedCustomColor.value)}
        color={selectedColor}
        i18n={i18n}
      />
      <hr />
      <div className="ChatColorPicker__bubbles">
        {ConversationColors.map((color, i) => (
          <div
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
            onKeyDown={(ev: KeyboardEvent) => {
              if (ev.key === 'Enter') {
                onSelectColor(color);
              }
            }}
            role="option"
            tabIndex={0}
            ref={i === 0 ? focusRef : undefined}
          />
        ))}
        {Object.keys(customColors).map(colorId => {
          const colorValues = customColors[colorId];
          return (
            <CustomColorBubble
              color={colorValues}
              colorId={colorId}
              getConversationsWithCustomColor={getConversationsWithCustomColor}
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
        <div
          aria-label={i18n('icu:ChatColorPicker__custom-color--label')}
          className="ChatColorPicker__bubble ChatColorPicker__bubble--custom"
          onClick={() =>
            setCustomColorToEdit({ id: undefined, value: undefined })
          }
          onKeyDown={(ev: KeyboardEvent) => {
            if (ev.key === 'Enter') {
              setCustomColorToEdit({ id: undefined, value: undefined });
            }
          }}
          role="button"
          tabIndex={0}
        >
          <i className="ChatColorPicker__add-icon" />
        </div>
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
  getConversationsWithCustomColor: (
    colorId: string
  ) => Promise<Array<ConversationType>>;
  i18n: LocalizerType;
  isSelected: boolean;
  onDelete: () => unknown;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const menuRef = useRef<any | null>(null);
  const [confirmDeleteCount, setConfirmDeleteCount] = useState<
    number | undefined
  >(undefined);

  const handleClick = (ev: KeyboardEvent | MouseEvent) => {
    if (!isSelected) {
      onChoose();
      return;
    }

    if (menuRef && menuRef.current) {
      menuRef.current.handleContextClick(ev);
    }
  };

  const bubble = (
    <div
      aria-label={colorId}
      aria-selected={isSelected}
      className={classNames({
        ChatColorPicker__bubble: true,
        'ChatColorPicker__bubble--custom-selected': isSelected,
        'ChatColorPicker__bubble--selected': isSelected,
      })}
      onClick={handleClick}
      onKeyDown={(ev: KeyboardEvent) => {
        if (ev.key === 'Enter') {
          handleClick(ev);
        }
      }}
      role="option"
      tabIndex={0}
      style={{
        ...getCustomColorStyle(color),
      }}
    />
  );

  return (
    <>
      {confirmDeleteCount ? (
        <ConfirmationDialog
          dialogName="ChatColorPicker.confirmDelete"
          actions={[
            {
              action: onDelete,
              style: 'negative',
              text: i18n('icu:ChatColorPicker__context--delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmDeleteCount(undefined);
          }}
          title={i18n('icu:ChatColorPicker__delete--title')}
        >
          {i18n('icu:ChatColorPicker__delete--message', {
            num: confirmDeleteCount,
          })}
        </ConfirmationDialog>
      ) : null}
      {isSelected ? (
        <ContextMenuTrigger id={colorId} ref={menuRef}>
          {bubble}
        </ContextMenuTrigger>
      ) : (
        bubble
      )}
      <ContextMenu id={colorId}>
        <MenuItem
          attributes={{
            className: 'ChatColorPicker__context--edit',
          }}
          onClick={(event: MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            onEdit();
          }}
        >
          {i18n('icu:ChatColorPicker__context--edit')}
        </MenuItem>
        <MenuItem
          attributes={{
            className: 'ChatColorPicker__context--duplicate',
          }}
          onClick={(event: MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            onDupe();
          }}
        >
          {i18n('icu:ChatColorPicker__context--duplicate')}
        </MenuItem>
        <MenuItem
          attributes={{
            className: 'ChatColorPicker__context--delete',
          }}
          onClick={async (event: MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            const conversations =
              await getConversationsWithCustomColor(colorId);
            if (!conversations.length) {
              onDelete();
            } else {
              setConfirmDeleteCount(conversations.length);
            }
          }}
        >
          {i18n('icu:ChatColorPicker__context--delete')}
        </MenuItem>
      </ContextMenu>
    </>
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
