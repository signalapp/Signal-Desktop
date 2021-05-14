import React, { useState, useEffect } from 'react';
import { SessionButton, SessionButtonColor, SessionButtonType } from './session/SessionButton';
import { SessionModal } from './session/SessionModal';
import { DefaultTheme } from 'styled-components';
import { getPathNodesIPAddresses } from '../session/onions/onionSend';
import { useInterval } from '../hooks/useInterval';
import classNames from 'classnames';

import electron from 'electron';
const { shell } = electron;

interface OnionStatusDialogProps {
  theme: DefaultTheme;
  nodes?: Array<string>;
  onClose: any;
}

interface IPathNode {
  ip?: string;
  label: string;
}

const OnionPath = (props: { nodes: IPathNode[], hasPath: boolean }) => {
  const { nodes, hasPath } = props;

  return (
    <div className='onionPath'>
      {
        nodes.map((node) => {
          return (
            <div className='dotContainer'>
              <div className={classNames('dot', hasPath ? 'green' : 'red')}></div>
              <p>
                <b>{node.label}</b>
                {node.ip && (
                  <>
                    <br />
                    {node.ip}
                  </>
                )}
              </p>
            </div>
          )
        })
      }
    </div>
  )
}

export const OnionStatusDialog = (props: OnionStatusDialogProps) => {
  const { theme, onClose } = props;

  const [onionPathAddresses, setOnionPathAddresses] = useState<string[]>([])
  const [pathNodes, setPathNodes] = useState<IPathNode[]>([])
  const [hasPath, setHasPath] = useState<boolean>(false)

  const getOnionPathAddresses = () => {
    const onionPathAddresses = getPathNodesIPAddresses();
    console.log("Current Onion Path - ", onionPathAddresses);
    setOnionPathAddresses(onionPathAddresses)
  }

  const buildOnionPath = () => {
    // TODO: Add i18n to onion path
    // Default path values
    let path = [
      {
        label: 'You'
      },
      {
        ip: 'Connecting...',
        label: 'Entry Node'
      },
      {
        ip: 'Connecting...',
        label: 'Service Node'
      },
      {
        ip: 'Connecting...',
        label: 'Service Node'
      },
      {
        label: 'Destination'
      },
    ]

    // FIXME call function to check if an onion path exists
    setHasPath(onionPathAddresses.length !== 0);

    // if there is a onion path, update the addresses
    if (onionPathAddresses.length) {
      onionPathAddresses.forEach((ipAddress, index) => {
        const pathIndex = index + 1;
        path[pathIndex].ip = ipAddress;
      })
    }
    setPathNodes(path);
  }

  useInterval(() => {
    getOnionPathAddresses()
  }, 1000)

  useEffect(() => {
    buildOnionPath()
  }, [onionPathAddresses])

  const openFAQPage = () => {
    console.log("Opening FAQ Page")
    shell.openExternal('https://getsession.org/faq/#onion-routing');
  }

  return (
    <SessionModal
      title={window.i18n('onionPathIndicatorTitle')}
      theme={theme}
      onClose={onClose}
    >
      <div className="spacer-sm" />
      <div className='onionDescriptionContainer'>
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
}
