import React from 'react';

import _ from 'lodash';

import { getTheme } from '../state/selectors/theme';

import Electron from 'electron';
const { shell } = Electron;

import { useDispatch, useSelector } from 'react-redux';
import { SessionIcon, SessionIconButton, SessionIconSize, SessionIconType } from './session/icon';

import { SessionWrapperModal } from './session/SessionWrapperModal';

import ip2country from 'ip2country';
import countryLookup from 'country-code-lookup';
import { useTheme } from 'styled-components';
import { Snode } from '../data/data';
import { onionPathModal } from '../state/ducks/modalDialog';
import {
  getFirstOnionPath,
  getFirstOnionPathLength,
  getOnionPathsCount,
} from '../state/selectors/onions';

// tslint:disable-next-line: no-submodule-imports
import useNetworkState from 'react-use/lib/useNetworkState';
import { SessionSpinner } from './session/SessionSpinner';
import { Flex } from './basic/Flex';

export type StatusLightType = {
  glowStartDelay: number;
  glowDuration: number;
  color?: string;
};

const OnionPathModalInner = () => {
  const onionPath = useSelector(getFirstOnionPath);
  // including the device and destination in calculation
  const glowDuration = onionPath.length + 2;
  if (!onionPath || onionPath.length === 0) {
    return <SessionSpinner loading={true} />;
  }

  const nodes = [
    {
      label: window.i18n('device'),
    },
    ...onionPath,
    {
      label: window.i18n('destination'),
    },
  ];

  return (
    <>
      <p className="onion__description">{window.i18n('onionPathIndicatorDescription')}</p>
      <div className="onion__node-list">
        <Flex container={true}>
          <div className="onion__node-list-lights">
            <div className="onion__vertical-line" />

            <Flex container={true} flexDirection="column" alignItems="center" height="100%">
              {nodes.map((_snode: Snode | any, index: number) => {
                return (
                  <OnionNodeStatusLight
                    glowDuration={glowDuration}
                    glowStartDelay={index}
                    key={index}
                  />
                );
              })}
            </Flex>
          </div>
          <Flex container={true} flexDirection="column" alignItems="flex-start">
            {nodes.map((snode: Snode | any, index: number) => {
              let labelText = snode.label
                ? snode.label
                : countryLookup.byIso(ip2country(snode.ip))?.country;
              if (!labelText) {
                labelText = window.i18n('unknownCountry');
              }
              return labelText ? <div className="onion__node__country">{labelText}</div> : null;
            })}
          </Flex>
        </Flex>
      </div>
    </>
  );
};

export type OnionNodeStatusLightType = {
  glowStartDelay: number;
  glowDuration: number;
};

/**
 * Component containing a coloured status light.
 */
export const OnionNodeStatusLight = (props: OnionNodeStatusLightType): JSX.Element => {
  const { glowStartDelay, glowDuration } = props;
  const theme = useTheme();

  return (
    <ModalStatusLight
      glowDuration={glowDuration}
      glowStartDelay={glowStartDelay}
      color={theme.colors.accent}
    />
  );
};

/**
 * An icon with a pulsating glow emission.
 */
export const ModalStatusLight = (props: StatusLightType) => {
  const { glowStartDelay, glowDuration, color } = props;
  const theme = useSelector(getTheme);

  return (
    <div className="onion__growing-icon">
      <SessionIcon
        borderRadius={50}
        iconColor={color}
        glowDuration={glowDuration}
        glowStartDelay={glowStartDelay}
        iconType={SessionIconType.Circle}
        iconSize={SessionIconSize.Tiny}
        theme={theme}
      />
    </div>
  );
};

/**
 * A status light specifically for the action panel. Color is based on aggregate node states instead of individual onion node state
 */
export const ActionPanelOnionStatusLight = (props: {
  isSelected: boolean;
  handleClick: () => void;
}) => {
  const { isSelected, handleClick } = props;

  const theme = useTheme();
  const onionPathsCount = useSelector(getOnionPathsCount);
  const firstPathLength = useSelector(getFirstOnionPathLength);
  const isOnline = useNetworkState().online;

  // Set icon color based on result
  const red = theme.colors.destructive;
  const green = theme.colors.accent;
  const orange = theme.colors.warning;

  // start with red
  let iconColor = red;
  //if we are not online or the first path is not valid, we keep red as color
  if (isOnline && firstPathLength > 1) {
    iconColor = onionPathsCount >= 2 ? green : onionPathsCount >= 1 ? orange : red;
  }

  return (
    <SessionIconButton
      iconSize={SessionIconSize.Small}
      iconType={SessionIconType.Circle}
      iconColor={iconColor}
      onClick={handleClick}
      isSelected={isSelected}
      theme={theme}
    />
  );
};

export const OnionPathModal = () => {
  const onConfirm = () => {
    void shell.openExternal('https://getsession.org/faq/#onion-routing');
  };
  const dispatch = useDispatch();
  return (
    // tslint:disable-next-line: use-simple-attributes
    <SessionWrapperModal
      title={window.i18n('onionPathIndicatorTitle')}
      confirmText={window.i18n('learnMore')}
      cancelText={window.i18n('cancel')}
      onConfirm={onConfirm}
      onClose={() => dispatch(onionPathModal(null))}
      showExitIcon={true}
    >
      <OnionPathModalInner />
    </SessionWrapperModal>
  );
};
