# tabby-pane-titles

A [Tabby](https://tabby.sh) plugin that shows a small **title box at the top of every terminal pane**, with titles assigned by **pane index**, plus an embedded **MCP server** so AI agents (kiro-cli, Claude Code, Cursor, …) can read and set the titles.

## Features

- Title box overlaid on the top of each terminal pane (including every pane of a split tab) — floats over the first line, never pushes content down
- Titles are assigned by pane index: `1, 2, 3…` counted across tabs left-to-right, and across split panes in layout order
- Fully configurable in **Settings → Pane Titles**
- Embedded MCP server (Streamable HTTP, stateless) on `http://127.0.0.1:5505/mcp` by default
- Designed to run alongside [Tabby-MCP](https://github.com/GentlemanHu/Tabby-MCP) (different default port: 5505 vs 3001)
- Optional **Tabby-MCP binding**: panes are joined to Tabby-MCP's stable session ids, so agents can resolve *pane title → session id* and drive that pane with Tabby-MCP's `exec_command`, `send_input`, `get_terminal_buffer`, …

## How pane indexing works

Every open terminal pane gets a 1-based index in display order:

```
Tab 1            Tab 2 (split)         Tab 3
┌────────┐       ┌───────┬───────┐     ┌────────┐
│ Pane 1 │       │ Pane 2│ Pane 3│     │ Pane 4 │
└────────┘       └───────┴───────┘     └────────┘
```

Titles stick to the **index**, not the pane. If you close pane 2, the old pane 3 becomes pane 2 and picks up index 2's title. This mirrors tab-index addressing in Tabby-MCP. The index is always visible in the title box (default `Pane N` fallback), so you can see exactly which index to target.

## Install

### Build from source

```bash
npm install --legacy-peer-deps
npm run build
```

> `--legacy-peer-deps` is needed because Tabby's Angular 15 toolchain peer-requires TypeScript <5 while the MCP SDK's typings need TypeScript 5. The conflict only affects Angular's `ngc` compiler, which this build doesn't use.

### Copy to Tabby's plugin directory

After building, copy `package.json` and the `dist/` folder into Tabby's plugins directory:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\tabby\plugins\node_modules\tabby-pane-titles` |
| macOS | `~/Library/Application Support/tabby/plugins/node_modules/tabby-pane-titles` |
| Linux | `~/.config/tabby/plugins/node_modules/tabby-pane-titles` |

Or run the install script which does this for you:

- **Windows**: [`scripts/install.ps1`](scripts/install.ps1)
- **macOS / Linux**: [`scripts/install.sh`](scripts/install.sh)

Then restart Tabby. The plugin appears in **Settings → Plugins** and adds a **Pane Titles** settings tab.

## Using the plugin

### Setting titles from the UI

Open **Settings → Pane Titles**. The *Titles by pane index* table lists every open pane (and any configured index without an open pane). Type a title next to an index and press Enter or click away — the pane's title box updates immediately. Use *Add mapping* to pre-assign a title to an index that isn't open yet.

### Settings reference

| Setting | Options | Default |
|---|---|---|
| Enable title boxes | on / off | on |
| Panes without a configured title | show `Pane N` / show Tabby's tab title / hide the box | `Pane N` |
| Show pane index | prefix titles with the index, e.g. `2 · build server`; when off the index appears nowhere (the `Pane N` fallback hides the box) | on |
| Box width | auto (fits the text) / full pane width | auto |
| Text alignment | left / center / right | center |
| Font size | 8–32 px | 12 |
| Bold text | on / off | off |
| Text color | any CSS color | `#d0d0d0` |
| Background | any CSS color or gradient | `rgba(255,255,255,0.08)` |
| MCP server | enable / port (host is fixed to `127.0.0.1`) | enabled, port 5505 |
| Bind panes to Tabby-MCP sessions | on / off + Tabby-MCP base URL | on, `http://127.0.0.1:3001` |

The title box always renders as an overlay floating over the first terminal line (the old `bar` mode was removed in 1.1.0).

All settings live under the `paneTitles` key in Tabby's `config.yaml`, including the title map:

```yaml
paneTitles:
  titles:
    "1": build server
    "3": logs
  mcp:
    enabled: true
    port: 5505
  tabbyMcp:
    bind: true
    url: http://127.0.0.1:3001
```

## Connecting to the MCP server

The server starts with Tabby (when enabled) and listens on `http://127.0.0.1:5505/mcp` using stateless Streamable HTTP — multiple clients can connect concurrently.

### kiro-cli

Add to `~/.kiro/settings/mcp.json` (global) or `<project>/.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "tabby-pane-titles": {
      "type": "http",
      "url": "http://127.0.0.1:5505/mcp"
    }
  }
}
```

Verify with `/mcp` inside a kiro-cli session.

### Claude Code

```bash
claude mcp add --transport http tabby-pane-titles http://127.0.0.1:5505/mcp
```

### Any other MCP client

Point a Streamable-HTTP-capable client at `http://127.0.0.1:5505/mcp`. To check the server is up without an MCP client:

```powershell
curl http://127.0.0.1:5505/health
# {"status":"ok","plugin":"tabby-pane-titles","version":"1.0.0","panes":3}
```

## MCP tools

### `set_pane_title`

Set the custom title for a pane index. Passing an empty `title` clears it. Works even if no pane with that index is currently open (the title applies when one exists).

| Input | Type | Description |
|---|---|---|
| `index` | integer ≥ 1 | 1-based pane index |
| `title` | string | New title; empty string clears |

Returns e.g. `Pane 3 title set to "logs".`

### `get_pane_index`

Find pane indexes by title. Case-insensitive; exact matches on the custom/displayed/Tabby title win, otherwise substring matches are returned.

| Input | Type | Description |
|---|---|---|
| `title` | string | Title (or part of it) to search for |

Returns a JSON array of matching panes (same shape as `list_pane_titles`).

### `list_pane_titles`

No input. Returns all open panes:

```json
[
  {
    "index": 1,
    "title": "1 · build server",
    "customTitle": "build server",
    "tabbyTitle": "pwsh",
    "focused": true,
    "tabbyMcpSessionId": "3f2a9c41-8b7d-4e2a-9c1f-0d5e6a7b8c9d"
  },
  {
    "index": 2,
    "title": "Pane 2",
    "customTitle": null,
    "tabbyTitle": "ssh prod-box",
    "focused": false,
    "tabbyMcpSessionId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
  }
]
```

`title` is what the title box displays; `customTitle` is the configured mapping (or `null`); `tabbyTitle` is Tabby's own tab title (shell/process). `tabbyMcpSessionId` only appears when Tabby-MCP binding is enabled (see below).

### `get_pane_session` *(only registered when Tabby-MCP binding is on)*

Resolve a pane to its Tabby-MCP stable session id, so an agent can chain into Tabby-MCP's `exec_command`, `send_input`, `get_terminal_buffer`, etc.

| Input | Type | Description |
|---|---|---|
| `pane` | integer ≥ 1, optional | 1-based pane index |
| `title` | string, optional | Title (or part of it) to search for |

At least one of `pane` / `title` is required; both together filter. Returns the matching panes in the `list_pane_titles` shape, including `tabbyMcpSessionId`.

## Tabby-MCP binding

When **Bind panes to Tabby-MCP sessions** is enabled (Settings → Pane Titles → MCP server), the plugin calls Tabby-MCP's REST endpoint `POST {url}/api/tool/get_session_list` (default `http://127.0.0.1:3001`) and joins its sessions to panes. Tabby-MCP enumerates terminals in exactly the same order this plugin numbers panes — tabs left-to-right, split children in layout order — so its 0-based `tabIndex` maps 1:1 to pane index − 1.

Typical agent flow:

1. `get_pane_session` with `title: "build server"` → `tabbyMcpSessionId`
2. Tabby-MCP `exec_command` with that `sessionId`

If Tabby-MCP is not running (or the URL is wrong), tools still work: `tabbyMcpSessionId` comes back `null` and the response starts with a warning line. The lookup times out after 1.5 s.

## Troubleshooting

- **No title boxes** — check *Enable title boxes* in Settings → Pane Titles; if the fallback is *Hide the box*, only panes with configured titles show one.
- **MCP client can't connect** — make sure Tabby is running (the server lives inside it), check the *Status* line in settings, and confirm nothing else owns the port (`curl http://127.0.0.1:5505/health`). The status line shows "Port X is already in use" if there's a clash — change the port and click *Restart*.
- **Changed the port** — update your MCP client config to match, and restart the client session.
- **Plugin not listed after install** — confirm `%APPDATA%\tabby\plugins\node_modules\tabby-pane-titles\dist\index.js` exists and restart Tabby fully (tray icon → quit, not just closing the window).

## Development

```powershell
npm run watch    # rebuild on change
```

Source layout:

- `src/index.ts` — Angular module wiring (providers: config, settings tab, terminal decorator)
- `src/decorator.ts` — injects the banner element into each terminal pane
- `src/services/paneTitles.service.ts` — pane enumeration/indexing, title resolution, banner rendering
- `src/services/mcpServer.service.ts` — express + `@modelcontextprotocol/sdk` Streamable HTTP server and tool definitions
- `src/components/paneTitlesSettings.component.ts` — the settings UI
- `src/config.ts` — config defaults

## License

MIT
