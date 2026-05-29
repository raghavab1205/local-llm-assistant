import * as vscode from 'vscode';
import { LLMClient } from './llmClient';
import { ChatViewProvider } from './chatviewprovider';
import { StatusBarManager } from './statusBar';
import { registerCodeActions } from './codeActions';

export function activate(context: vscode.ExtensionContext) {
    const llmClient = new LLMClient();
    const chatProvider = new ChatViewProvider(context.extensionUri, llmClient);
    const statusBar = new StatusBarManager(llmClient);

    // Register chat view provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('localLLM.chat', chatProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    // Register commands
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
        }),
        vscode.commands.registerCommand('localLLM.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'localLLM');
        })
    );

    // Register code actions
    registerCodeActions(context, llmClient, chatProvider);

    // Register status bar
    context.subscriptions.push(statusBar);

    // Update status bar and validate settings on activation
    statusBar.update();

    const config = vscode.workspace.getConfiguration('localLLM');
    if (!config.get<string>('baseUrl')) {
        vscode.window.showWarningMessage(
            'Local LLM: baseUrl is not configured. Please set it in settings.',
            'Open Settings'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'localLLM');
            }
        });
    }

    // Listen for configuration changes
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