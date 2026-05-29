import * as vscode from 'vscode';
import { LLMClient } from './llmClient';
import { getAccessControlConfig, getAccessLevelLabel } from './accessControl';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;

    constructor(private llmClient: LLMClient) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'localLLM.openSettings';
        this.update();
    }

    async update() {
        const config = this.llmClient.getConfig();
        const accessConfig = getAccessControlConfig();
        const result = await this.llmClient.testConnection();
        const levelLabel = getAccessLevelLabel(accessConfig.accessLevel);

        if (result.success) {
            this.statusBarItem.text = `$(check) ${config.modelName} | ${levelLabel}`;
            this.statusBarItem.tooltip = `${config.backend} • ${config.baseUrl}\n${result.message}\nAccess: ${accessConfig.accessLevel}`;
        } else {
            this.statusBarItem.text = `$(error) ${config.modelName} | ${levelLabel}`;
            this.statusBarItem.tooltip = `${config.backend} • ${config.baseUrl}\n${result.message}\nAccess: ${accessConfig.accessLevel}`;
        }
        this.statusBarItem.show();
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}