import React from 'react';
import { SessionToggle } from '../SessionToggle';

interface Props {
}


// export settings = {
//   id
//   category
//   name
//   description
//   type (toggle, dropdown, etc)
// }


export class SessionSettingListItem extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
    this.state = {
    };
  }



  public render(): JSX.Element {
    return (
      <div className="session-settings-item">
        <div className="session-settings-item__info">
          <div className="session-settings-item__title">
                Typing indicators
          </div>

          <div className="session-settings-item__description">
              This is the description of the super usper awesome setting item
          </div>
        </div>

        <div className="session-sessings-item__selection">
          <SessionToggle active={true} />
        </div>
        
      </div>
    );
  }

}
