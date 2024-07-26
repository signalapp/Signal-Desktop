import styled from 'styled-components';
import { useRightOverlayMode } from '../../../hooks/useUI';
import { isRtlBody } from '../../../util/i18n';
import { Flex } from '../../basic/Flex';
import { OverlayRightPanelSettings } from './overlay/OverlayRightPanelSettings';
import { OverlayDisappearingMessages } from './overlay/disappearing-messages/OverlayDisappearingMessages';
import { OverlayMessageInfo } from './overlay/message-info/OverlayMessageInfo';

export const StyledRightPanelContainer = styled.div`
  position: absolute;
  height: var(--right-panel-height);
  width: var(--right-panel-width);
  right: 0vw;

  transition: transform var(--duration-right-panel) linear;
  transform: translateX(100%);
  z-index: 3;

  background-color: var(--background-primary-color);
  border-left: 1px solid var(--border-color);

  &.show {
    transform: translateX(0);
  }
`;

const StyledRightPanel = styled(Flex)`
  h2 {
    word-break: break-word;
  }
  .description {
    margin: var(--margins-md) 0;
    min-height: 4rem;
    width: inherit;
    color: var(--text-secondary-color);
    text-align: center;
    display: none;
  }
  // no double border (top and bottom) between two elements
  &-item + &-item {
    border-top: none;
  }
  .module-empty-state {
    text-align: center;
  }
  .module-attachment-section__items {
    &-media {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      width: 100%;
    }
    &-documents {
      width: 100%;
    }
  }
  .module-media {
    &-gallery {
      &__tab-container {
        padding-top: 1rem;
      }
      &__tab {
        color: var(--text-primary-color);
        font-weight: bold;
        font-size: 0.9rem;
        padding: 0.6rem;
        opacity: 0.8;
        &--active {
          border-bottom: none;
          opacity: 1;
          &:after {
            content: ''; /* This is necessary for the pseudo element to work. */
            display: block;
            margin: 0 auto;
            width: 70%;
            padding-top: 0.5rem;
            border-bottom: 4px solid var(--primary-color);
          }
        }
      }
      &__content {
        padding: var(--margins-xs);
        margin-bottom: 1vh;
        .module-media-grid-item__image,
        .module-media-grid-item {
          height: calc(
            var(--right-panel-width) / 4
          ); //.right-panel is var(--right-panel-width) and we want three rows with some space so divide it by 4
          width: calc(
            var(--right-panel-width) / 4
          ); //.right-panel is var(--right-panel-width) and we want three rows with some space so divide it by 4
          margin: auto;
        }
      }
    }
  }
`;

const ClosableOverlay = () => {
  const rightOverlayMode = useRightOverlayMode();

  switch (rightOverlayMode?.type) {
    case 'disappearing_messages':
      return <OverlayDisappearingMessages />;
    case 'message_info':
      return <OverlayMessageInfo />;
    default:
      return <OverlayRightPanelSettings />;
  }
};

export const RightPanel = () => {
  const isRtlMode = isRtlBody();

  return (
    <StyledRightPanel
      container={true}
      flexDirection={'column'}
      alignItems={'center'}
      width={'var(--right-panel-width)'}
      height={'var(--right-panel-height)'}
      className="right-panel"
      style={{ direction: isRtlMode ? 'rtl' : 'initial' }}
    >
      <ClosableOverlay />
    </StyledRightPanel>
  );
};
