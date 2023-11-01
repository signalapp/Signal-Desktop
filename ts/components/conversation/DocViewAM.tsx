// import { default as loadWasm } from '@automerge/automerge-wasm';
// import loadWasm from '@automerge/automerge-wasm';
import 'prosemirror-view/style/prosemirror.css';
import * as React from 'react';
// import wasmUrl from '../../../node_modules/@automerge/automerge-wasm/nodejs/automerge_wasm_bg.wasm';
// console.log('wasm', loadWasm);

export function DocView(props: any): JSX.Element | null {
  const [DocViewInner, setDocViewInner] = React.useState<any>(null);
  React.useEffect(async () => {
    debugger;
    // const ret = await wasmUrl(imports);
    const inner = await import('./DocViewAMInner');

    setDocViewInner(inner);
  }, []);
  if (!DocViewInner) {
    return null;
  }
  return <DocViewInner {...props} />;
}
