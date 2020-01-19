import React from 'react';
import classNames from 'classnames';

import { SessionButton, SessionButtonColor } from '../SessionButton';

interface Props {
    title: string;
    description: string;
    onClick: any;
}

export class SessionLinkedDeviceListItem extends React.Component<Props> {
    public constructor(props: Props) {
        super(props);
    }

    public render(): JSX.Element {
        const { title, description, onClick } = this.props;

        return (
            <div className={classNames('session-settings-item', 'inline')} >
                <div className="session-settings-item__info">
                    <div className="session-settings-item__title">{title}</div>
                    <div className="session-settings-item__description">
                        {description}
                    </div>
                </div>
                <div className="session-settings-item__content">
                    <SessionButton
                        text={window.i18n('unpairDevice')}
                        buttonColor={SessionButtonColor.Danger}
                        onClick={onClick}
                    />
                </div>
            </div >
        );
    }
}
