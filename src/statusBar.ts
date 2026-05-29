import * as vscode from 'vscode';
import { LLMClient } from './llmClient';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;

    constructor(private llmClient: LLMClient) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'localLLM.openSettings';
        this.update();
    }

    async update() {
        const config = this.llmClient.getConfig();
        const result = await this.llmClient.testConnection();

        if (result.success) {
            this.statusBarItem.text = `$(check) ${config.modelName}`;
            this.statusBarItem.tooltip = `${config.backend} • ${config.baseUrl}\n${result.message}`;
        } else {
            this.statusBarItem.text = `$(error) ${config.modelName}`;
            this.statusBarItem.tooltip = `${config.backend} • ${config.baseUrl}\n${result.message}`;
        }
        this.statusBarItem.show();
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}