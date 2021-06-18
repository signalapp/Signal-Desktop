import React from 'react';

import _ from 'lodash';

import { getTheme } from '../state/selectors/theme';

import Electron from 'electron';
const { shell } = Electron;

import { useSelector } from 'react-redux';
import { StateType } from '../state/reducer';
import { SessionIcon, SessionIconButton, SessionIconSize, SessionIconType } from './session/icon';

import { SessionWrapperModal } from '../components/session/SessionWrapperModal';

import ip2country from 'ip2country';
import countryLookup from 'country-code-lookup';
import { useTheme } from 'styled-components';
import { useNetwork } from '../hooks/useNetwork';
import { Snode } from '../data/data';

export type OnionPathModalType = {
  onConfirm?: () => void;
  onClose?: () => void;
  confirmText?: string;
  cancelText?: string;
  title?: string;
};

export type StatusLightType = {
  glowStartDelay: number;
  glowDuration: number;
  color?: string;
};

const OnionPathModalInner = (props: any) => {
  const onionNodes = useSelector((state: StateType) => state.onionPaths.snodePath);
  const onionPath = onionNodes;
  // including the device and destination in calculation
  const glowDuration = onionPath.length + 2;

  const nodes = [
    {
      label: window.i18n('device'),
    },
    ...onionNodes,
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

  let iconColor;
  const theme = useTheme();
  const firstOnionPath = useSelector((state: StateType) => state.onionPaths.snodePath);
  const hasOnionPath = firstOnionPath.length > 2;

  // Set icon color based on result
  const red = theme.colors.destructive;
  const green = theme.colors.accent;
  const orange = theme.colors.warning;

  iconColor = hasOnionPath ? theme.colors.accent : theme.colors.destructive;
  const onionState = useSelector((state: StateType) => state.onionPaths);

  iconColor = red;
  const isOnline = useNetwork();
  if (!(onionState && onionState.snodePath) || !isOnline) {
    iconColor = red;
  } else {
    const onionSnodePath = onionState.snodePath;
    if (onionState && onionSnodePath && onionSnodePath.length > 0) {
      const onionNodeCount = onionSnodePath.length;
      iconColor = onionNodeCount > 2 ? green : onionNodeCount > 1 ? orange : red;
    }
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

export const OnionPathModal = (props: OnionPathModalType) => {
  const onConfirm = () => {
    void shell.openExternal('https://getsession.org/faq/#onion-routing');
  };
  return (
    // tslint:disable-next-line: use-simple-attributes
    <SessionWrapperModal
      title={props.title || window.i18n('onionPathIndicatorTitle')}
      confirmText={props.confirmText || window.i18n('learnMore')}
      cancelText={props.cancelText || window.i18n('cancel')}
      onConfirm={onConfirm}
      onClose={props.onClose}
      showExitIcon={true}
    >
      <OnionPathModalInner {...props} />
    </SessionWrapperModal>
  );
};
