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
import { SessionIconButton, SessionIconSize, SessionIconType } from './session/icon';
import { Constants } from '../session';
const { shell } = electron;

import { SessionWrapperModal } from '../components/session/SessionWrapperModal';
import { Snode } from '../session/onions';

import ip2country from "ip2country";
import countryLookup from "country-code-lookup";

// import ipLocation = require('ip-location');


// interface OnionStatusDialogProps {
//   theme: DefaultTheme;
//   nodes?: Array<string>;
//   onClose: any;
// }

// export interface IPathNode {
//   ip?: string;
//   label: string;
// }

// export const OnionPath = (props: { nodes: IPathNode[]; hasPath: boolean }) => {
//   const { nodes, hasPath } = props;

//   return (
//     <div className="onionPath">
//       {nodes.map(node => {
//         return OnionPathNode({ hasPath, node });
//       })}
//     </div>
//   );
// };

// export const OnionStatusDialog = (props: OnionStatusDialogProps) => {
//   const { theme, onClose } = props;

//   const [onionPathAddresses, setOnionPathAddresses] = useState<string[]>([]);
//   const [pathNodes, setPathNodes] = useState<IPathNode[]>([]);
//   const [hasPath, setHasPath] = useState<boolean>(false);

//   const getOnionPathAddresses = () => {
//     const onionPathAddresses = getPathNodesIPAddresses();
//     console.log('Current Onion Path - ', onionPathAddresses);
//     setOnionPathAddresses(onionPathAddresses);
//   };

//   const buildOnionPath = () => {
//     // TODO: Add i18n to onion path
//     // Default path values
//     let path = [
//       {
//         label: 'You',
//       },
//       {
//         ip: 'Connecting...',
//         label: 'Entry Node',
//       },
//       {
//         ip: 'Connecting...',
//         label: 'Service Node',
//       },
//       {
//         ip: 'Connecting...',
//         label: 'Service Node',
//       },
//       {
//         label: 'Destination',
//       },
//     ];

//     // FIXME call function to check if an onion path exists
//     setHasPath(onionPathAddresses.length !== 0);

//     // if there is a onion path, update the addresses
//     if (onionPathAddresses.length) {
//       onionPathAddresses.forEach((ipAddress, index) => {
//         const pathIndex = index + 1;
//         path[pathIndex].ip = ipAddress;
//       });
//     }
//     setPathNodes(path);
//   };

//   useInterval(() => {
//     getOnionPathAddresses();
//   }, 1000);

//   useEffect(() => {
//     buildOnionPath();
//   }, [onionPathAddresses]);

//   const openFAQPage = () => {
//     console.log('Opening FAQ Page');
//     shell.openExternal('https://getsession.org/faq/#onion-routing');
//   };

//   return (
//     <SessionModal title={window.i18n('onionPathIndicatorTitle')} theme={theme} onClose={onClose}>
//       <div className="spacer-sm" />
//       <div className="onionDescriptionContainer">
//         <p>{window.i18n('onionPathIndicatorDescription')}</p>
//       </div>

//       <OnionPath nodes={pathNodes} hasPath={hasPath} />

//       <SessionButton
//         text={window.i18n('learnMore')}
//         buttonType={SessionButtonType.BrandOutline}
//         buttonColor={SessionButtonColor.Green}
//         onClick={openFAQPage}
//       />
//     </SessionModal>
//   );
// };

const OnionPathModalInner = (props: any) => {
  const onionPath = useSelector((state: StateType) => state.onionPaths.snodePath);

  
  return (
    <div className="onion__node-list">
      {onionPath.path.map((snode: Snode, index: number) => {
        return (
          <>
            <LabelledStatusLight snode={snode} ></LabelledStatusLight>
          </>
        );
      })}
  {/* TODO: Destination node maybe pass in light colour maybe changes based on if 3 nodes are connected similar to the action panel light? */}
      <LabelledStatusLight label={'Destination'}></LabelledStatusLight>
    </div>
  );
};


/**
 * Component containing a coloured status light and an adjacent country label.
 * @param props 
 * @returns 
 */
export const LabelledStatusLight = (props: any): JSX.Element => {
  let { snode, label } = props;

  let labelText = label ? label : countryLookup.byIso(ip2country(snode.ip))?.country;
  console.log('@@@@ country data:: ', labelText);
  if (!labelText) {
    labelText = `${snode.ip} - Destination unknown`;
    console.log(`@@@@ country data failure on code:: ${ip2country(snode.ip)} and ip ${snode.ip}`);
  }
  return (
    <div className="onion__node">
      <StatusLight color={Constants.UI.COLORS.GREEN}></StatusLight>
      {labelText ?
        <>
          <div className="onion-node__country">{labelText}</div>
        </>
        :
        null
      }
    </div>
  )
}

export const OnionNodeLight = (props: any) => {

}

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
