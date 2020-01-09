import React from 'react';
import ReactDOM from 'react-dom';

import { SessionSettingListItem } from './session/settings/SessionSettingListItem';

// interface State {
// }

// interface Props {

// }

// export class LeftPane extends React.Component<Props, State> {
//   public state = {
//   };

//   public constructor(props: any) {
//     super(props);
//   }


//   public render(): JSX.Element {
//     return (
//       <div>
//           Lorem ipsum dolor sit amet consectetur, adipisicing elit. Debitis, pariatur dicta placeat corporis similique modi quod veritatis voluptatum impedit tempore voluptas nostrum magni aspernatur iure, labore ipsam odit possimus exercitationem?
//       </div>
//     );
//   }

// }

export class MainViewController {
    public static renderMessageView() {
        const element = (
            <div className="conversation-stack">
                <div className="conversation placeholder">
                    <div className="conversation-header"></div>
                    <div className="container">
                        <div className="content">
                            <img src="images/session/brand.svg" className="session-filter-color-green session-logo-128"/>
                            <p className="session-logo-text">SESSION</p>
                        </div>
                    </div>
                </div>
            </div>
        );
        
        ReactDOM.render(element, document.getElementById('main-view'));
    }

    public static renderSettingsView() {
        const element = (
            <div className="session-settings-list">
                <SessionSettingListItem />
            </div>
        );
        
        ReactDOM.render(element, document.getElementById('main-view'));
    }
}