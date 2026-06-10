import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import TabbyCoreModule, { ConfigProvider } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'
import { TerminalDecorator } from 'tabby-terminal'

import { PaneTitlesConfigProvider } from './config'
import { PaneTitlesService } from './services/paneTitles.service'
import { McpServerService } from './services/mcpServer.service'
import { PaneTitleDecorator } from './decorator'
import { PaneTitlesSettingsTabProvider } from './settings'
import { PaneTitlesSettingsComponent } from './components/paneTitlesSettings.component'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        TabbyCoreModule,
    ],
    providers: [
        PaneTitlesService,
        McpServerService,
        { provide: ConfigProvider, useClass: PaneTitlesConfigProvider, multi: true },
        { provide: SettingsTabProvider, useClass: PaneTitlesSettingsTabProvider, multi: true },
        { provide: TerminalDecorator, useClass: PaneTitleDecorator, multi: true },
    ],
    declarations: [
        PaneTitlesSettingsComponent,
    ],
})
export default class PaneTitlesModule {
    // Injecting the MCP service here forces it to start with the app,
    // not lazily when the settings tab is first opened.
    constructor (_mcp: McpServerService) { }
}

export { PaneTitlesService, McpServerService }
