import { Injectable } from '@angular/core'
import { TerminalDecorator, BaseTerminalTabComponent } from 'tabby-terminal'
import { PaneTitlesService } from './services/paneTitles.service'

@Injectable()
export class PaneTitleDecorator extends TerminalDecorator {
    constructor (private paneTitles: PaneTitlesService) {
        super()
    }

    attach (terminal: BaseTerminalTabComponent<any>): void {
        const host: HTMLElement | null =
            (terminal as any).element?.nativeElement
            ?? (terminal as any).content?.nativeElement?.parentElement
            ?? null
        if (!host) {
            console.warn('[tabby-pane-titles] Could not locate pane host element')
            return
        }
        this.paneTitles.attachBanner(terminal, host)
        this.subscribeUntilDetached(terminal, terminal.titleChange$.subscribe(() => {
            this.paneTitles.scheduleRefresh()
        }))
    }

    detach (terminal: BaseTerminalTabComponent<any>): void {
        this.paneTitles.detachBanner(terminal)
    }
}
