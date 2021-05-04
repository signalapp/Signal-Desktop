import React from 'react';

import { ConversationListItemWithDetails } from '../ConversationListItem';
import { RowRendererParamsType } from '../LeftPane';
import { AutoSizer, List } from 'react-virtualized';
import { ConversationType as ReduxConversationType } from '../../state/ducks/conversations';
import { DefaultTheme } from 'styled-components';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import autoBind from 'auto-bind';

export interface Props {
  directContacts: Array<ReduxConversationType>;
  theme: DefaultTheme;
  openConversationExternal: (id: string, messageId?: string) => void;
}

export class LeftPaneContactSection extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
    autoBind(this);
  }

  public renderHeader(): JSX.Element | undefined {
    return <LeftPaneSectionHeader label={window.i18n('contactsHeader')} theme={this.props.theme} />;
  }

  public render(): JSX.Element {
    return (
      <div className="left-pane-contact-section">
        {this.renderHeader()}
        {this.renderContacts()}
      </div>
    );
  }

  public renderRow = ({ index, key, style }: RowRendererParamsType): JSX.Element | undefined => {
    const { directContacts } = this.props;
    const item = directContacts[index];

    return (
      <ConversationListItemWithDetails
        key={item.id}
        style={style}
        {...item}
        i18n={window.i18n}
        onClick={this.props.openConversationExternal}
      />
    );
  };

  private renderContacts() {
    return <div className="left-pane-contact-content">{this.renderList()}</div>;
  }

  private renderList() {
    const { directContacts } = this.props;
    const length = Number(directContacts.length);

    const list = (
      <div className="module-left-pane__list" key={0}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="module-left-pane__virtual-list"
              height={height}
              directContacts={directContacts} // needed for change in props refresh
              rowCount={length}
              rowHeight={64}
              rowRenderer={this.renderRow}
              width={width}
              autoHeight={false}
            />
          )}
        </AutoSizer>
      </div>
    );

    return [list];
  }
}
