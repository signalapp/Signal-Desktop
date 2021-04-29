import React, { useReducer } from 'react';
import { useSelector } from 'react-redux';
import { joinOpenGroupV2WithUIEvents } from '../../opengroup/opengroupV2/JoinOpenGroupV2';
import { StateType } from '../../state/reducer';
import { Avatar, AvatarSize } from '../Avatar';
import { Flex } from '../basic/Flex';
import { PillContainer } from '../basic/PillContainer';
// tslint:disable: no-void-expression

export type JoinableRoomProps = {
  completeUrl: string;
  name: string;
  imageId?: string;
  onClick: (completeUrl: string) => void;
};

const SessionJoinableRoomAvatar = (props: JoinableRoomProps) => {
  return (
    <Avatar
      size={AvatarSize.XS}
      {...props}
      onAvatarClick={() => props.onClick(props.completeUrl)}
    />
  );
};

const SessionJoinableRoomName = (props: JoinableRoomProps) => {
  return <Flex padding="0 10px">{props.name}</Flex>;
};

const SessionJoinableRoomRow = (props: JoinableRoomProps) => {
  return (
    <PillContainer
      onClick={() => {
        props.onClick(props.completeUrl);
      }}
      margin="5px"
      padding="5px"
    >
      <SessionJoinableRoomAvatar {...props} />
      <SessionJoinableRoomName {...props} />
    </PillContainer>
  );
};

export const SessionJoinableRooms = () => {
  const joinableRooms = useSelector((state: StateType) => state.defaultRooms);

  if (!joinableRooms?.length) {
    console.warn('no default joinable rooms yet');
    return <></>;
  }

  return (
    <Flex container={true} flexGrow={1} flexWrap="wrap">
      {joinableRooms.map(r => {
        return (
          <SessionJoinableRoomRow
            key={r.id}
            completeUrl={r.completeUrl}
            name={r.name}
            onClick={completeUrl => {
              void joinOpenGroupV2WithUIEvents(completeUrl, true);
            }}
          />
        );
      })}
    </Flex>
  );
};
