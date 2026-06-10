import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'
import { PaneTitlesSettingsComponent } from './components/paneTitlesSettings.component'

@Injectable()
export class PaneTitlesSettingsTabProvider extends SettingsTabProvider {
    id = 'pane-titles'
    icon = 'heading'
    title = 'Pane Titles'

    getComponentType (): any {
        return PaneTitlesSettingsComponent
    }
}
