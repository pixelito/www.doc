import { Node, mergeAttributes } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { router } from '@inertiajs/react';

const WikiLinkPluginKey = new PluginKey('wikiLink');

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
            title,
        ];
    },

    addNodeView() {
        return ({ node, extension, editor }) => {
            const title = node.attrs.title ?? '';
            const resolvedLinks = extension.options.resolvedLinks ?? {};
            const href = resolvedLinks[title];
            const editable = editor.isEditable;

            let dom;
            if (href && !editable) {
                dom = document.createElement('a');
                dom.href = href;
                dom.className = 'wiki-link resolved';
                dom.addEventListener('click', (e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                    e.preventDefault();
                    router.visit(href);
                });
            } else {
                dom = document.createElement('span');
                dom.className = href ? 'wiki-link resolved' : 'wiki-link unresolved';
            }

            if (editable) dom.classList.add('wiki-link-edit');

            dom.setAttribute('data-wiki-link', 'true');
            dom.setAttribute('data-title', title);
            dom.textContent = title;

            // Hover preview — fire after 400 ms, cancel on quick leave
            let showTimer;

            dom.addEventListener('mouseenter', () => {
                showTimer = setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('wiki-link-preview-show', {
                        detail: { title, href: href ?? null, broken: !href, rect: dom.getBoundingClientRect() },
                    }));
                }, 400);
            });

            dom.addEventListener('mouseleave', () => {
                clearTimeout(showTimer);
                document.dispatchEvent(new CustomEvent('wiki-link-preview-hide'));
            });

            return {
                dom,
                destroy() {
                    clearTimeout(showTimer);
                    document.dispatchEvent(new CustomEvent('wiki-link-preview-hide'));
                },
            };
        };
    },

    addProseMirrorPlugins() {
        const ext = this;

        return [
            Suggestion({
                pluginKey: WikiLinkPluginKey,
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
