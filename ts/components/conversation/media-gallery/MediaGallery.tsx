// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import moment from 'moment';

import { AttachmentSection } from './AttachmentSection';
import { EmptyState } from './EmptyState';
import { groupMediaItemsByDate } from './groupMediaItemsByDate';
import { ItemClickEvent } from './types/ItemClickEvent';
import { missingCaseError } from '../../../util/missingCaseError';
import { LocalizerType } from '../../../types/Util';
import { getMessageTimestamp } from '../../../util/getMessageTimestamp';

import { MediaItemType } from '../../LightboxGallery';

export type Props = {
  documents: Array<MediaItemType>;
  i18n: LocalizerType;
  media: Array<MediaItemType>;

  onItemClick?: (event: ItemClickEvent) => void;
};

type State = {
  selectedTab: 'media' | 'documents';
};

const MONTH_FORMAT = 'MMMM YYYY';

type TabSelectEvent = {
  type: 'media' | 'documents';
};

const Tab = ({
  isSelected,
  label,
  onSelect,
  type,
}: {
  isSelected: boolean;
  label: string;
  onSelect?: (event: TabSelectEvent) => void;
  type: 'media' | 'documents';
}) => {
  const handleClick = onSelect
    ? () => {
        onSelect({ type });
      }
    : undefined;

  return (
    // Has key events handled elsewhere
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      className={classNames(
        'module-media-gallery__tab',
        isSelected ? 'module-media-gallery__tab--active' : null
      )}
      onClick={handleClick}
      role="tab"
      tabIndex={0}
    >
      {label}
    </div>
  );
};

export class MediaGallery extends React.Component<Props, State> {
  public readonly focusRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: Props) {
    super(props);
    this.state = {
      selectedTab: 'media',
    };
  }

  public componentDidMount(): void {
    // When this component is created, it's initially not part of the DOM, and then it's
    //   added off-screen and animated in. This ensures that the focus takes.
    setTimeout(() => {
      if (this.focusRef.current) {
        this.focusRef.current.focus();
      }
    });
  }

  public render(): JSX.Element {
    const { selectedTab } = this.state;

    return (
      <div className="module-media-gallery" tabIndex={-1} ref={this.focusRef}>
        <div className="module-media-gallery__tab-container">
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
        <div className="module-media-gallery__content">
          {this.renderSections()}
        </div>
      </div>
    );
  }

  private readonly handleTabSelect = (event: TabSelectEvent): void => {
    this.setState({ selectedTab: event.type });
  };

  private renderSections() {
    const { i18n, media, documents, onItemClick } = this.props;
    const { selectedTab } = this.state;

    const mediaItems = selectedTab === 'media' ? media : documents;
    const type = selectedTab;

    if (!mediaItems || mediaItems.length === 0) {
      const label = (() => {
        switch (type) {
          case 'media':
            return i18n('mediaEmptyState');

          case 'documents':
            return i18n('documentsEmptyState');

          default:
            throw missingCaseError(type);
        }
      })();

      return <EmptyState data-test="EmptyState" label={label} />;
    }

    const now = Date.now();
    const sections = groupMediaItemsByDate(now, mediaItems).map(section => {
      const first = section.mediaItems[0];
      const { message } = first;
      const date = moment(getMessageTimestamp(message));
      const header =
        section.type === 'yearMonth'
          ? date.format(MONTH_FORMAT)
          : i18n(section.type);

      return (
        <AttachmentSection
          key={header}
          header={header}
          i18n={i18n}
          type={type}
          mediaItems={section.mediaItems}
          onItemClick={onItemClick}
        />
      );
    });

    return <div className="module-media-gallery__sections">{sections}</div>;
  }
}
