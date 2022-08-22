import React, { ReactElement, useEffect, useState } from 'react';
import styled from 'styled-components';
import { getRecentReactions } from '../../../../util/storage';
import { SessionIconButton } from '../../../icon';
import { nativeEmojiData } from '../../../../util/emoji';
import { isEqual } from 'lodash';
import { RecentReactions } from '../../../../types/Reaction';

type Props = {
  action: (...args: Array<any>) => void;
  additionalAction: (...args: Array<any>) => void;
};

const StyledMessageReactBar = styled.div`
  background-color: var(--color-received-message-background);
  border-radius: 25px;
  box-shadow: 0 2px 16px 0 rgba(0, 0, 0, 0.2), 0 0px 20px 0 rgba(0, 0, 0, 0.19);

  position: absolute;
  top: -56px;
  padding: 4px 8px;
  white-space: nowrap;
  width: 302px;

  display: flex;
  align-items: center;

  .session-icon-button {
    border-color: transparent !important;
    box-shadow: none !important;
    margin: 0 4px;
  }
`;

const ReactButton = styled.span`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;

  border-radius: 300px;
  cursor: pointer;
  font-size: 24px;

  :hover {
    background-color: var(--color-compose-view-button-background);
  }
`;

export const MessageReactBar = (props: Props): ReactElement => {
  const { action, additionalAction } = props;
  const [recentReactions, setRecentReactions] = useState<RecentReactions>();

  useEffect(() => {
    const reactions = new RecentReactions(getRecentReactions());
    if (reactions && !isEqual(reactions, recentReactions)) {
      setRecentReactions(reactions);
    }
  }, []);

  if (!recentReactions) {
    return <></>;
  }

  return (
    <StyledMessageReactBar>
      {recentReactions &&
        recentReactions.items.map(emoji => (
          <ReactButton
            key={emoji}
            role={'img'}
            aria-label={nativeEmojiData?.ariaLabels ? nativeEmojiData.ariaLabels[emoji] : undefined}
            onClick={() => {
              action(emoji);
            }}
          >
            {emoji}
          </ReactButton>
        ))}
      <SessionIconButton
        iconColor={'var(--color-text)'}
        iconPadding={'12px'}
        iconSize={'huge2'}
        iconType="plusThin"
        backgroundColor={'var(--color-compose-view-button-background)'}
        borderRadius="300px"
        onClick={additionalAction}
      />
    </StyledMessageReactBar>
  );
};
