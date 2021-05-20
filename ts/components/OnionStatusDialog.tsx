import React, { useState, useEffect } from 'react';
import { SessionButton, SessionButtonColor, SessionButtonType } from './session/SessionButton';
import { SessionModal } from './session/SessionModal';
import { DefaultTheme } from 'styled-components';
import { getPathNodesIPAddresses } from '../session/onions/onionSend';
import { useInterval } from '../hooks/useInterval';
import classNames from 'classnames';

import _ from 'lodash';

import { getTheme } from '../state/selectors/theme';

import electron from 'electron';
import { useSelector } from 'react-redux';
import { StateType } from '../state/reducer';
import { OnionPathNodeType } from '../state/ducks/onion';
import { SessionIconButton, SessionIconSize, SessionIconType } from './session/icon';
import { Constants } from '../session';
const { shell } = electron;

import { SessionWrapperModal } from '../components/session/SessionWrapperModal';

interface OnionStatusDialogProps {
  theme: DefaultTheme;
  nodes?: Array<string>;
  onClose: any;
}

export interface IPathNode {
  ip?: string;
  label: string;
}

export const OnionPath = (props: { nodes: IPathNode[]; hasPath: boolean }) => {
  const { nodes, hasPath } = props;

  return (
    <div className="onionPath">
      {nodes.map(node => {
        // return OnionPathNode(hasPath, node)
        return OnionPathNode({ hasPath, node });
      })}
    </div>
  );
};

export const OnionStatusDialog = (props: OnionStatusDialogProps) => {
  const { theme, onClose } = props;

  const [onionPathAddresses, setOnionPathAddresses] = useState<string[]>([]);
  const [pathNodes, setPathNodes] = useState<IPathNode[]>([]);
  const [hasPath, setHasPath] = useState<boolean>(false);

  const getOnionPathAddresses = () => {
    const onionPathAddresses = getPathNodesIPAddresses();
    console.log('Current Onion Path - ', onionPathAddresses);
    setOnionPathAddresses(onionPathAddresses);
  };

  const buildOnionPath = () => {
    // TODO: Add i18n to onion path
    // Default path values
    let path = [
      {
        label: 'You',
      },
      {
        ip: 'Connecting...',
        label: 'Entry Node',
      },
      {
        ip: 'Connecting...',
        label: 'Service Node',
      },
      {
        ip: 'Connecting...',
        label: 'Service Node',
      },
      {
        label: 'Destination',
      },
    ];

    // FIXME call function to check if an onion path exists
    setHasPath(onionPathAddresses.length !== 0);

    // if there is a onion path, update the addresses
    if (onionPathAddresses.length) {
      onionPathAddresses.forEach((ipAddress, index) => {
        const pathIndex = index + 1;
        path[pathIndex].ip = ipAddress;
      });
    }
    setPathNodes(path);
  };

  useInterval(() => {
    getOnionPathAddresses();
  }, 1000);

  useEffect(() => {
    buildOnionPath();
  }, [onionPathAddresses]);

  const openFAQPage = () => {
    console.log('Opening FAQ Page');
    shell.openExternal('https://getsession.org/faq/#onion-routing');
  };

  return (
    <SessionModal title={window.i18n('onionPathIndicatorTitle')} theme={theme} onClose={onClose}>
      <div className="spacer-sm" />
      <div className="onionDescriptionContainer">
        <p>{window.i18n('onionPathIndicatorDescription')}</p>
      </div>

      <OnionPath nodes={pathNodes} hasPath={hasPath} />

      <SessionButton
        text={window.i18n('learnMore')}
        buttonType={SessionButtonType.BrandOutline}
        buttonColor={SessionButtonColor.Green}
        onClick={openFAQPage}
      />
    </SessionModal>
  );
};

// export const OnionPathNode = (hasPath: boolean, node: IPathNode): JSX.Element => {
// export const OnionPathNode = (hasPath: boolean, node: any): JSX.Element => {
// export const OnionPathNode = (hasPath: boolean, node: any) => {
// export const OnionPathNode = (hasPath: any, node: any) => {
export const OnionPathNode = (props: any) => {
  const { hasPath, node } = props;

  const theme = useSelector(getTheme);
  console.log('@@@ onionpathnode theme', theme);

  const onionPaths = useSelector((state: StateType) => state.onionPaths);
  console.log('@@@ state onion path node', onionPaths);

  // if (!(node && node.label && node.ip)) {
  //   return <div>{'Onion' + JSON.stringify(onionPaths)}</div>;
  // }

  // let connectedNodesCounts = onionPaths.nodes.reduce()
  let connectedNodesCount = _.sumBy(onionPaths.nodes, (node: OnionPathNodeType) => {
    return node.isConnected ? 1 : 0;
  });

  if (true) {
    console.log('@@@', connectedNodesCount);
    return (
      // <SessionIconButton

      // />
      <div className="idk"></div>
    );
  }

  return (
    <div className="dotContainer">
      <div className={classNames('dot', hasPath ? 'green' : 'red')}></div>
      <p>
        {node && node.label ? <b>{node.label}</b> : null}
        {node.ip && (
          <>
            <br />
            {node.ip}
          </>
        )}
      </p>
    </div>
  );
};

const OnionPathModalInner = (props: any) => {
  const onionPaths = useSelector((state: StateType) => state.onionPaths);

  // let connectedNodesCount = _.sumBy(onionPaths.nodes, (node: OnionPathNodeType) => {
  //   return node.isConnected ? 1 : 0;
  // })


  return (
    <div className="onion-node-list">
      {/* <div className="onion-node__vertical-line"></div> */}
      {onionPaths.nodes.map((node: OnionPathNodeType, index: number) => {
        let nodeStatusColor = node.isConnected
          ? Constants.UI.COLORS.GREEN
          : node.isAttemptingConnect
            ? Constants.UI.COLORS.WARNING
            : Constants.UI.COLORS.DANGER;
        return (
          <>
            <div className="onion__node">
              {index <= onionPaths.nodes.map.length ?
                <div className="line"></div>
                :
                null
              }
              <StatusLight color={nodeStatusColor}></StatusLight>
              {node.ip ?
                <div className="onion-node__country">country</div>
                :
                null
              }
            </div>
          </>
        );
      })}
    </div>
  );
};

export const StatusLight = (props: any) => {
  const [showModal, toggleShowModal] = useState(false);
  const { isSelected, color } = props;
  const theme = useSelector(getTheme);
  const onClick = () => {
    toggleShowModal(!showModal);
  };

  return (
    <>
      <SessionIconButton
        iconSize={SessionIconSize.Small}
        iconType={SessionIconType.Circle}
        iconColor={color}
        theme={theme}
        isSelected={isSelected}
        onClick={onClick}
      />

      {showModal ? (
        <SessionWrapperModal onclick={onClick} showModal={showModal}>
          <OnionPathModalInner></OnionPathModalInner>
        </SessionWrapperModal>
      ) : null}
    </>
  );
};
