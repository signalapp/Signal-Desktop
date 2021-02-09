import { GroupUtils, UserUtils } from '../../session/utils';
import { PubKey } from '../../session/types';
import React from 'react';
import * as _ from 'lodash';
import { ConversationController } from '../../session/conversations';

export type ConversationAvatar = {
  avatarPath?: string;
  id?: string; // member's pubkey
  name?: string;
};

type State = {
  memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
};

export function usingClosedConversationDetails(WrappedComponent: any) {
  return class extends React.Component<any, State> {
    constructor(props: any) {
      super(props);
      this.state = {
        memberAvatars: undefined,
      };
    }

    public componentDidMount() {
      void this.fetchClosedConversationDetails();
    }

    public componentWillReceiveProps() {
      void this.fetchClosedConversationDetails();
    }

    public render() {
      return (
        <WrappedComponent
          memberAvatars={this.state.memberAvatars}
          {...this.props}
        />
      );
    }

    private async fetchClosedConversationDetails() {
      const {
        isPublic,
        type,
        conversationType,
        isGroup,
        phoneNumber,
        id,
      } = this.props;

      if (
        !isPublic &&
        (conversationType === 'group' || type === 'group' || isGroup)
      ) {
        const groupId = id || phoneNumber;
        const ourPrimary = UserUtils.getOurPubKeyFromCache();
        let members = await GroupUtils.getGroupMembers(PubKey.cast(groupId));

        const ourself = members.find(m => m.key !== ourPrimary.key);
        // add ourself back at the back, so it's shown only if only 1 member and we are still a member
        members = members.filter(m => m.key !== ourPrimary.key);
        members.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        if (ourself) {
          members.push(ourPrimary);
        }
        // no need to forward more than 2 conversations for rendering the group avatar
        members = members.slice(0, 2);
        const memberConvos = await Promise.all(
          members.map(async m =>
            ConversationController.getInstance().getOrCreateAndWait(
              m.key,
              'private'
            )
          )
        );
        const memberAvatars = memberConvos.map(m => {
          return {
            avatarPath: m.getAvatar()?.url || undefined,
            id: m.id,
            name: m.get('name') || m.get('profileName') || m.id,
          };
        });
        this.setState({ memberAvatars });
      } else {
        this.setState({ memberAvatars: undefined });
      }
    }
  };
}
