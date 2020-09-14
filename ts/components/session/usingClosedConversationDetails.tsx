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
        let members = await GroupUtils.getGroupMembers(PubKey.cast(groupId));
        const ourPrimary = await UserUtil.getPrimary();
        members = members.filter(m => m.key !== ourPrimary.key);
        members.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        const membersConvos = members.map(
          m => window.ConversationController.get(m.key).cachedProps
        );
        // no need to forward more than 2 conversation for rendering the group avatar
        membersConvos.slice(0, 2);
        this.setState({ closedMemberConversations: membersConvos });
      }
    }
  };
}
