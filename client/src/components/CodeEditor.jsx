import React, { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine,
         highlightActiveLineGutter, drawSelection, dropCursor,
         rectangularSelection, crosshairCursor } from '@codemirror/view';
import { EditorState, EditorSelection } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { indentOnInput, bracketMatching, foldGutter, foldKeymap,
         syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { oneDark } from '@codemirror/theme-one-dark';

function getLang(language) {
  const l = (language || '').toLowerCase();
  if (l === 'python')     return python();
  if (l === 'java')       return java();
  if (l === 'html')       return html();
  if (l === 'css')        return css();
  if (l === 'cpp' || l === 'c++' || l === 'c') return cpp();
  if (l === 'rust')       return rust();
  if (l === 'typescript' || l === 'ts') return javascript({ typescript: true });
  if (l === 'jsx')        return javascript({ jsx: true });
  if (l === 'tsx')        return javascript({ jsx: true, typescript: true });
  return javascript(); // default: JS
}

/**
 * CodeMirror 6 editor component.
 *
 * Props:
 *   content    — controlled text content
 *   language   — syntax language string
 *   onChange   — called with new text when user edits
 *   readOnly   — boolean, disables editing
 */
export default function CodeEditor({ content, language, onChange, readOnly }) {
  const containerRef = useRef(null);
  const viewRef      = useRef(null);

  // Build (or rebuild) the editor when language changes
  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: content || '',
        extensions: [
          // Line numbers and gutter
          lineNumbers(),
          highlightActiveLineGutter(),
          foldGutter(),

          // UI
          drawSelection(),
          dropCursor(),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          highlightSelectionMatches(),

          // Edit behaviour
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),

          // Auto-complete
          autocompletion(),

          // Search (Ctrl+F)
          search({ top: true }),

          // Language support + syntax
          getLang(language),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

          // Theme
          oneDark,

          // Keymaps (order matters — more specific first)
          keymap.of([
            ...closeBracketsKeymap,
            ...completionKeymap,
            ...searchKeymap,
            ...foldKeymap,
            ...historyKeymap,
            indentWithTab,
            ...defaultKeymap,
          ]),

          // Read-only flag
          EditorView.editable.of(!readOnly),
          EditorState.readOnly.of(!!readOnly),

          // Custom theme overrides
          EditorView.theme({
            '&': {
              height: '100%',
              fontSize: '13.5px',
              fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
            },
            '.cm-scroller': {
              overflow: 'auto',
              fontFamily: 'inherit',
              lineHeight: '1.65',
            },
            '.cm-content': { padding: '8px 0', minHeight: '100%' },
            '.cm-gutters': {
              background: '#0d1117',
              borderRight: '1px solid #21262d',
              color: '#484f58',
              minWidth: '48px',
            },
            '.cm-activeLineGutter': { background: '#161b22' },
            '.cm-activeLine': { background: '#161b22' },
            '.cm-cursor': { borderLeftColor: '#58a6ff' },
            '.cm-selectionBackground': { background: '#264f78 !important' },
            '.cm-focused .cm-selectionBackground': { background: '#264f78 !important' },
            '.cm-matchingBracket': { outline: '1px solid #58a6ff', borderRadius: '2px' },
            '.cm-tooltip': { background: '#1c2128', border: '1px solid #30363d', borderRadius: '6px' },
            '.cm-tooltip-autocomplete ul': { fontFamily: 'inherit', fontSize: '13px' },
            '.cm-completionIcon': { paddingRight: '6px' },
            // Search panel
            '.cm-search': { padding: '8px 12px', background: '#161b22', borderTop: '1px solid #30363d' },
            '.cm-textfield': {
              background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d',
              borderRadius: '4px', padding: '4px 8px', fontSize: '13px',
            },
            '.cm-button': {
              background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
              borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
            },
          }),

          // Notify parent of changes
          EditorView.updateListener.of((update) => {
            if (update.docChanged && onChange) {
              onChange(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Sync content from outside (remote edits) without recreating the view
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content || '' },
        // Preserve selection if possible to avoid jarring jumps
        selection: view.state.selection,
      });
    }
  }, [content]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
