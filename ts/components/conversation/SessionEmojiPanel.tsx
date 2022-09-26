import React, { forwardRef, MutableRefObject, useEffect } from 'react';
import classNames from 'classnames';
import styled from 'styled-components';
import data from '@emoji-mart/data';
// @ts-ignore
import { Picker } from '../../../node_modules/emoji-mart/dist/index.cjs';
import { useSelector } from 'react-redux';
import { getTheme } from '../../state/selectors/theme';
import { noop } from 'lodash';
import { loadEmojiPanelI18n } from '../../util/i18n';
import { FixedBaseEmoji, FixedPickerProps } from '../../types/Reaction';

export const StyledEmojiPanel = styled.div<{ isModal: boolean; theme: 'light' | 'dark' }>`
  padding: var(--margins-lg);
  z-index: 5;
  opacity: 0;
  visibility: hidden;
  // this disables the slide-in animation when showing the emoji picker from a right click on a message
  /* transition: var(--default-duration); */

  button:focus {
    outline: none;
  }

  &.show {
    opacity: 1;
    visibility: visible;
  }

  em-emoji-picker {
    background-color: var(--color-cell-background);
    border: 1px solid var(--color-session-border);
    padding-bottom: var(--margins-sm);
    --shadow: none;
    --border-radius: 8px;
    --color-border: var(--color-session-border);
    --font-family: var(--font-default);
    --font-size: var(--font-size-sm);
    --rgb-accent: 0, 247, 130; // Constants.UI.COLORS.GREEN

    ${props => {
      switch (props.theme) {
        // TODO Theming - Add Ocean Colors
        case 'dark':
          return `
            --background-rgb: 27, 27, 27; // var(--color-cell-background)
            --rgb-background: 27, 27, 27;
            --rgb-color: 255, 255, 255; // var(--color-text)
            --rgb-input: 27, 27, 27;
          `;
        case 'light':
        default:
          return `
            --background-rgb: 249, 249, 249; // var(--color-cell-background)
            --rgb-background: 249, 249, 249;
            --rgb-color: 0, 0, 0; // var(--color-text)
            --rgb-input: 249, 249, 249;
        `;
      }
    }}

    ${props =>
      !props.isModal &&
      `
      &:after {
        content: '';
        position: absolute;
        top: calc(100% - 40px);
        left: calc(100% - 79px);
        width: 22px;
        height: 22px;
        background-color: var(--color-cell-background);
        transform: rotate(45deg);
        border-radius: 3px;
        transform: scaleY(1.4) rotate(45deg);
        border: 0.7px solid var(--color-session-border);
        clip-path: polygon(100% 100%, 7.2px 100%, 100% 7.2px);
      }
    `}
  }
`;

type Props = {
  onEmojiClicked: (emoji: FixedBaseEmoji) => void;
  show: boolean;
  isModal?: boolean;
  onKeyDown?: (event: any) => void;
};

const pickerProps: FixedPickerProps = {
  title: '',
  showPreview: true,
  autoFocus: true,
  skinTonePosition: 'preview',
};

export const SessionEmojiPanel = forwardRef<HTMLDivElement, Props>((props: Props, ref) => {
  const { onEmojiClicked, show, isModal = false, onKeyDown } = props;
  const theme = useSelector(getTheme);
  const pickerRef = ref as MutableRefObject<HTMLDivElement>;

  useEffect(() => {
    let isCancelled = false;
    if (pickerRef.current !== null) {
      if (pickerRef.current.children.length === 0) {
        loadEmojiPanelI18n()
          .then(async i18n => {
            if (isCancelled) {
              return;
            }
            // tslint:disable-next-line: no-unused-expression
            new Picker({
              data,
              ref,
              i18n,
              theme,
              onEmojiSelect: onEmojiClicked,
              onKeyDown,
              ...pickerProps,
            });
          })
          .catch(noop);
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [data, pickerProps]);

  return (
    <StyledEmojiPanel
      isModal={isModal}
      theme={theme}
      className={classNames(show && 'show')}
      ref={ref}
    />
  );
});
