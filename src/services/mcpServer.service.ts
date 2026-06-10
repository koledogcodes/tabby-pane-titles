import { Injectable, NgZone } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { firstValueFrom } from 'rxjs'
import * as http from 'http'
import express from 'express'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { PaneTitlesService, PaneTitleEntry } from './paneTitles.service'

const PLUGIN_VERSION = '1.1.0'

/** A pane entry with its Tabby-MCP stable session id attached (null if unknown). */
type BoundEntry = PaneTitleEntry & { tabbyMcpSessionId: string | null }

@Injectable()
export class McpServerService {
    status: 'stopped' | 'running' | 'error' = 'stopped'
    lastError: string | null = null

    private httpServer: http.Server | null = null
    private appliedKey: string | null = null

    constructor (
        private config: ConfigService,
        private paneTitles: PaneTitlesService,
        private zone: NgZone,
    ) {
        firstValueFrom(config.ready$).then(() => {
            this.applyConfig()
            config.changed$.subscribe(() => this.applyConfig())
        })
    }

    get url (): string {
        const conf = this.config.store.paneTitles.mcp
        return `http://${conf.host || '127.0.0.1'}:${conf.port || 5505}/mcp`
    }

    restart (): void {
        this.appliedKey = null
        this.applyConfig()
    }

    private applyConfig (): void {
        const conf = this.config.store.paneTitles.mcp
        const key = `${conf.enabled}|${conf.host}|${conf.port}`
        if (key === this.appliedKey) {
            return
        }
        this.appliedKey = key
        this.stop()
        if (conf.enabled) {
            this.start(conf.host || '127.0.0.1', conf.port || 5505)
        }
    }

    private stop (): void {
        if (this.httpServer) {
            try {
                this.httpServer.close()
            } catch { /* already closed */ }
            this.httpServer = null
        }
        this.status = 'stopped'
        this.lastError = null
    }

