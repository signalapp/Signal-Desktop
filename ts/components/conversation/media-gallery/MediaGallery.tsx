import React from 'react';

import { AttachmentListSection } from './AttachmentListSection';
import { Message } from './propTypes/Message';


type AttachmentType = 'media' | 'documents';

interface Props {
  i18n: (key: string, values?: Array<string>) => string;
  messages: Array<Message>;
}

interface State {
  selectedTab: AttachmentType;
}

const COLOR_GREY = '#f3f3f3';

const tabStyle = {
  width: '100%',
  backgroundColor: COLOR_GREY,
  padding: 20,
  textAlign: 'center',
};

const styles = {
  tabContainer: {
    cursor: 'pointer',
    display: 'flex',
    width: '100%',
  },
  tab: {
    default: tabStyle,
    active: {
      ...tabStyle,
      borderBottom: '2px solid #08f',
    },
  },
  attachmentsContainer: {
    padding: 20,
  },
};

interface TabSelectEvent {
  type: AttachmentType;
}

const Tab = ({
  isSelected,
  label,
  onSelect,
  type,
}: {
  isSelected: boolean,
  label: string,
  onSelect?: (event: TabSelectEvent) => void,
  type: AttachmentType,
}) => {
  const handleClick = onSelect ?
    () => onSelect({ type }) : undefined;

  return (
    <div
      style={isSelected ? styles.tab.active : styles.tab.default}
      onClick={handleClick}
    >
      {label}
    </div>
  );
};


export class MediaGallery extends React.Component<Props, State> {
  public state: State = {
    selectedTab: 'media',
  };

  public render() {
    const { selectedTab } = this.state;

    return (
      <div>
        <div style={styles.tabContainer}>
          <Tab
            label="Media"
            type="media"
            isSelected={selectedTab === 'media'}
            onSelect={this.handleTabSelect}
          />
          <Tab
            label="Documents"
            type="documents"
            isSelected={selectedTab === 'documents'}
            onSelect={this.handleTabSelect}
          />
        </div>
        <div style={styles.attachmentsContainer}>
          <AttachmentListSection
            type={selectedTab}
            i18n={this.props.i18n}
            messages={this.props.messages}
          />
        </div>
      </div>
    );
  }

  private handleTabSelect = (event: TabSelectEvent): void => {
    this.setState({selectedTab: event.type});
  }
}
