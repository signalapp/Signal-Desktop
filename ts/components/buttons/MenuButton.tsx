import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { resetLeftOverlayMode, setLeftOverlayMode } from '../../state/ducks/section';
import { getLeftOverlayMode } from '../../state/selectors/section';
import { SessionIcon } from '../icon';

const StyledMenuButton = styled.button`
  position: relative;
  display: inline-block;

  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--menu-button-background-color);

  border-radius: 2px;
  width: 51px;
  height: 33px;
  cursor: pointer;

  transition: var(--default-duration);

  :hover {
    background: var(--menu-button-background-hover-color);
  }
`;

/**
 * This is the Session Menu Button. i.e. the button on top of the conversation list to start a new conversation.
 * It has two state: selected or not and so we use an checkbox input to keep the state in sync.
 */
export const MenuButton = () => {
  const leftOverlayMode = useSelector(getLeftOverlayMode);
  const dispatch = useDispatch();

  const isToggled = Boolean(leftOverlayMode);

  const onClickFn = () =>
    dispatch(isToggled ? resetLeftOverlayMode() : setLeftOverlayMode('choose-action'));

  return (
    <StyledMenuButton data-testid="new-conversation-button" onClick={onClickFn}>
      <SessionIcon
        iconSize="small"
        iconType="plusFat"
        iconColor="var(--menu-button-icon-color)"
        iconRotation={isToggled ? 45 : 0}
        aria-label={window.i18n('chooseAnAction')}
      />
    </StyledMenuButton>
  );
};
