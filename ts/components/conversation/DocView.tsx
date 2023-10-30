import b64 from 'base64-js';
import { exampleSetup } from 'prosemirror-example-setup';
import { Schema } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import * as React from 'react';
import * as Y from 'yjs';
import { useProxySelector } from '../../hooks/useProxySelector';
import { StateType } from '../../state/reducer';

import { ySyncPlugin } from 'y-prosemirror';

class YjsBridge {
  private seenMessages = new Set<string>();

  public readonly doc = new Y.Doc();
  constructor(send: (message: any) => void) {
    this.doc.on('update', (update, origin) => {
      if (origin === this) {
        return;
      }
      const msg = b64.fromByteArray(update);
      send('$$' + msg);
    });
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
    Y.applyUpdate(this.doc, b64.toByteArray(message.body.substr(2)), this);
  }
}

export function DocView(props: { messages: string[]; addMessage: () => void }) {
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
    // view.current?.destroy();
    const mySchema = new Schema({
      nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
      marks: schema.spec.marks,
    });
    const type = manager.doc.getXmlFragment('data');

    view.current = new EditorView(parent.current, {
      state: EditorState.create({
        // doc: DOMParser.fromSchema(mySchema).parse(
        //   document.querySelector('#content')
        // ),
        schema: mySchema,
        plugins: [...exampleSetup({ schema: mySchema }), ySyncPlugin(type)],
      }),
    });
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
