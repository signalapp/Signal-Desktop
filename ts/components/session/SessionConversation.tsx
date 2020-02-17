import React from 'react';

import TextareaAutosize from 'react-autosize-textarea';

import { ConversationHeader } from '../conversation/ConversationHeader';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';

interface Props{
    getHeaderProps: any;
    
};

interface State{};


export class SessionConversation extends React.Component<Props, State> {    
    constructor(props: any) {
        super(props);
        this.state = {};
    }

    render() {
        // const headerProps = this.props.getHeaderProps;

        // TMEPORARY SOLUTION TO GETTING CONVERSATION UNTIL
        // SessionConversationStack is created
        const conversation = window.getConversations().models[0];

        return (
            <div className={`conversation-item conversation-${conversation.cid}`}>

                <div className="conversation-header">
                    {this.renderHeader(conversation)}
                </div>

                <div className="messages-container">
                    THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW THIS IS AN INBOX VIEW 
                </div>

                <div className="composition-container">
                    <SessionIconButton
                        iconType={SessionIconType.CirclePlus}
                        iconSize={SessionIconSize.Large}
                    />
                    <SessionIconButton
                        iconType={SessionIconType.Microphone}
                        iconSize={SessionIconSize.Large}
                    />

                    <div className="send-message-input">
                        <TextareaAutosize
                            rows={1}
                            maxRows={6}
                        />
                    </div>

                    <SessionIconButton
                        iconType={SessionIconType.Emoji}
                        iconSize={SessionIconSize.Large}
                    />
                    <div className="send-message-button">
                        <SessionIconButton
                            iconType={SessionIconType.Send}
                            iconSize={SessionIconSize.Large}
                            iconColor={'#FFFFFF'}
                            iconRotation={90}
                        />
                    </div>
                </div>
            </div>
        )
    }

    renderHeader(conversation: any) {
        return (
          <ConversationHeader
            id={conversation.cid}
            phoneNumber={conversation.id}
            isVerified={true}
            isMe={false}
            isFriend={true}
            i18n={window.i18n}
            isGroup={false}
            isArchived={false}
            isPublic={false}
            isRss={false}
            amMod={false}
            members={[]}
            showBackButton={false}
            timerOptions={[]}
            isBlocked={false}
            hasNickname={false}
            isFriendRequestPending={false}
            isOnline={true}
            selectedMessages={null}
            onSetDisappearingMessages={() => null}
            onDeleteMessages={() => null}
            onDeleteContact={() => null}
            onResetSession={() => null}
            onCloseOverlay={() => null}
            onDeleteSelectedMessages={() => null}
            onArchive={() => null}
            onMoveToInbox={() => null}
            onShowSafetyNumber={() => null}
            onShowAllMedia={() => null}
            onShowGroupMembers={() => null}
            onGoBack={() => null}
            onBlockUser={() => null}
            onUnblockUser={() => null}
            onClearNickname={() => null}
            onChangeNickname={() => null}
            onCopyPublicKey={() => null}
            onLeaveGroup={() => null}
            onAddModerators={() => null}
            onRemoveModerators={() => null}
            onInviteFriends={() => null}
          />
        );
    }
}