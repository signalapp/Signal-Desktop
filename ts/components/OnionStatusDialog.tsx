import React from 'react';

import _ from 'lodash';

import { getTheme } from '../state/selectors/theme';

import electron from 'electron';
import { useSelector } from 'react-redux';
import { StateType } from '../state/reducer';
import { SessionIcon, SessionIconSize, SessionIconType } from './session/icon';
const { shell } = electron;

import { SessionWrapperModal } from '../components/session/SessionWrapperModal';
import { Snode } from '../session/onions';

import ip2country from 'ip2country';
import countryLookup from 'country-code-lookup';
import { useTheme } from 'styled-components';

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
  const onionPath = onionNodes.path;
  // including the device and destination in calculation
  const glowDuration = onionPath.length + 2;

  const nodes = [
    {
      label: window.i18n('device'),
    },
    ...onionNodes.path,
    ,
    {
      label: window.i18n('destination'),
    },
  ];

  return (
    <div className="onion__node-list">
      {nodes.map((snode: Snode | any, index: number) => {
        return (
          <>
            <OnionNodeStatusLight
              glowDuration={glowDuration}
              glowStartDelay={index}
              label={snode.label}
              snode={snode}
            ></OnionNodeStatusLight>
          </>
        );
      })}
    </div>
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
 * @param props
 * @returns
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
      <StatusLight
        glowDuration={glowDuration}
        glowStartDelay={glowStartDelay}
        color={theme.colors.accent}
      ></StatusLight>
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
export const StatusLight = (props: StatusLightType) => {
  const { glowStartDelay, glowDuration, color } = props;
  const theme = useSelector(getTheme);

  return (
    <>
      <SessionIcon
        borderRadius={50}
        iconColor={color}
        glowDuration={glowDuration}
        glowStartDelay={glowStartDelay}
        iconType={SessionIconType.Circle}
        iconSize={SessionIconSize.Medium}
        theme={theme}
      />
    </>
  );
};

export const OnionPathModal = (props: OnionPathModalType) => {
  const onConfirm = () => {
    shell.openExternal('https://getsession.org/faq/#onion-routing');
  };
  return (
    <SessionWrapperModal
      title={props.title || window.i18n('onionPathIndicatorTitle')}
      confirmText={props.confirmText || window.i18n('learnMore')}
      cancelText={props.cancelText || window.i18n('cancel')}
      onConfirm={onConfirm}
      onClose={props.onClose}
      showExitIcon={true}
    >
      <OnionPathModalInner {...props}></OnionPathModalInner>
    </SessionWrapperModal>
  );
};
