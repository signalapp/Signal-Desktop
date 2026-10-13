// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { enforceStaticClassNames } from './enforceStaticClassNames.mjs';
import { RuleTester } from '@typescript-eslint/rule-tester';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

const dynamic = /** @type {const} */ ({ messageId: 'dynamicClassName' });
const useHelper = /** @type {const} */ ({ messageId: 'useClassNamesHelper' });
const unverifiable = /** @type {const} */ ({
  messageId: 'unverifiableClassName',
});
const noTemplate = /** @type {const} */ ({
  messageId: 'noStaticTemplateLiteralClassName',
});
const singleClassName = /** @type {const} */ ({
  // oxlint-disable-next-line signal-desktop/enforce-class-name-has-styles
  messageId: 'noSingleClassNameInClassNames',
});

ruleTester.run('enforce-static-class-names', enforceStaticClassNames, {
  valid: [
    // Static JSX attributes
    { code: `<div className="static-jsx-attribute-value"/>` },
    { code: `<div className={"static"}/>` },

    { code: `<div className={undefined}/>` },
    { code: `<div className={cond ? 'a' : undefined}/>` },
    { code: `<div className={cond && 'a'}/>` },
    { code: `<div className={props.className ?? 'default'}/>` },
    { code: `<div className/>` },

    // classNames()
    {
      code: `<div className={classNames("a", cond && "b", cond ? "c" : null, ["d", ...["e"]], { "f": cond })}/>`,
    },
    { code: `classNames('a', { b: cond, 'c': cond })` },
    { code: `classNames({ ['a']: cond, [iconClassName]: cond })` },
    { code: `classNames(...['a', 'b'])` },
    { code: `classNames('a', cond && 'b')` },
    { code: `classNames(className)` },
    { code: `classNames(cond && 'a')` },
    { code: `classNames({ a: cond })` },
    { code: `classNames(['a', 'b'])` },
    { code: `classNames()` },

    // tw() is enforced elsewhere
    { code: `<div className={tw('p-4', cond && 'm-4')}/>` },
    { code: `<div className={classNames('legacy', tw('p-4'))}/>` },

    // axo css()/variants()
    { code: `<div className={css('axo-item-root', tw('group'))}/>` },
    { code: `<div className={css('axo-item-root')}/>` },
    { code: `css('example')` },
    {
      code: `
        const TextSizes = variants<Size>('AxoBadge.Size', {
          dot: tw('sr-only'),
          sm: tw('text-[8px] leading-3.5'),
        });
        <span className={TextSizes.get(size)}/>
      `,
    },
    {
      code: `
        const Slots = variants<Slot>('AxoBaseField.Slot', {
          leading: css('axo-field-leading'),
          trailing: css('axo-field-trailing'),
        });
        <span className={css(Slots.get('leading'), 'axo-field-icon')}/>
      `,
    },

    // Lookup tables
    {
      code: `
        const CLASSNAMES = { a: 'variant-a', b: 'variant-b' };
        <div className={CLASSNAMES[variant]}/>
      `,
    },
    {
      code: `
        const WidthBreakpointClassNames: Record<WidthBreakpoint, string> = {
          [WidthBreakpoint.Wide]: 'module-left-pane--width-wide',
          [WidthBreakpoint.Medium]: 'module-left-pane--width-medium',
        };
        <div className={WidthBreakpointClassNames[containerWidthBreakpoint]}/>
      `,
    },
    {
      code: `
        const STYLES = { foo: 'Foo', bar: 'Bar' } as const;
        <div className={STYLES.foo}/>
      `,
    },
    {
      code: `
        const STYLES = { foo: 'Foo', other: 42 };
        <div className={STYLES.foo}/>
      `,
    },
    {
      code: `
        const LIST = ['a', 'b'];
        <div className={LIST[index]}/>
      `,
    },
    {
      code: `
        const SIZE_CLASS_NAMES = new Map<ButtonSize, string>([
          [ButtonSize.Large, 'module-Button--large'],
          [ButtonSize.Medium, 'module-Button--medium'],
        ]);
        function Button({ size }) {
          const sizeClassName = SIZE_CLASS_NAMES.get(size);
          return <button className={classNames('module-Button', sizeClassName)}/>;
        }
      `,
    },

    // Props
    {
      code: `
        function Component(props: { className: string }) {
          return <div className={props.className}/>
        }
      `,
    },
    {
      code: `
        function Component(props: { iconClassName: string }) {
          return <div className={classNames('icon', props.iconClassName)}/>
        }
      `,
    },
    {
      code: `
        function Component({ className, iconClassName }) {
          return <div className={classNames(className, iconClassName)}/>
        }
      `,
    },
    {
      code: `
        class Component extends React.Component {
          render() {
            return <div className={classNames('quill', this.props.className)}/>;
          }
        }
      `,
    },
    { code: `function Foo({ className = 'Foo' }) {}` },
    { code: `const { iconClassName: icon = 'Foo__icon' } = props;` },
    {
      code: `
        export type FunGridHeaderIconProps = Readonly<{
          iconClassName: \`FunGrid__HeaderIcon--\${string}\`;
        }>;
      `,
    },

    // Passing class names to components and objects
    { code: `<CustomComponent iconClassName="NavTabs__ItemIcon--Chats"/>` },
    { code: `<CustomComponent iconClassName={cond ? 'a' : 'b'}/>` },
    { code: `const items = [{ iconClassName: 'foo' }];` },
    { code: `const props = { className: 'foo' }; <div {...props}/>` },
    { code: `const props = { className }; <div {...props}/>` },
    {
      code: `
        const rootProps = {
          className: classNames('ListTile', isClickable && 'ListTile--clickable', className),
          tabIndex: 0,
        };
      `,
    },

    // Variables named *ClassName are checked where they're assigned
    {
      code: `
        let muteClassName: string;
        if (hasAudio) {
          muteClassName = hasAllStoriesUnmuted ? 'StoryViewer__mute' : 'StoryViewer__unmute';
        } else {
          muteClassName = 'StoryViewer__soundless';
        }
        <button className={muteClassName}/>
      `,
    },
    {
      code: `
        let tooltipThemeClassName: string | null;
        if (theme === Theme.Light) {
          tooltipThemeClassName = 'module-tooltip--light-theme';
        } else {
          tooltipThemeClassName = null;
        }
        <div className={classNames('module-tooltip', tooltipThemeClassName)}/>
      `,
    },
    {
      code: `
        const baseClassName = isSticker
          ? 'module-message__sticker-container'
          : 'module-message__attachment-container';
        const containerClassName = classNames(baseClassName, withContentAbove ? 'a' : null);
        <div className={containerClassName}/>
      `,
    },

    // Constants are resolved
    {
      code: `
        const moduleName = 'module-message__metadata__date';
        <span className={classNames(moduleName, direction ? 'foo' : null)}/>
      `,
    },
    {
      code: `
        const commonClassNames = classNames('a', cond && 'b');
        <div className={commonClassNames}/>
      `,
    },
    {
      code: `
        const edgeStyles = tw('absolute');
        <div className={edgeStyles}/>
      `,
    },

    // Functions
    {
      code: `
        export function themeClassName(theme: Theme): string {
          switch (theme) {
            case Theme.Light:
              return 'light-theme';
            case Theme.Dark:
              return 'dark-theme';
            default:
              throw missingCaseError(theme);
          }
        }
        <div className={themeClassName(theme)}/>
      `,
    },
    { code: `<div className={themeClassName(theme)}/>` },
    { code: `<div className={getContainerClassName(variant)}/>` },
    { code: `const getClassName = () => 'foo';` },
    { code: `const getClassName = () => { return cond ? 'a' : 'b'; };` },
    {
      code: `
        const getClassName = useCallback(() => {
          return cond ? 'a' : 'b';
        }, [cond]);
      `,
    },
    {
      code: `
        const iconClassName = useMemo(() => {
          return cond ? 'a' : 'b';
        }, [cond]);
      `,
    },
    {
      code: `
        function getVariant(variant) {
          return variant === 'a' ? 'Foo--a' : 'Foo--b';
        }
        <div className={getVariant(variant)}/>
      `,
    },
    {
      code: `
        function getClassName() {
          const items = list.map(item => {
            return \`not-a-class-\${item}\`;
          });
          return 'foo';
        }
      `,
    },
    { code: `const obj = { getClassName() { return 'foo'; } };` },
    {
      code: `
        class Foo {
          iconClassName = 'foo';
          getClassName() {
            return 'foo';
          }
        }
      `,
    },

    // DOM APIs
    { code: `document.body.classList.add('light-theme');` },
    { code: `document.body.classList.remove('light-theme', 'dark-theme');` },
    { code: `document.body.classList.add(osClassName);` },
    {
      code: `document.body.classList.add(window.SignalContext.OS.getClassName());`,
    },
    {
      code: `quill.root.classList.toggle('ql-blank', quill.editor.isBlank());`,
    },
    { code: `element.className = 'foo';` },
    { code: `element.setAttribute('class', 'foo');` },

    // Not class names
    {
      code: `<div id={\`foo-\${bar}\`} data-testid={\`NavTabsItem--\${id}\`}/>`,
    },
    {
      code: `const descriptionId = \`FunGifsPanelItem__GifDescription--\${id}\`;`,
    },
    { code: `const classNameLike = \`foo-\${bar}\`;` },
    { code: `element.classList.contains;` },
  ],
  invalid: [
    // Joining complete class names must use classNames()
    {
      code: `<span className={\`NavTabs__ItemIcon \${iconClassName}\`}/>`,
      errors: [useHelper],
    },
    {
      code: `<div className={\`quill \${this.props.className}\`}/>`,
      errors: [useHelper],
    },
    {
      code: `<span className={\`\${className} Foo \${iconClassName}\`}/>`,
      errors: [useHelper],
    },
    {
      code: `<span className={\`Foo \${cond ? 'Foo--a' : 'Foo--b'}\`}/>`,
      errors: [useHelper],
    },
    {
      code: `<span className={\`\${className}\`}/>`,
      errors: [useHelper],
    },
    {
      code: `<span className={'Foo ' + className}/>`,
      errors: [useHelper],
    },
    {
      code: `<span className={className + ' ' + iconClassName}/>`,
      errors: [useHelper],
    },
    {
      code: `<span className={'Foo' + '--bar'}/>`,
      errors: [useHelper],
    },
    {
      code: `<span className={\`Foo\${'--bar'}\`}/>`,
      errors: [useHelper],
    },
    {
      code: `classNames(\`Foo \${className}\`)`,
      errors: [useHelper],
    },
    {
      code: `const iconClassName = \`Foo \${className}\`;`,
      errors: [useHelper],
    },
    {
      code: `<CustomComponent iconClassName={'Foo ' + className}/>`,
      errors: [useHelper],
    },
    {
      code: `element.className += ' foo';`,
      errors: [useHelper],
    },

    // Template literals
    {
      code: `<div className={\`button button-\${modifier}\`}/>`,
      errors: [dynamic],
    },
    {
      code: `<div className={\`\${modifier}-button\`}/>`,
      errors: [dynamic],
    },
    {
      code: `<div className={\`\${a}\${b}\`}/>`,
      errors: [dynamic],
    },
    {
      code: `classNames('module-expire-timer', \`module-expire-timer--\${bucket}\`)`,
      errors: [{ ...dynamic, line: 1, column: 35 }],
    },
    {
      code: `
        classNames(
          'PlaybackButton',
          \`PlaybackButton--variant-\${variant}\`,
          context && \`PlaybackButton--context-\${context}\`,
          mod ? \`PlaybackButton--\${mod}\` : undefined
        )
      `,
      errors: [dynamic, dynamic, dynamic],
    },
    {
      // MessageTimestamp: `module` is a prop
      code: `
        function MessageTimestamp({ module, direction, withSticker }) {
          const moduleName = module || 'module-timestamp';
          return (
            <span
              className={classNames(
                moduleName,
                direction ? \`\${moduleName}--\${direction}\` : null,
                withSticker ? \`\${moduleName}--with-sticker\` : null
              )}
            />
          );
        }
      `,
      errors: [
        { ...unverifiable, line: 3 },
        { ...dynamic, line: 8 },
        { ...dynamic, line: 9 },
      ],
    },
    {
      code: `
        classNames(
          'MediaEditor__toolbar__crop__button',
          \`MediaEditor__toolbar__button--crop-\${
            isFlipped ? 'flipped' : 'normal'
          }\`
        )
      `,
      errors: [dynamic],
    },
    {
      code: `classNames(\`BetterAvatarBubble--\${avatarColor}--icon\`)`,
      errors: [dynamic],
    },
    {
      code: `classNames({ [\`Foo--\${variant}\`]: cond })`,
      errors: [dynamic],
    },
    {
      // Nested classNames is reported once
      code: `<div className={classNames(\`Foo--\${variant}\`)}/>`,
      errors: [dynamic],
    },

    // String concatenation
    {
      code: `<div className={'button-' + modifier}/>`,
      errors: [dynamic],
    },
    {
      code: `<div className={'button ' + 'button-' + modifier}/>`,
      errors: [dynamic],
    },
    {
      code: `<div className={className + iconClassName}/>`,
      errors: [dynamic],
    },

    // Other class name positions
    {
      code: `<CustomComponent iconClassName={\`Foo--\${variant}\`}/>`,
      errors: [dynamic],
    },
    {
      code: `const items = [{ iconClassName: \`Foo--\${variant}\` }];`,
      errors: [dynamic],
    },
    {
      code: `const props = { className: \`Foo--\${variant}\` }; <div {...props}/>`,
      errors: [dynamic],
    },
    {
      code: `
        const rootProps = {
          className: classNames(
            'ListTile',
            isClickable && 'ListTile--clickable',
            \`ListTile--variant-\${variant}\`,
            className
          ),
        };
      `,
      errors: [dynamic],
    },
    {
      code: `const iconClassName = \`Foo--\${variant}\`;`,
      errors: [dynamic],
    },
    {
      code: `
        let muteClassName;
        muteClassName = \`Foo--\${variant}\`;
      `,
      errors: [dynamic],
    },
    {
      code: `function Foo({ className = \`Foo--\${variant}\` }) {}`,
      errors: [dynamic],
    },
    {
      code: `const { iconClassName: icon = \`Foo--\${variant}\` } = props;`,
      errors: [dynamic],
    },
    {
      code: `class Foo { iconClassName = \`Foo--\${variant}\`; }`,
      errors: [dynamic],
    },

    // Functions
    {
      code: `function themeClassName(theme) { return \`\${theme}-theme\`; }`,
      errors: [dynamic],
    },
    {
      code: `const getClassName = () => \`Foo--\${variant}\`;`,
      errors: [dynamic],
    },
    {
      code: `class Foo { getClassName() { return \`Foo--\${variant}\`; } }`,
      errors: [dynamic],
    },
    {
      code: `const obj = { getClassName() { return \`Foo--\${variant}\`; } };`,
      errors: [dynamic],
    },
    {
      code: `
        const iconClassName = useMemo(() => {
          return \`Foo--\${variant}\`;
        }, [variant]);
      `,
      errors: [dynamic],
    },
    {
      code: `
        <div className={getVariant(variant)}/>;
        function getVariant(variant) {
          if (variant === 'a') {
            return 'Foo--a';
          }
          return \`Foo--\${variant}\`;
        }
      `,
      errors: [{ ...dynamic, line: 7 }],
    },

    // Constants and lookup tables are resolved
    {
      code: `
        const base = \`Foo--\${variant}\`;
        <>
          <div className={base}/>
          <div className={base}/>
        </>
      `,
      errors: [{ ...dynamic, line: 2 }],
    },
    {
      code: `
        const CLASSNAMES = { a: \`variant-\${a}\`, b: 'variant-b' };
        <div className={CLASSNAMES[variant]}/>
      `,
      errors: [{ ...dynamic, line: 2 }],
    },
    {
      code: `
        const CLASS_NAMES = new Map([
          [Variant.A, 'Foo--a'],
          [Variant.B, \`Foo--\${b}\`],
        ]);
        <div className={CLASS_NAMES.get(variant)}/>
      `,
      errors: [{ ...dynamic, line: 4 }],
    },

    // Values that can't be verified
    {
      code: `
        function Component({ variant }) {
          return <div className={variant}/>;
        }
      `,
      errors: [unverifiable],
    },
    {
      code: `
        let cls = 'a';
        <div className={cls}/>
      `,
      errors: [unverifiable],
    },
    {
      code: `
        import { FOO } from './foo';
        <div className={FOO}/>
      `,
      errors: [unverifiable],
    },
    {
      code: `<div className={getFoo()}/>`,
      errors: [unverifiable],
    },
    {
      code: `<div className={styles[variant]}/>`,
      errors: [unverifiable],
    },
    {
      code: `<div className={props.variant}/>`,
      errors: [unverifiable],
    },
    {
      code: `<div className={[a, b].join(' ')}/>`,
      errors: [unverifiable],
    },
    {
      code: `classNames('Foo', variant)`,
      errors: [unverifiable],
    },
    {
      code: `<CustomComponent iconClassName={icon}/>`,
      errors: [unverifiable],
    },
    {
      code: `
        const LOOKUP = new Map(entries);
        <div className={LOOKUP.get(variant)}/>
      `,
      errors: [unverifiable],
    },
    {
      // axo concatClassNames()
      code: `
        function concatClassNames(classNames) {
          for (let index = 0; index < classNames.length; index += 1) {
            const className = classNames[index];
          }
        }
      `,
      errors: [unverifiable],
    },

    // DOM APIs
    {
      code: `
        document.body.classList.add(
          \`\${
            theme === 'system'
              ? window.SignalContext.nativeThemeListener.getSystemTheme()
              : theme
          }-theme\`
        );
      `,
      errors: [dynamic],
    },
    {
      code: `element.classList.toggle(\`Foo--\${variant}\`, true);`,
      errors: [dynamic],
    },
    {
      code: `element.className = 'Foo-' + variant;`,
      errors: [dynamic],
    },
    {
      code: `element.className += variant;`,
      errors: [dynamic],
    },
    {
      code: `element.setAttribute('class', \`Foo--\${variant}\`);`,
      errors: [dynamic],
    },

    // no template literals even if they are static
    { code: `<div className={\`static\`}/>`, errors: [noTemplate] },
    {
      code: `classNames(\`UsernameLinkEditor__actions\`)`,
      errors: [singleClassName, noTemplate],
    },
    {
      code: `css(\`UsernameLinkEditor__actions\`)`,
      errors: [noTemplate],
    },
    {
      code: `classNames({ [\`b\`]: cond })`,
      errors: [noTemplate],
    },

    // classNames() with a single class name should be a string literal
    {
      code: `classNames('example')`,
      errors: [singleClassName],
    },
    {
      code: `classNames("example")`,
      errors: [singleClassName],
    },
    {
      code: `<div className={classNames('example')}/>`,
      errors: [singleClassName],
    },
    {
      code: `const iconClassName = classNames('example');`,
      errors: [singleClassName],
    },
    {
      code: `<div className={css(classNames('example'), tw('p-4'))}/>`,
      errors: [singleClassName],
    },
  ],
});
