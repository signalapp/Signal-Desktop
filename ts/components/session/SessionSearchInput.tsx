import React from 'react';
import { animation, Item, Menu, MenuProvider } from 'react-contexify';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';

interface Props {
  searchString: string;
  onChange: any;
  handleNavigation?: any;
  placeholder: string;
}

export class SessionSearchInput extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public render() {
    const { searchString } = this.props;
    const triggerId = 'session-search-input-context';

    return (
      <>
        <MenuProvider id={triggerId}>
          <div className="session-search-input">
            <SessionIconButton
              iconSize={SessionIconSize.Medium}
              iconType={SessionIconType.Search}
            />
            <input
              value={searchString}
              onChange={e => this.props.onChange(e.target.value)}
              onKeyDown={this.handleKeyDown}
              placeholder={this.props.placeholder}
            />
          </div>
        </MenuProvider>
        <Menu id={triggerId} animation={animation.fade}>
          <Item onClick={() => document.execCommand('undo')}>
            {window.i18n('editMenuUndo')}
          </Item>
          <Item onClick={() => document.execCommand('redo')}>
            {window.i18n('editMenuRedo')}
          </Item>
          <hr />
          <Item onClick={() => document.execCommand('cut')}>
            {window.i18n('editMenuCut')}
          </Item>
          <Item onClick={() => document.execCommand('copy')}>
            {window.i18n('editMenuCopy')}
          </Item>
          <Item onClick={() => document.execCommand('paste')}>
            {window.i18n('editMenuPaste')}
          </Item>
          <Item onClick={() => document.execCommand('selectAll')}>
            {window.i18n('editMenuSelectAll')}
          </Item>
        </Menu>
      </>
    );
  }

  public handleKeyDown(e: any) {
    if (e.keyCode === 38 || e.keyCode === 40 || e.key === 'Enter') {
      // Up or Bottom arrow pressed
      if (this.props.handleNavigation) {
        e.stopPropagation();
        this.props.handleNavigation(e);
      }
    }
  }
}
