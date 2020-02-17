import React from 'react';

interface Props{};

interface State{};


export class SessionConversation extends React.Component<Props, State> {    
    public constructor(props: Props) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <div className="inbox-view">
                THIS IS AN INBOX VIEW
            </div>
        )
    }
}