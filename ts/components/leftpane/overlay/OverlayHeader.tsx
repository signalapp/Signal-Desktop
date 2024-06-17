import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { setLeftOverlayMode } from '../../../state/ducks/section';
import { Flex } from '../../basic/Flex';
import { SpacerSM } from '../../basic/Text';
import { SessionIconButton } from '../../icon';

const StyledPrimaryBorder = styled.hr`
  position: absolute;
  color: var(--primary-color);
  background-color: var(--primary-color);

  height: 5px;
  left: -10px;
  right: -10px;
  margin-top: 7px;
  border: none;
  z-index: 1;
`;

const StyledBackgroundBorder = styled.hr`
  color: var(--background-primary-color);
  background-color: var(--background-primary-color);
  width: 100%;
  position: relative;
  height: 1px;
  opacity: 0.3;
  margin-top: 2px;
  margin-bottom: 40px;
`;

const StyledTitle = styled.h2`
  text-align: center;
  margin-top: 0px;
`;

const StyledSubTitle = styled.h3`
  text-align: center;
  padding-top: 22px;
  position: relative;
  margin-bottom: 6px;
`;

export const OverlayHeader = ({ subtitle, title }: { title: string; subtitle: string }) => {
  const dispatch = useDispatch();
  const returnToActionChooser = () => {
    dispatch(setLeftOverlayMode('choose-action'));
  };

  return (
    <>
      <Flex container={true} width="100%" padding="var(--margins-xs)">
        <SessionIconButton
          iconSize="medium"
          iconType="chevron"
          iconRotation={90}
          onClick={returnToActionChooser}
        />
      </Flex>

      <SpacerSM />

      <StyledTitle>{title}</StyledTitle>

      <StyledSubTitle>
        {subtitle}
        <StyledPrimaryBorder />
      </StyledSubTitle>
      <StyledBackgroundBorder />
    </>
  );
};
