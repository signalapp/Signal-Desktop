import React, { useContext, useEffect, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  joinOpenGroupV2WithUIEvents,
  parseOpenGroupV2,
} from '../../opengroup/opengroupV2/JoinOpenGroupV2';
import { downloadPreviewOpenGroupV2 } from '../../opengroup/opengroupV2/OpenGroupAPIV2';
import { updateDefaultBase64RoomData } from '../../state/ducks/defaultRooms';
import { StateType } from '../../state/reducer';
import { Avatar, AvatarSize } from '../Avatar';
import { Flex } from '../basic/Flex';
import { PillContainer } from '../basic/PillContainer';
import { H3 } from '../basic/Text';
// tslint:disable: no-void-expression

export type JoinableRoomProps = {
  completeUrl: string;
  name: string;
  roomId: string;
  imageId?: string;
  onClick: (completeUrl: string) => void;
  base64Data?: string;
};

const SessionJoinableRoomAvatar = (props: JoinableRoomProps) => {
  useEffect(() => {
    try {
      const parsedInfos = parseOpenGroupV2(props.completeUrl);
      if (parsedInfos) {
        if (props.base64Data) {
          return;
        }
        void downloadPreviewOpenGroupV2(parsedInfos)
          .then(base64 => {
            const payload = {
              roomId: props.roomId,
              base64Data: base64 || '',
            };
            window.inboxStore?.dispatch(updateDefaultBase64RoomData(payload));
          })
          .catch(e => {
            window.log.warn('downloadPreviewOpenGroupV2 failed', e);
            const payload = {
              roomId: props.roomId,
              base64Data: '',
            };
            window.inboxStore?.dispatch(updateDefaultBase64RoomData(payload));
          });
      }
    } catch (e) {
      window.log.warn(e);
    }
  }, [props.imageId, props.completeUrl]);
  return (
    <Avatar
      size={AvatarSize.XS}
      base64Data={props.base64Data}
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
    window.log.info('no default joinable rooms yet');
    return <></>;
  }

  return (
    <Flex container={true} flexGrow={1} flexDirection="column" width="93%">
      <H3 text={window.i18n('orJoinOneOfThese')} />
      <Flex container={true} flexGrow={1} flexWrap="wrap">
        {joinableRooms.map(r => {
          return (
            <SessionJoinableRoomRow
              key={r.id}
              completeUrl={r.completeUrl}
              name={r.name}
              roomId={r.id}
              base64Data={r.base64Data}
              onClick={completeUrl => {
                void joinOpenGroupV2WithUIEvents(completeUrl, true);
              }}
            />
          );
        })}
      </Flex>
    </Flex>
  );
};
