import { GroupUtils } from '../../session/utils';
import { UserUtil } from '../../util';
import { PubKey } from '../../session/types';
import React from 'react';
import { ConversationAttributes } from '../../../js/models/conversations';
type State = {
  closedMemberConversations?: Array<ConversationAttributes>;
};

export function usingClosedConversationDetails(WrappedComponent: any) {
  return class extends React.Component<any, State> {
    constructor(props: any) {
      super(props);
      this.state = {
        closedMemberConversations: undefined,
      };
    }

    public componentDidMount() {
      void this.fetchClosedConversationDetails();
    }

    public componentDidUpdate() {
      void this.fetchClosedConversationDetails();
    }

    public render() {
      return (
        <WrappedComponent
          closedMemberConversations={this.state.closedMemberConversations}
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
        const ourPrimary = await UserUtil.getPrimary();
        let members = await GroupUtils.getGroupMembers(PubKey.cast(groupId));

        const ourself = members.find(m => m.key !== ourPrimary.key);
        // add ourself back at the back, so it's shown only if only 1 member and we are still a member
        members = members.filter(m => m.key !== ourPrimary.key);
        members.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        if (ourself) {
          members.push(ourPrimary);
        }
        // no need to forward more than 2 conversation for rendering the group avatar
        members.slice(0, 2);
        const membersConvos = await Promise.all(
          members.map(
            async m =>
              (
                await window.ConversationController.getOrCreateAndWait(
                  m.key,
                  'private'
                )
              ).cachedProps
          )
        );
        this.setState({ closedMemberConversations: membersConvos });
      }
    }
  };
}
