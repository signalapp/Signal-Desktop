import * as automerge from '@automerge/automerge';
import {
  PatchSemaphore,
  plugin as amgPlugin,
  init as initPm,
} from '@automerge/prosemirror';
import { DocHandlePatchPayload, Repo } from 'automerge-repo';
import { exampleSetup } from 'prosemirror-example-setup';
import { Schema } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import 'prosemirror-view/style/prosemirror.css';
import * as React from 'react';

import { useProxySelector } from '../../hooks/useProxySelector';
import { StateType } from '../../state/reducer';
// TODO: create AM bridge / network provider
class YjsBridge {
  private seenMessages = new Set<string>();

  // public readonly doc = new Y.Doc();
  constructor(send: (message: any) => void) {
    // this.doc.on('update', (update, origin) => {
    // if (origin === this) {
    //   return;
    // }
    // const msg = b64.fromByteArray(update);
    // send('$$' + msg);
    // });
  }

  public addMessage(id, message: any) {
    debugger;
    if (this.seenMessages.has(id)) {
      return;
    }
    this.seenMessages.add(id);
    if (!message.body.startsWith('$$')) {
      return;
    }
    // Y.applyUpdate(this.doc, b64.toByteArray(message.body.substr(2)), this);
  }
}
const repo = new Repo({
  network: [],
});
const path = ['text'];

export function DocViewInner(props: {
  messages: string[];
  addMessage: () => void;
}) {
  const parent = React.useRef(document.createElement('div'));
  const view = React.useRef<EditorView | null>(null);
  const manager = React.useMemo(() => new YjsBridge(props.addMessage), []);

  const lookup = useProxySelector((state: StateType) => {
    return state.conversations.messagesLookup;
  });

  React.useEffect(() => {
    props.messages.forEach(m => {
      manager.addMessage(m, lookup[m]);
    });
  }, [manager, props.messages, lookup]);

  // const messages = props.messages.map(id => lookup[id].body);
  // return <div />;
  // return
  // const editor = useBlockNote({});

  // Renders the editor instance using a React component.
  // React.useEffect(async () => {
  //   // const lib = await import('@blocknote/react');
  //   console.log('HELLO', useBlockNote);
  // }, []);

  React.useEffect(() => {
    const handle = repo.create();
    handle.change(doc => {
      // @ts-ignore
      if (!doc.text) {
        // @ts-ignore
        doc.text = new automerge.Text();
      }
    });

    // view.current?.destroy();
    const mySchema = new Schema({
      nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
      marks: schema.spec.marks,
    });

    const semaphore = new PatchSemaphore();
    const doChange = (
      atHeads: automerge.Heads,
      fn: (d: automerge.Doc<any>) => void
    ): automerge.Doc<any> => {
      handle.changeAt(atHeads, fn);
      return handle.doc;
    };
    view.current = new EditorView(parent.current, {
      state: EditorState.create({
        // doc: DOMParser.fromSchema(mySchema).parse(
        //   document.querySelector('#content')
        // ),
        schema: mySchema,
        plugins: [
          ...exampleSetup({ schema: mySchema }),
          amgPlugin(handle.doc, path),
        ],
        doc: initPm(handle.doc, path),
      }),
      dispatchTransaction: (tx: Transaction) => {
        const newState = semaphore.intercept(doChange, tx, view.current!.state);
        view.current!.updateState(newState);
      },
    });

    const onPatch = (p: DocHandlePatchPayload<any>) => {
      const newState = semaphore.reconcilePatch(
        p.after,
        p.patches,
        view.current!.state
      );
      view.current!.updateState(newState);
    };
    handle.on('patch', onPatch);
  }, [manager]);

  const editor = React.useCallback(el => {
    if (el && parent.current?.parentElement !== el) {
      el.appendChild(parent.current);
    }
  }, []);

  return (
    <div style={{ height: '100%' }}>
      <div key="editor" ref={editor} style={{ height: '100%' }} />
    </div>
  );
}
