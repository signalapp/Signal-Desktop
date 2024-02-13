import styled from 'styled-components';
import { SessionIcon, SessionIconType } from '../../../../icon';

const NotificationBubbleFlex = styled.div`
  display: flex;
  background: var(--message-bubbles-received-background-color);
  color: var(--text-primary-color);
  width: 90%;
  max-width: 700px;
  margin: 5px auto 10px auto; // top margin is smaller that bottom one to make the stopwatch icon of expirable message closer to its content
  padding: 5px 10px;
  border-radius: 16px;
  word-break: break-word;
  text-align: center;
  align-items: center;
`;

const NotificationBubbleText = styled.div`
  color: inherit;
  margin: auto auto;
`;

const NotificationBubbleIconContainer = styled.div`
  margin: auto 10px;
  width: 15px;
  height: 25px;
`;

export const NotificationBubble = (props: {
  notificationText: string;
  iconType?: SessionIconType;
  iconColor?: string;
}) => {
  const { notificationText, iconType, iconColor } = props;
  return (
    <NotificationBubbleFlex>
      {iconType && (
        <NotificationBubbleIconContainer>
          <SessionIcon
            iconSize="small"
            iconType={iconType}
            iconColor={iconColor}
            iconPadding="auto 10px"
          />
        </NotificationBubbleIconContainer>
      )}
      <NotificationBubbleText>{notificationText}</NotificationBubbleText>
      {iconType && <NotificationBubbleIconContainer />}
    </NotificationBubbleFlex>
  );
};
