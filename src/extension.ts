import * as vscode from 'vscode';
import { LLMClient } from './llmClient';
import { ChatViewProvider } from './chatviewprovider';
import { StatusBarManager } from './statusBar';
import { registerCodeActions } from './codeActions';
import { SettingsProvider } from './settingsProvider';
import { getAccessControlConfig, AccessLevel, getAccessLevelLabel, clearApprovedPatterns } from './accessControl';

export function activate(context: vscode.ExtensionContext) {
    const llmClient = new LLMClient();
    const chatProvider = new ChatViewProvider(context.extensionUri, llmClient);
    const statusBar = new StatusBarManager(llmClient);
    const settingsProvider = new SettingsProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('localLLM.chat', chatProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('localLLM.openChat', () => {
            vscode.commands.executeCommand('localLLM.chat.focus');
        }),
        vscode.commands.registerCommand('localLLM.testConnection', async () => {
            const result = await llmClient.testConnection();
            if (result.success) {
                vscode.window.showInformationMessage(`Local LLM: ${result.message}`);
            } else {
                vscode.window.showErrorMessage(`Local LLM: ${result.message}`);
            }
            statusBar.update();
        }),
        vscode.commands.registerCommand('localLLM.clearChat', () => {
            chatProvider.clearChat();
            clearApprovedPatterns();
        }),
        vscode.commands.registerCommand('localLLM.openSettings', () => {
            settingsProvider.show();
        }),
        vscode.commands.registerCommand('localLLM.changeAccessLevel', async () => {
            const levels: AccessLevel[] = ['strict', 'sandboxed', 'full'];
            const items = levels.map(level => ({
                label: getAccessLevelLabel(level),
                description: level,
                level
            }));
            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select access level for the Local LLM Agent'
            });
            if (picked) {
                if (picked.level === 'full') {
                    const confirmed = await vscode.window.showWarningMessage(
                        'Full Access gives the agent unrestricted access to your machine and external resources. All actions are logged. Continue?',
                        { modal: true },
                        'Continue',
                        'Cancel'
                    );
                    if (confirmed !== 'Continue') return;
                }
                await vscode.workspace.getConfiguration('localLLM').update('accessLevel', picked.level, true);
                vscode.window.showInformationMessage(`Access level changed to ${picked.label}`);
                statusBar.update();
                chatProvider.updateConfig();
            }
        })
    );

    registerCodeActions(context, llmClient, chatProvider);
    context.subscriptions.push(statusBar);

    statusBar.update();

    const config = vscode.workspace.getConfiguration('localLLM');
    if (!config.get<string>('baseUrl')) {
        vscode.window.showWarningMessage(
            'Local LLM: baseUrl is not configured. Please set it in settings.',
            'Open Settings'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('localLLM.openSettings');
            }
        });
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('localLLM')) {
                statusBar.update();
                chatProvider.updateConfig();
            }
        })
    );
}

export function deactivate() {}