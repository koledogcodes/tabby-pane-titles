import { ConfigProvider } from 'tabby-core'

export class PaneTitlesConfigProvider extends ConfigProvider {
    defaults = {
        paneTitles: {
            enabled: true,
            // What to show on panes with no configured title: 'pane-number' | 'tab-title' | 'hide'
            fallback: 'pane-number',
            // Prefix titles with the pane index; when off the index appears nowhere
            // (the 'pane-number' fallback hides the box, since the index is its only content)
            showIndex: true,
            // 'auto' sizes the box to its text, 'full' spans the pane width
            boxWidth: 'auto',
            textAlign: 'center',
            fontSize: 12,
            bold: false,
            textColor: '#d0d0d0',
            background: 'rgba(255, 255, 255, 0.08)',
            // Map of pane index (as string) -> custom title.
            // __nonStructural makes Tabby's ConfigProxy store this dict in the
            // real config; without it, an empty-object default is treated as a
            // leaf and reads return a fresh clone, so writes never persist.
            titles: { __nonStructural: true },
            mcp: {
                enabled: true,
                host: '127.0.0.1',
                port: 5505,
            },
            // Bind panes to Tabby-MCP (GentlemanHu/Tabby-MCP) stable session ids:
            // list_pane_titles/get_pane_index gain tabbyMcpSessionId, and a
            // get_pane_session tool resolves title/index -> session id.
            tabbyMcp: {
                bind: true,
                url: 'http://127.0.0.1:3001',
            },
        },
    }
}
