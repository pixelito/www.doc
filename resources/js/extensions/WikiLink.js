import { Node, mergeAttributes } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

/**
 * Inline node representing a [[Wiki Link]].
 *
 * Storage format: { type: "wikiLink", attrs: { title: "Page Title" } }
 *
 * In edit mode the node renders as a styled chip. In read-only mode
 * it resolves to an <a> using the resolvedLinks map (title → href).
 */
export const WikiLink = Node.create({
    name: 'wikiLink',
    group: 'inline',
    inline: true,
    selectable: true,
    atom: true,

    addOptions() {
        return {
            suggestions: [],       // [{ id, title, slug }]
            resolvedLinks: {},     // { title: '/documents/{id}' }
            onSuggestionStart: null,
            onSuggestionUpdate: null,
            onSuggestionExit: null,
            onSuggestionKeyDown: null,
        };
    },

    addAttributes() {
        return {
            title: { default: null },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-wiki-link]',
                getAttrs: (el) => ({ title: el.getAttribute('data-title') }),
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        const title = node.attrs.title ?? '';
        return [
            'span',
            mergeAttributes(HTMLAttributes, {
                'data-wiki-link': 'true',
                'data-title': title,
                class: 'wiki-link',
            }),
            `[[${title}]]`,
        ];
    },

    addNodeView() {
        return ({ node, extension }) => {
            const title = node.attrs.title ?? '';
            const resolvedLinks = extension.options.resolvedLinks ?? {};
            const href = resolvedLinks[title];
            const editable = extension.editor.isEditable;

            let dom;
            if (href && !editable) {
                dom = document.createElement('a');
                dom.href = href;
                dom.className = 'wiki-link resolved';
            } else {
                dom = document.createElement('span');
                dom.className = href ? 'wiki-link resolved' : 'wiki-link unresolved';
            }

            dom.setAttribute('data-wiki-link', 'true');
            dom.setAttribute('data-title', title);
            dom.textContent = `[[${title}]]`;

            return { dom };
        };
    },

    addProseMirrorPlugins() {
        const ext = this;

        return [
            Suggestion({
                editor: this.editor,
                char: '[[',
                allowSpaces: true,
                startOfLine: false,

                command: ({ editor, range, props }) => {
                    editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .insertContent({ type: ext.name, attrs: { title: props.title } })
                        .insertContent(' ')
                        .run();
                },

                items: ({ query }) => {
                    const q = query.toLowerCase();
                    return (ext.options.suggestions ?? [])
                        .filter((d) => d.title.toLowerCase().includes(q))
                        .slice(0, 8);
                },

                render: () => ({
                    onStart:   (props) => ext.options.onSuggestionStart?.(props),
                    onUpdate:  (props) => ext.options.onSuggestionUpdate?.(props),
                    onKeyDown: ({ event }) => ext.options.onSuggestionKeyDown?.(event) ?? false,
                    onExit:    ()       => ext.options.onSuggestionExit?.(),
                }),
            }),
        ];
    },
});
