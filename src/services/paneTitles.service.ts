import { Injectable, NgZone } from '@angular/core'
import { AppService, ConfigService, SplitTabComponent } from 'tabby-core'
import { BaseTerminalTabComponent } from 'tabby-terminal'

export interface PaneInfo {
    index: number
    terminal: BaseTerminalTabComponent<any>
}

export interface PaneTitleEntry {
    index: number
    title: string | null
    customTitle: string | null
    tabbyTitle: string
    focused: boolean
}

export interface SettingsRow {
    index: number
    live: boolean
    tabbyTitle: string
}

interface BannerRecord {
    banner: HTMLElement
    host: HTMLElement
}

@Injectable()
export class PaneTitlesService {
    private banners = new Map<BaseTerminalTabComponent<any>, BannerRecord>()
    private hookedSplits = new WeakSet<SplitTabComponent>()
    private refreshTimer: any = null

    constructor (
        private app: AppService,
        private config: ConfigService,
        private zone: NgZone,
    ) {
        app.tabsChanged$.subscribe(() => this.scheduleRefresh())
        app.tabOpened$.subscribe(() => this.scheduleRefresh())
        ;(app as any).tabClosed$?.subscribe(() => this.scheduleRefresh())
        ;(app as any).activeTabChange$?.subscribe(() => this.scheduleRefresh())
        config.changed$.subscribe(() => this.scheduleRefresh())
    }

    attachBanner (terminal: BaseTerminalTabComponent<any>, host: HTMLElement): void {
        const existing = this.banners.get(terminal)
        if (existing) {
            existing.banner.remove()
        }
        const banner = document.createElement('div')
        banner.className = 'pane-title-box'
        banner.style.display = 'none'
        host.insertBefore(banner, host.firstChild)
        this.banners.set(terminal, { banner, host })
        this.scheduleRefresh()
    }

    detachBanner (terminal: BaseTerminalTabComponent<any>): void {
        const record = this.banners.get(terminal)
        if (record) {
            record.banner.remove()
            this.banners.delete(terminal)
        }
        this.scheduleRefresh()
    }

