import React, { ReactNode } from 'react';
import styled from 'styled-components';
import { nonNullish } from '../../../session/utils/String';
import { OpacityMetadataComponent } from './MessageMetadata';

type BadgeProps = {
  badge: string;
  direction: string;
  withImageNoCaption: boolean;
  children?: ReactNode;
};

const BadgeText = styled(props => <OpacityMetadataComponent {...props} />)<BadgeProps>`
  font-weight: bold;
  padding-inline-end: 5px;
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  user-select: none;
  color: ${props => (props.withImageNoCaption ? 'white' : props.theme.colors.textColor)};
`;

const BadgeSeparator = styled(props => <OpacityMetadataComponent {...props} />)<{
  withImageNoCaption: boolean;
}>`
  margin-top: -2px;
  color: ${props => (props.withImageNoCaption ? 'white' : props.theme.colors.textColor)};
`;

export const MetadataBadge = (props: BadgeProps): JSX.Element => {
  return (
    <>
      <BadgeSeparator {...props}>&nbsp;•&nbsp;</BadgeSeparator>
      <BadgeText {...props} children={props.badge} />
    </>
  );
};

type BadgesProps = {
  id: string;
  direction: string;
  isPublic?: boolean;
  isAdmin?: boolean;
  withImageNoCaption: boolean;
};

export const MetadataBadges = (props: BadgesProps): JSX.Element => {
  const { id, direction, isPublic, isAdmin, withImageNoCaption } = props;
  const badges = [(isPublic && 'Public') || null, (isPublic && isAdmin && 'Mod') || null].filter(
    nonNullish
  );

  if (!badges || badges.length === 0) {
    return <></>;
  }

  const badgesElements = badges.map(badgeText => (
    <MetadataBadge
      key={`${id}-${badgeText}`}
      badge={badgeText}
      direction={direction}
      withImageNoCaption={withImageNoCaption}
    />
  ));

  return <>{badgesElements}</>;
};
