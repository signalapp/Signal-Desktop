import React, { useEffect, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  joinOpenGroupV2WithUIEvents,
  parseOpenGroupV2,
} from '../../opengroup/opengroupV2/JoinOpenGroupV2';
import { downloadPreviewOpenGroupV2 } from '../../opengroup/opengroupV2/OpenGroupAPIV2';
import { StateType } from '../../state/reducer';
import { Avatar, AvatarSize } from '../Avatar';
import { Flex } from '../basic/Flex';
import { PillContainer } from '../basic/PillContainer';
import { H3 } from '../basic/Text';
// tslint:disable: no-void-expression

export type JoinableRoomProps = {
  completeUrl: string;
  name: string;
  imageId?: string;
  onClick: (completeUrl: string) => void;
};

const SessionJoinableRoomAvatar = (props: JoinableRoomProps) => {
  const [base64Data, setBase64Data] = useState('');

  useEffect(() => {
    try {
      const parsedInfos = parseOpenGroupV2(props.completeUrl);
      if (parsedInfos) {
        void downloadPreviewOpenGroupV2(parsedInfos)
          .then(base64 => {
            setBase64Data(base64 || '');
          })
          .catch(e => {
            window.log.warn('downloadPreviewOpenGroupV2 failed', e);
            setBase64Data('');
          });
      }
    } catch (e) {
      console.warn(e);
    }
  }, [props.imageId, props.completeUrl]);
  return (
    <Avatar
      size={AvatarSize.XS}
      base64Data={base64Data}
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
    <Flex container={true} flexGrow={1} flexDirection="column" width="93%">
      <H3 text={window.i18n('orJoinOneOfThese')} />
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
    </Flex>
  );
};
