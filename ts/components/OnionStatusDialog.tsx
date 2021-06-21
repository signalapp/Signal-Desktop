import React from 'react';

import _ from 'lodash';

import { getTheme } from '../state/selectors/theme';

import Electron from 'electron';
const { shell } = Electron;

import { useDispatch, useSelector } from 'react-redux';
import { StateType } from '../state/reducer';
import { SessionIcon, SessionIconButton, SessionIconSize, SessionIconType } from './session/icon';

import { SessionWrapperModal } from '../components/session/SessionWrapperModal';

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

export type StatusLightType = {
  glowStartDelay: number;
  glowDuration: number;
  color?: string;
};

const OnionPathModalInner = () => {
  const onionPath = useSelector(getFirstOnionPath);
  // including the device and destination in calculation
  const glowDuration = onionPath.length + 2;

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
        {nodes.map((snode: Snode | any, index: number) => {
          return (
            <OnionNodeStatusLight
              glowDuration={glowDuration}
              glowStartDelay={index}
              label={snode.label}
              snode={snode}
              key={index}
            />
          );
        })}
      </div>
    </>
  );
};

export type OnionNodeStatusLightType = {
  snode: Snode;
  label?: string;
  glowStartDelay: number;
  glowDuration: number;
};

/**
 * Component containing a coloured status light and an adjacent country label.
 */
export const OnionNodeStatusLight = (props: OnionNodeStatusLightType): JSX.Element => {
  const { snode, label, glowStartDelay, glowDuration } = props;
  const theme = useTheme();

  let labelText = label ? label : countryLookup.byIso(ip2country(snode.ip))?.country;
  if (!labelText) {
    labelText = window.i18n('unknownCountry');
  }
  return (
    <div className="onion__node">
      <ModalStatusLight
        glowDuration={glowDuration}
        glowStartDelay={glowStartDelay}
        color={theme.colors.accent}
      />
      {labelText ? (
        <>
          <div className="onion-node__country">{labelText}</div>
        </>
      ) : null}
    </div>
  );
};

/**
 * An icon with a pulsating glow emission.
 */
export const ModalStatusLight = (props: StatusLightType) => {
  const { glowStartDelay, glowDuration, color } = props;
  const theme = useSelector(getTheme);

  return (
    <SessionIcon
      borderRadius={50}
      iconColor={color}
      glowDuration={glowDuration}
      glowStartDelay={glowStartDelay}
      iconType={SessionIconType.Circle}
      iconSize={SessionIconSize.Medium}
      theme={theme}
    />
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
      iconSize={SessionIconSize.Medium}
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
