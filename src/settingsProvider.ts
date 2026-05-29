import * as vscode from 'vscode';
import { getAccessControlConfig } from './accessControl';

export class SettingsProvider {
    private panel?: vscode.WebviewPanel;

    constructor(private context: vscode.ExtensionContext) {}

    show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'localLLM.settings',
            'Local LLM Agent Settings',
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        this.panel.webview.html = this.getHtml(this.panel.webview);

        this.panel.webview.onDidReceiveMessage(async message => {
            switch (message.type) {
                case 'updateSetting':
                    await vscode.workspace.getConfiguration('localLLM').update(message.key, message.value, true);
                    this.refresh();
                    break;
                case 'resetSettings': {
                    const cfg = vscode.workspace.getConfiguration('localLLM');
                    const keys = ['accessLevel', 'terminalAutoExecution', 'shellIntegrationEnabled', 'nonWorkspaceFileAccess', 'terminalDenyList', 'terminalAllowList', 'logAgentActions', 'snapshotsEnabled'];
                    for (const key of keys) {
                        await cfg.update(key, undefined, true);
                    }
                    vscode.window.showInformationMessage('Agent settings reset to defaults.');
                    this.refresh();
                    break;
                }
                case 'clearSnapshots':
                    vscode.window.showInformationMessage('Snapshots cleared (placeholder).');
                    break;
            }
        });

        this.refresh();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private refresh() {
        this.panel?.webview.postMessage({ type: 'config', config: getAccessControlConfig() });
    }

    private getHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'settings.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'settings.css'));

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
            <link rel="stylesheet" href="${styleUri}">
        </head>
        <body>
            <div class="container">
                <h1>Agent Settings</h1>
                <section>
                    <h2>Access Level</h2>
                    <div class="cards" id="access-cards">
                        <div class="card" data-level="strict">
                            <div class="card-icon">🔒</div>
                            <div class="card-title">Strict</div>
                            <div class="card-desc">Trusted workspace only. All terminal commands require approval.</div>
                        </div>
                        <div class="card" data-level="sandboxed">
                            <div class="card-icon">🟡</div>
                            <div class="card-title">Sandboxed</div>
                            <div class="card-desc">Restricted mode. Terminal commands auto-proceed only if in allowlist.</div>
                        </div>
                        <div class="card" data-level="full">
                            <div class="card-icon">🔓</div>
                            <div class="card-title">Full Access</div>
                            <div class="card-desc">Full machine access. Use with caution.</div>
                        </div>
                    </div>
                </section>
                <section>
                    <h2>Terminal</h2>
                    <div class="field">
                        <label>Terminal Command Auto Execution</label>
                        <select id="terminal-auto">
                            <option value="request_review">Request Review</option>
                            <option value="proceed_in_sandbox">Proceed In Sandbox</option>
                            <option value="always_proceed">Always Proceed</option>
                        </select>
                        <div class="hint">Controls how terminal commands are handled.</div>
                    </div>
                    <div class="field">
                        <label class="toggle">
                            <input type="checkbox" id="shell-integration">
                            <span class="toggle-slider"></span>
                            Enable Shell Integration
                        </label>
                        <div class="hint">Use VS Code's shell integration API for richer terminal output.</div>
                    </div>
                </section>
                <section>
                    <h2>File Access</h2>
                    <div class="field">
                        <label class="toggle">
                            <input type="checkbox" id="non-workspace-access">
                            <span class="toggle-slider"></span>
                            Agent Non-Workspace File Access
                        </label>
                        <div class="hint" id="non-workspace-hint">Allow agent to access files outside the workspace root.</div>
                    </div>
                </section>
                <section>
                    <h2>Lists</h2>
                    <div class="field">
                        <label>Safe Commands (Allowlist)</label>
                        <div class="tag-input" id="allow-list"></div>
                        <div class="hint">Commands that auto-proceed in Sandboxed mode.</div>
                    </div>
                    <div class="field">
                        <label>Deny List</label>
                        <div class="tag-input" id="deny-list"></div>
                        <div class="hint">Commands that are always blocked.</div>
                    </div>
                </section>
                <section class="danger">
                    <h2>⚠ Danger Zone</h2>
                    <button id="clear-snapshots" class="danger-btn">Clear all snapshots</button>
                    <button id="reset-settings" class="danger-btn">Reset all agent settings</button>
                </section>
            </div>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}