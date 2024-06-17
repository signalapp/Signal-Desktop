import { MouseEvent } from 'react';
import { contextMenu } from 'react-contexify';
import styled from 'styled-components';

type SProps = {
  onArrowClick: (e: MouseEvent<HTMLDivElement>) => void;
  onMainButtonClick: (e: MouseEvent<HTMLDivElement>) => void;
  isMuted?: boolean;
  isFullScreen?: boolean;
  iconType: 'microphone' | 'camera' | 'volume';
};

const StyledRoundedButton = styled.div<{ isFullScreen: boolean; isMuted: boolean }>`
  border-radius: 50%;
  cursor: pointer;
  transition-duration: var(--default-duration);
  background-color: ${props =>
    props.isMuted
      ? 'var(--call-buttons-background-disabled-color)'
      : props.isFullScreen
        ? 'var(--call-buttons-action-background-color)'
        : 'var(--call-buttons-background-color)'};
  color: ${props =>
    props.isMuted
      ? 'var(--call-buttons-icon-disabled-color)'
      : props.isFullScreen
        ? 'var(--call-buttons-action-icon-color)'
        : 'var(--call-buttons-icon-color)'};

  ${props => props.isFullScreen && 'opacity: 0.4;'}
  &:hover {
    background-color: ${props =>
      props.isFullScreen
        ? 'var(--call-buttons-action-background-hover-color)'
        : 'var(--call-buttons-background-hover-color)'};
    color: ${props =>
      props.isFullScreen
        ? 'var(--call-buttons-action-icon-color)'
        : 'var(--call-buttons-icon-color)'};
    ${props => props.isFullScreen && 'opacity: 1;'}
  }
`;

const StyledContainer = styled(StyledRoundedButton)`
  width: 60px;
  height: 60px;
  margin: 10px;
`;

const StyledMainIcon = styled.div`
  padding: 20px;
`;

const StyledArrowIcon = styled(StyledRoundedButton)`
  width: 35%;
  height: 35%;
  position: relative;
  top: -35%;
  right: -65%;
  background-color: var(--call-buttons-background-color);
  color: var(--call-buttons-dropdown-color);
  box-shadow: var(--call-buttons-dropdown-shadow);

  &:hover {
    background-color: var(--call-buttons-background-hover-color);
  }
`;

const CameraIcon = (
  <svg viewBox="0 0 488.3 488.3" fill="currentColor">
    <path d="M488.3,142.5v203.1c0,15.7-17,25.5-30.6,17.7l-84.6-48.8v13.9c0,41.8-33.9,75.7-75.7,75.7H75.7C33.9,404.1,0,370.2,0,328.4   V159.9c0-41.8,33.9-75.7,75.7-75.7h221.8c41.8,0,75.7,33.9,75.7,75.7v13.9l84.6-48.8C471.3,117,488.3,126.9,488.3,142.5Z" />
  </svg>
);

const SpeakerIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const MicrophoneIcon = (
  <svg viewBox="0 0 58 58" fill="currentColor">
    <path d="M44,28c-0.552,0-1,0.447-1,1v6c0,7.72-6.28,14-14,14s-14-6.28-14-14v-6c0-0.553-0.448-1-1-1s-1,0.447-1,1v6c0,8.485,6.644,15.429,15,15.949V56h-5c-0.552,0-1,0.447-1,1s0.448,1,1,1h12c0.552,0,1-0.447,1-1s-0.448-1-1-1h-5v-5.051c8.356-0.52,15-7.465,15-15.949v-6C45,28.447,44.552,28,44,28zM29,46c6.065,0,11-4.935,11-11V11c0-6.065-4.935-11-11-11S18,4.935,18,11v24C18,41.065,22.935,46,29,46z" />
  </svg>
);

export const DropDownAndToggleButton = (props: SProps) => {
  const { iconType, isFullScreen = false, onArrowClick, onMainButtonClick, isMuted } = props;
  const arrowClickHandler = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onArrowClick(e);
  };

  const mainButtonClickHandler = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    contextMenu.hideAll();
    onMainButtonClick(e);
  };
  const iconToRender =
    iconType === 'microphone' ? MicrophoneIcon : iconType === 'camera' ? CameraIcon : SpeakerIcon;

  return (
    <StyledContainer
      className="session-call-button"
      isFullScreen={isFullScreen}
      isMuted={isMuted || false}
    >
      <StyledMainIcon onClick={mainButtonClickHandler}>{iconToRender}</StyledMainIcon>
      {!isFullScreen && (
        <StyledArrowIcon isFullScreen={isFullScreen} isMuted={false} onClick={arrowClickHandler}>
          <svg viewBox="-200 -200 640 640" fill="currentColor">
            <path d="M127.5 191.25L255 63.75L0 63.75L127.5 191.25Z" />
          </svg>
        </StyledArrowIcon>
      )}
    </StyledContainer>
  );
};
