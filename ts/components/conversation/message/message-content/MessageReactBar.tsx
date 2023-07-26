import { isEqual } from 'lodash';
import React, { ReactElement, useState } from 'react';
import useMount from 'react-use/lib/useMount';
import styled from 'styled-components';

import { RecentReactions } from '../../../../types/Reaction';
import { nativeEmojiData } from '../../../../util/emoji';
import { getRecentReactions } from '../../../../util/storage';
import { SessionIconButton } from '../../../icon';

type Props = {
  action: (...args: Array<any>) => void;
  additionalAction: (...args: Array<any>) => void;
};

const StyledMessageReactBar = styled.div`
  background-color: var(--emoji-reaction-bar-background-color);
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
    margin: 0 4px;
    &:hover svg {
      background-color: var(--chat-buttons-background-hover-color);
    }
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
    background-color: var(--chat-buttons-background-hover-color);
  }
`;

export const MessageReactBar = (props: Props): ReactElement => {
  const { action, additionalAction } = props;
  const [recentReactions, setRecentReactions] = useState<RecentReactions>();

  useMount(() => {
    const reactions = new RecentReactions(getRecentReactions());
    if (reactions && !isEqual(reactions, recentReactions)) {
      setRecentReactions(reactions);
    }
  });

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
        iconColor={'var(--emoji-reaction-bar-icon-color)'}
        iconPadding={'8px'}
        iconSize={'huge'}
        iconType="plusThin"
        backgroundColor={'var(--emoji-reaction-bar-icon-background-color)'}
        borderRadius="300px"
        onClick={additionalAction}
      />
    </StyledMessageReactBar>
  );
};