    scheduleRefresh (): void {
        if (this.refreshTimer) {
            return
        }
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null
            this.refresh()
        }, 50)
    }

    /**
     * All terminal panes in display order: tabs left to right, and panes
     * within a split tab in layout order. Index is 1-based.
     */
    getPanes (): PaneInfo[] {
        const terminals: BaseTerminalTabComponent<any>[] = []
        for (const tab of this.app.tabs) {
            if (tab instanceof SplitTabComponent) {
                this.hookSplit(tab)
                for (const child of tab.getAllTabs()) {
                    if (child instanceof BaseTerminalTabComponent) {
                        terminals.push(child)
                    }
                }
            } else if (tab instanceof BaseTerminalTabComponent) {
                terminals.push(tab)
            }
        }
        return terminals.map((terminal, i) => ({ index: i + 1, terminal }))
    }

    getCustomTitle (index: number): string | null {
        const titles = this.config.store.paneTitles.titles ?? {}
        const value = titles[String(index)]
        return value ? String(value) : null
    }

    getEffectiveTitle (index: number, terminal: BaseTerminalTabComponent<any>): string | null {
        const conf = this.config.store.paneTitles
        const custom = this.getCustomTitle(index)
        const prefix = conf.showIndex ? `${index} · ` : ''
        if (custom) {
            return prefix + custom
        }
        switch (conf.fallback) {
            case 'hide':
                return null
            case 'tab-title':
                return prefix + (terminal.title || (conf.showIndex ? `Pane ${index}` : 'Terminal'))
            default:
                // 'pane-number' has nothing to show without the index
                return conf.showIndex ? `Pane ${index}` : null
        }
    }

    setTitle (index: number, title: string): string {
        const conf = this.config.store.paneTitles
        // Copy + reassign so the write goes through the ConfigProxy setter
        // into the real store; mutating the getter result is not persisted.
        const titles: Record<string, string> = { ...(conf.titles ?? {}) }
        delete (titles as any).__nonStructural
        const trimmed = title.trim()
        if (trimmed) {
            titles[String(index)] = trimmed
        } else {
            delete titles[String(index)]
        }
        conf.titles = titles
        this.config.save()
        this.scheduleRefresh()
        const live = this.getPanes().some(p => p.index === index)
        if (!trimmed) {
            return `Cleared custom title for pane ${index}.`
        }
        return `Pane ${index} title set to "${trimmed}".` + (live ? '' : ' Note: no pane with this index is currently open; the title will apply when one exists.')
    }

    listTitles (): PaneTitleEntry[] {
        const focusedTerminal = this.getFocusedTerminal()
        return this.getPanes().map(({ index, terminal }) => ({
            index,
            title: this.getEffectiveTitle(index, terminal),
            customTitle: this.getCustomTitle(index),
            tabbyTitle: terminal.title || '',
            focused: terminal === focusedTerminal,
        }))
    }

    findByTitle (query: string): PaneTitleEntry[] {
        const q = query.trim().toLowerCase()
        const entries = this.listTitles()
        const matches = (value: string | null) => !!value && value.toLowerCase() === q
        const exact = entries.filter(e => matches(e.customTitle) || matches(e.title) || matches(e.tabbyTitle))
        if (exact.length) {
            return exact
        }
        const contains = (value: string | null) => !!value && value.toLowerCase().includes(q)
        return entries.filter(e => contains(e.customTitle) || contains(e.title) || contains(e.tabbyTitle))
    }

    /** Rows for the settings UI: live panes plus configured-but-closed indexes. */
    getRows (): SettingsRow[] {
        const rows: SettingsRow[] = this.getPanes().map(p => ({
            index: p.index,
            live: true,
            tabbyTitle: p.terminal.title || '',
        }))
        const titles = this.config.store.paneTitles.titles ?? {}
        for (const key of Object.keys(titles)) {
            const index = parseInt(key, 10)
            if (!isNaN(index) && !rows.some(r => r.index === index)) {
                rows.push({ index, live: false, tabbyTitle: '' })
            }
        }
        return rows.sort((a, b) => a.index - b.index)
    }

    refresh (): void {
        const conf = this.config.store.paneTitles
        const seen = new Set<BaseTerminalTabComponent<any>>()
        for (const { index, terminal } of this.getPanes()) {
            const record = this.banners.get(terminal)
            if (!record) {
                continue
            }
            seen.add(terminal)
            const title = conf.enabled ? this.getEffectiveTitle(index, terminal) : null
            this.applyBanner(record, title, conf)
        }
        // Hide banners of terminals no longer part of any tab (mid-teardown)
        for (const [terminal, record] of this.banners) {
            if (!seen.has(terminal)) {
                record.banner.style.display = 'none'
            }
        }
    }

    private applyBanner (record: BannerRecord, title: string | null, conf: any): void {
        const { banner, host } = record
        if (title === null) {
            banner.style.display = 'none'
            return
        }
        banner.textContent = title
        banner.style.display = 'block'
        banner.style.boxSizing = 'border-box'
        banner.style.flex = 'none'
        banner.style.padding = '2px 8px'
        banner.style.overflow = 'hidden'
        banner.style.whiteSpace = 'nowrap'
        banner.style.textOverflow = 'ellipsis'
        banner.style.pointerEvents = 'none'
        banner.style.fontSize = `${conf.fontSize || 12}px`
        banner.style.fontWeight = conf.bold ? 'bold' : 'normal'
        banner.style.textAlign = conf.textAlign || 'center'
        banner.style.color = conf.textColor || '#d0d0d0'
        banner.style.background = conf.background || 'rgba(255, 255, 255, 0.08)'
        const auto = (conf.boxWidth || 'auto') === 'auto'
        const align = conf.textAlign || 'center'
        banner.style.width = auto ? 'fit-content' : 'auto'
        banner.style.maxWidth = '100%'
        // Overlay: float over the first terminal line without pushing content down.
        // Inside a split, the host is already position:absolute (split-tab > .child)
        // and carries the pane's left/top/width/height — overriding it to
        // 'relative' knocks the pane out of its slot, so only add positioning
        // when the host has none.
        host.style.position = ''
        if (getComputedStyle(host).position === 'static') {
            host.style.position = 'relative'
        }
        banner.style.position = 'absolute'
        banner.style.top = '0'
        banner.style.zIndex = '10'
        banner.style.margin = ''
        if (!auto) {
            banner.style.left = '0'
            banner.style.right = '0'
            banner.style.transform = ''
        } else if (align === 'left') {
            banner.style.left = '0'
            banner.style.right = 'auto'
            banner.style.transform = ''
        } else if (align === 'right') {
            banner.style.left = 'auto'
            banner.style.right = '0'
            banner.style.transform = ''
        } else {
            banner.style.left = '50%'
            banner.style.right = 'auto'
            banner.style.transform = 'translateX(-50%)'
        }
    }

    private hookSplit (tab: SplitTabComponent): void {
        if (this.hookedSplits.has(tab)) {
            return
        }
        this.hookedSplits.add(tab)
        tab.tabAdded$.subscribe(() => this.scheduleRefresh())
        tab.tabRemoved$.subscribe(() => this.scheduleRefresh())
    }

    private getFocusedTerminal (): BaseTerminalTabComponent<any> | null {
        const active = this.app.activeTab
        if (active instanceof SplitTabComponent) {
            const focused = active.getFocusedTab()
            return focused instanceof BaseTerminalTabComponent ? focused : null
        }
        return active instanceof BaseTerminalTabComponent ? active : null
    }
}
