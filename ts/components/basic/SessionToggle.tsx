import React from 'react';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { white } from '../../state/ducks/SessionTheme';

const StyledKnob = styled.div<{ active: boolean }>`
  position: absolute;
  top: 0.5px;
  left: 0.5px;
  height: 21px;
  width: 21px;
  border-radius: 28px;
  background-color: ${white};
  box-shadow: ${props =>
    props.active ? '-2px 1px 3px rgba(0, 0, 0, 0.15)' : '2px 1px 3px rgba(0, 0, 0, 0.15);'};

  transition: transform var(--default-duration) ease, background-color var(--default-duration) ease;

  transform: ${props => (props.active ? 'translateX(25px)' : '')};
`;

const StyledSessionToggle = styled.div<{ active: boolean }>`
  width: 51px;
  height: 25px;
  border: 1px solid #e5e5ea; // TODO Theming update
  border-radius: 16px;
  position: relative;

  cursor: pointer;
  background-color: var(--color-transparent-color);
  transition: var(--default-duration);

  background-color: ${props =>
    props.active ? 'var(--color-accent)' : 'var(--color-clickable-hovered)'};
  border-color: ${props => (props.active ? 'var(--color-accent)' : 'var(--color-cell-background)')};
`;

type Props = {
  active: boolean;
  onClick: () => void;
  confirmationDialogParams?: any | undefined;
};

export const SessionToggle = (props: Props) => {
  const dispatch = useDispatch();

  const clickHandler = (event: React.MouseEvent<HTMLDivElement>) => {
    const stateManager = (e: any) => {
      e.stopPropagation();
      props.onClick();
    };

    if (props.confirmationDialogParams && props.confirmationDialogParams.shouldShowConfirm) {
      // If item needs a confirmation dialog to turn ON, render it
      const closeConfirmModal = () => {
        dispatch(updateConfirmModal(null));
      };

      dispatch(
        updateConfirmModal({
          onClickOk: () => {
            stateManager(event);
            closeConfirmModal();
          },
          onClickClose: () => {
            updateConfirmModal(null);
          },
          ...props.confirmationDialogParams,
          updateConfirmModal,
        })
      );

      return;
    }

    stateManager(event);
  };

  return (
    <StyledSessionToggle role="button" onClick={clickHandler} active={props.active}>
      <StyledKnob active={props.active} />
    </StyledSessionToggle>
  );
};