    private start (host: string, port: number): void {
        const app = express()
        app.use(express.json({ limit: '1mb' }))

        app.get('/health', (_req, res) => {
            res.json({
                status: 'ok',
                plugin: 'tabby-pane-titles',
                version: PLUGIN_VERSION,
                panes: this.paneTitles.getPanes().length,
            })
        })

        app.post('/mcp', async (req, res) => {
            // Stateless mode: fresh server + transport per request so concurrent
            // MCP clients (kiro-cli, Claude Code, ...) never share state.
            try {
                const server = this.buildServer()
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: undefined,
                    enableJsonResponse: true,
                })
                res.on('close', () => {
                    transport.close()
                    server.close()
                })
                await server.connect(transport)
                await transport.handleRequest(req, res, req.body)
            } catch (err) {
                console.error('[tabby-pane-titles] MCP request failed:', err)
                if (!res.headersSent) {
                    res.status(500).json({
                        jsonrpc: '2.0',
                        error: { code: -32603, message: 'Internal server error' },
                        id: null,
                    })
                }
            }
        })

        const methodNotAllowed = (_req: express.Request, res: express.Response) => {
            res.status(405).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Method not allowed. This server runs in stateless mode; use POST.' },
                id: null,
            })
        }
        app.get('/mcp', methodNotAllowed)
        app.delete('/mcp', methodNotAllowed)

        this.httpServer = app.listen(port, host, () => {
            this.status = 'running'
            this.lastError = null
            console.info(`[tabby-pane-titles] MCP server listening on http://${host}:${port}/mcp`)
        })
        this.httpServer.on('error', (err: any) => {
            this.status = 'error'
            this.lastError = err?.code === 'EADDRINUSE'
                ? `Port ${port} is already in use`
                : String(err?.message ?? err)
            console.error('[tabby-pane-titles] MCP server error:', err)
        })
    }

    /**
     * Fetch Tabby-MCP's session list via its REST endpoint
     * (POST /api/tool/get_session_list). Tabby-MCP enumerates terminals in the
     * same order we number panes (tabs left to right, split children in
     * getAllTabs() order), so its 0-based tabIndex is our pane index - 1.
     */
    private async getTabbyMcpSessions (): Promise<{ sessions: any[] | null, error: string | null }> {
        const conf = this.config.store.paneTitles.tabbyMcp ?? {}
        const base = String(conf.url || 'http://127.0.0.1:3001').replace(/\/+$/, '')
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 1500)
        try {
            const res = await fetch(`${base}/api/tool/get_session_list`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: '{}',
                signal: controller.signal,
            })
            if (!res.ok) {
                return { sessions: null, error: `Tabby-MCP at ${base} returned HTTP ${res.status}` }
            }
            const data: any = await res.json()
            const text = data?.content?.find((c: any) => c?.type === 'text')?.text
            const parsed = typeof text === 'string' ? JSON.parse(text) : data
            const sessions = Array.isArray(parsed) ? parsed
                : Array.isArray(parsed?.sessions) ? parsed.sessions : null
            if (!sessions) {
                return { sessions: null, error: 'Unexpected get_session_list response shape from Tabby-MCP' }
            }
            return { sessions, error: null }
        } catch (err: any) {
            return { sessions: null, error: `Could not reach Tabby-MCP at ${base}: ${err?.message ?? err}` }
        } finally {
            clearTimeout(timer)
        }
    }

    /**
     * If binding is enabled, attach each pane's Tabby-MCP session id and
     * return a warning line when the session list could not be fetched.
     */
    private async bindEntries (entries: PaneTitleEntry[]): Promise<{ entries: PaneTitleEntry[] | BoundEntry[], warning: string | null }> {
        if (!this.config.store.paneTitles.tabbyMcp?.bind) {
            return { entries, warning: null }
        }
        const { sessions, error } = await this.getTabbyMcpSessions()
        const byPane = new Map<number, any>()
        for (const s of sessions ?? []) {
            if (typeof s?.tabIndex === 'number') {
                byPane.set(s.tabIndex + 1, s)
            }
        }
        return {
            entries: entries.map(e => ({ ...e, tabbyMcpSessionId: byPane.get(e.index)?.sessionId ?? null })),
            warning: error ? `Warning: Tabby-MCP binding unavailable (${error}); tabbyMcpSessionId is null.` : null,
        }
    }

    private asText (entries: any[], warning: string | null): { content: [{ type: 'text', text: string }] } {
        const text = (warning ? warning + '\n' : '') + JSON.stringify(entries, null, 2)
        return { content: [{ type: 'text', text }] }
    }

    private buildServer (): McpServer {
        const server = new McpServer({
            name: 'tabby-pane-titles',
            version: PLUGIN_VERSION,
        })

        server.registerTool('set_pane_title', {
            title: 'Set pane title',
            description: 'Set the custom title shown in the title box at the top of the Tabby terminal pane with the given index (1-based, in tab/split order, as shown by list_pane_titles). Pass an empty title to clear the custom title.',
            inputSchema: {
                index: z.number().int().min(1).describe('1-based pane index'),
                title: z.string().describe('New title. An empty string clears the custom title.'),
            },
        }, async ({ index, title }) => {
            const message = this.zone.run(() => this.paneTitles.setTitle(index, title))
            return { content: [{ type: 'text', text: message }] }
        })

        server.registerTool('get_pane_index', {
            title: 'Get pane index by title',
            description: 'Find terminal pane indexes by title. Matches custom titles, displayed titles and Tabby tab titles; exact (case-insensitive) matches win, otherwise substring matches are returned.',
            inputSchema: {
                title: z.string().min(1).describe('Title (or part of it) to search for'),
            },
        }, async ({ title }) => {
            const matches = this.zone.run(() => this.paneTitles.findByTitle(title))
            if (!matches.length) {
                return { content: [{ type: 'text', text: `No pane found matching title "${title}".` }] }
            }
            const bound = await this.bindEntries(matches)
            return this.asText(bound.entries, bound.warning)
        })

        server.registerTool('list_pane_titles', {
            title: 'List pane titles',
            description: 'List all open Tabby terminal panes with their index, displayed title, configured custom title, underlying Tabby tab title, and whether the pane is focused.'
                + (this.config.store.paneTitles.tabbyMcp?.bind ? ' Each entry also carries tabbyMcpSessionId, the stable session id accepted by Tabby-MCP tools (exec_command, send_input, get_terminal_buffer, ...).' : ''),
            inputSchema: {},
        }, async () => {
            const entries = this.zone.run(() => this.paneTitles.listTitles())
            const bound = await this.bindEntries(entries)
            return this.asText(bound.entries, bound.warning)
        })

        if (this.config.store.paneTitles.tabbyMcp?.bind) {
            server.registerTool('get_pane_session', {
                title: 'Get Tabby-MCP session for a pane',
                description: 'Resolve a Tabby pane — by 1-based pane index or by title — to its pane index, displayed title and stable Tabby-MCP session id (tabbyMcpSessionId), for use with Tabby-MCP tools like exec_command, send_input and get_terminal_buffer. Provide pane or title (or both to filter).',
                inputSchema: {
                    pane: z.number().int().min(1).optional().describe('1-based pane index'),
                    title: z.string().optional().describe('Pane title (or part of it) to search for'),
                },
            }, async ({ pane, title }) => {
                if (!pane && !title) {
                    return { content: [{ type: 'text', text: 'Provide a pane index and/or a title to look up.' }] }
                }
                let matches = this.zone.run(() =>
                    title ? this.paneTitles.findByTitle(title) : this.paneTitles.listTitles())
                if (pane) {
                    matches = matches.filter(e => e.index === pane)
                }
                if (!matches.length) {
                    return { content: [{ type: 'text', text: 'No open pane matches the given index/title.' }] }
                }
                const bound = await this.bindEntries(matches)
                return this.asText(bound.entries, bound.warning)
            })
        }

        return server
    }
}
