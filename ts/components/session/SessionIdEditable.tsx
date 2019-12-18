import React from 'react';


interface Props {
    placeholder: string;
    editable?: boolean;
    onChange?: any;
}


export class SessionIdEditable extends React.PureComponent<Props> {

    public render() {
        const { placeholder, editable, onChange } = this.props;

        return (
            <div
                className="session-id-editable"
                placeholder={placeholder}
                contentEditable={editable}
                onInput={(e: any) => {
                    if (editable) {
                        onChange(e);
                    }
                }}
            />
        );
    }
}
