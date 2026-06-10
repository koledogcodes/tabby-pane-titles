import { Component } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { PaneTitlesService, SettingsRow } from '../services/paneTitles.service'
import { McpServerService } from '../services/mcpServer.service'

@Component({
    template: `
    <h3 class="mb-3">Pane Titles</h3>

    <div class="form-line">
        <div class="header">
            <div class="title">Enable title boxes</div>
            <div class="description">Show a title box at the top of each terminal pane</div>
        </div>
        <toggle [(ngModel)]="conf.enabled" (ngModelChange)="save()"></toggle>
    </div>

    <div class="form-line">
        <div class="header">
            <div class="title">Panes without a configured title</div>
            <div class="description">What the title box shows when no custom title is set for the pane index</div>
        </div>
        <select class="form-control w-auto" [(ngModel)]="conf.fallback" (ngModelChange)="save()">
            <option value="pane-number">Show "Pane N"</option>
            <option value="tab-title">Show Tabby's tab title</option>
            <option value="hide">Hide the box</option>
        </select>
    </div>

    <div class="form-line">
        <div class="header">
            <div class="title">Show pane index</div>
            <div class="description">Prefix titles with the pane index, e.g. "2 · build server". When off, the index appears nowhere (panes on the "Pane N" fallback hide their box).</div>
        </div>
        <toggle [(ngModel)]="conf.showIndex" (ngModelChange)="save()"></toggle>
    </div>

    <div class="form-line">
        <div class="header">
            <div class="title">Box width</div>
            <div class="description">Auto fits the box to the title text; Full spans the whole pane</div>
        </div>
        <select class="form-control w-auto" [(ngModel)]="conf.boxWidth" (ngModelChange)="save()">
            <option value="auto">Auto</option>
            <option value="full">Full width</option>
        </select>
    </div>

    <div class="form-line">
        <div class="header">
            <div class="title">Text alignment</div>
            <div class="description">With auto width this positions the box; with full width it aligns the text</div>
        </div>
        <select class="form-control w-auto" [(ngModel)]="conf.textAlign" (ngModelChange)="save()">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
        </select>
    </div>

    <div class="form-line">
        <div class="header">
            <div class="title">Font size</div>
        </div>
        <input type="number" class="form-control w-auto" min="8" max="32"
            [(ngModel)]="conf.fontSize" (ngModelChange)="save()">
    </div>

    <div class="form-line">
        <div class="header">
            <div class="title">Bold text</div>
        </div>
        <toggle [(ngModel)]="conf.bold" (ngModelChange)="save()"></toggle>
    </div>

    <div class="form-line">
        <div class="header">
            <div class="title">Text color</div>
            <div class="description">Any CSS color, e.g. #d0d0d0 or rgba(255,255,255,0.7)</div>
        </div>
        <input type="text" class="form-control w-auto" [(ngModel)]="conf.textColor" (ngModelChange)="save()">
    </div>

    <div class="form-line">
        <div class="header">
            <div class="title">Background</div>
            <div class="description">Any CSS color or gradient</div>
        </div>
        <input type="text" class="form-control w-auto" [(ngModel)]="conf.background" (ngModelChange)="save()">
    </div>

    <h3 class="mt-4 mb-3">Titles by pane index</h3>
    <p class="text-muted">Panes are numbered 1, 2, 3… across tabs (left to right) and split panes (layout order). Titles stick to the index, not the pane.</p>

    <table class="table">
        <thead>
            <tr>
                <th style="width: 60px">Index</th>
                <th>Current pane</th>
                <th>Custom title</th>
                <th style="width: 40px"></th>
            </tr>
        </thead>
        <tbody>
            <tr *ngFor="let row of rows">
                <td>{{row.index}}</td>
                <td class="text-muted">{{row.live ? (row.tabbyTitle || 'Terminal') : '(no pane open)'}}</td>
                <td>
                    <input type="text" class="form-control" placeholder="No custom title"
                        [value]="getTitle(row.index)"
                        (change)="setTitle(row.index, $any($event.target).value)">
                </td>
                <td>
                    <button class="btn btn-link text-danger p-0" title="Clear title"
                        *ngIf="getTitle(row.index)"
                        (click)="setTitle(row.index, '')">✕</button>
                </td>
            </tr>
        </tbody>
    </table>

    <div class="d-flex align-items-center mb-4">
        <input type="number" class="form-control w-auto me-2 mr-2" min="1" placeholder="Index" [(ngModel)]="newIndex">
        <input type="text" class="form-control w-auto me-2 mr-2" placeholder="Title" [(ngModel)]="newTitle"
            (keyup.enter)="addMapping()">
        <button class="btn btn-secondary" (click)="addMapping()" [disabled]="!newIndex || !newTitle">Add mapping</button>
    </div>

    <h3 class="mt-4 mb-3">MCP server</h3>

    <div class="form-line">
        <div class="header">
            <div class="title">Enable MCP server</div>
            <div class="description">Exposes set_pane_title, get_pane_index and list_pane_titles over Streamable HTTP</div>
        </div>
        <toggle [(ngModel)]="conf.mcp.enabled" (ngModelChange)="save()"></toggle>
    </div>

    <div class="form-line">
        <div class="header">
            <div class="title">Port</div>
            <div class="description">Listens on {{conf.mcp.host}} only</div>
        </div>
        <input type="number" class="form-control w-auto" min="1024" max="65535"
            [(ngModel)]="conf.mcp.port" (ngModelChange)="save()">
    </div>

    <div class="form-line">
        <div class="header">
            <div class="title">Status</div>
            <div class="description" *ngIf="mcp.status === 'running'">Running at {{mcp.url}}</div>
            <div class="description text-danger" *ngIf="mcp.status === 'error'">{{mcp.lastError}}</div>
            <div class="description" *ngIf="mcp.status === 'stopped'">Stopped</div>
        </div>
        <button class="btn btn-secondary" (click)="mcp.restart()">Restart</button>
    </div>

    <div class="form-line">
        <div class="header">
            <div class="title">Bind panes to Tabby-MCP sessions</div>
            <div class="description">Attach each pane's stable Tabby-MCP session id (via its get_session_list) to list_pane_titles / get_pane_index, and expose a get_pane_session tool that resolves title or index to the session id for exec_command &amp; co.</div>
        </div>
        <toggle [(ngModel)]="conf.tabbyMcp.bind" (ngModelChange)="save()"></toggle>
    </div>

    <div class="form-line" *ngIf="conf.tabbyMcp.bind">
        <div class="header">
            <div class="title">Tabby-MCP URL</div>
            <div class="description">Base URL of the Tabby-MCP server (its /api/tool endpoint is used)</div>
        </div>
        <input type="text" class="form-control w-auto" [(ngModel)]="conf.tabbyMcp.url" (ngModelChange)="save()">
    </div>

    <div class="form-line align-items-start">
        <div class="header">
            <div class="title">kiro-cli / Claude Code setup</div>
            <div class="description">
                Add to <code>~/.kiro/settings/mcp.json</code>, or run
                <code>claude mcp add --transport http tabby-pane-titles {{mcp.url}}</code>
            </div>
        </div>
        <div>
            <pre class="m-0 p-2" style="font-size: 11px; user-select: all">{{kiroSnippet}}</pre>
            <button class="btn btn-sm btn-secondary mt-1" (click)="copySnippet()">{{copied ? 'Copied!' : 'Copy'}}</button>
        </div>
    </div>
    `,
})
export class PaneTitlesSettingsComponent {
    newIndex: number | null = null
    newTitle = ''
    copied = false

    constructor (
        public config: ConfigService,
        public paneTitles: PaneTitlesService,
        public mcp: McpServerService,
    ) { }

    get conf (): any {
        return this.config.store.paneTitles
    }

    get rows (): SettingsRow[] {
        return this.paneTitles.getRows()
    }

    get kiroSnippet (): string {
        return JSON.stringify({
            mcpServers: {
                'tabby-pane-titles': {
                    type: 'http',
                    url: this.mcp.url,
                },
            },
        }, null, 2)
    }

    save (): void {
        this.config.save()
        this.paneTitles.scheduleRefresh()
    }

    getTitle (index: number): string {
        return this.paneTitles.getCustomTitle(index) ?? ''
    }

    setTitle (index: number, title: string): void {
        this.paneTitles.setTitle(index, title)
    }

    addMapping (): void {
        if (!this.newIndex || !this.newTitle.trim()) {
            return
        }
        this.paneTitles.setTitle(Math.floor(this.newIndex), this.newTitle)
        this.newIndex = null
        this.newTitle = ''
    }

    copySnippet (): void {
        navigator.clipboard.writeText(this.kiroSnippet).then(() => {
            this.copied = true
            setTimeout(() => { this.copied = false }, 1500)
        })
    }
}
