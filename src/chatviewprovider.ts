import * as vscode from 'vscode';
import { LLMClient, ChatMessage } from './llmClient';
import { getAccessControlConfig, AccessLevel, isExternalAccessAllowed } from './accessControl';
import { executeFileTool } from './fileTools';
import { executeTerminalCommand } from './terminalRunner';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private messages: ChatMessage[] = [];
    private pendingMessages: any[] = [];
    private isReady = false;
    private isProcessing = false;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly llmClient: LLMClient
    ) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this.view = webviewView;
        this.isReady = true;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.type) {
                case 'sendMessage':
                    await this.handleUserMessage(message.text);
                    break;
                case 'clearChat':
                    this.clearChat();
                    break;
                case 'ready':
                    this.updateModelInfo();
                    this.checkConnection();
                    this.sendAccessConfig();
                    break;
            }
        });

        for (const msg of this.pendingMessages) {
            webviewView.webview.postMessage(msg);
        }
        this.pendingMessages = [];

        webviewView.onDidDispose(() => {
            this.view = undefined;
            this.isReady = false;
        });
    }

    private getHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.css'));

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
            <link rel="stylesheet" href="${styleUri}">
        </head>
        <body>
            <div id="header">
                <div id="header-left">
                    <div id="model-info">Loading...</div>
                    <div id="status-bar">
                        <span id="status-dot" class="disconnected"></span>
                        <span id="status-text">Checking connection...</span>
                    </div>
                </div>
                <button id="clear" title="Clear chat">Clear</button>
            </div>
            <div id="warning-banner" style="display:none;">⚠ Terminal auto-execution is on</div>
            <div id="messages"></div>
            <div id="input-area">
                <textarea id="input" placeholder="Ask something... (Shift+Enter for new line)"></textarea>
                <div id="input-actions">
                    <span id="input-status"></span>
                    <button id="send" title="Send message">Send</button>
                </div>
            </div>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    async handleUserMessage(text: string) {
        if (this.isProcessing) {
            this.postMessage({ type: 'status', status: 'error', text: 'Please wait for the current response.' });
            return;
        }

        this.isProcessing = true;

        try {
            if (text.startsWith('/')) {
                await this.handleSlashCommand(text);
            } else {
                this.messages.push({ role: 'user', content: text });
                this.postMessage({ type: 'addMessage', role: 'user', content: text });
            }
            await this.runAgentLoop();
        } catch (error) {
            this.postMessage({ type: 'status', status: 'error', text: `Error: ${error}` });
            this.postMessage({ type: 'error', text: `Error: ${error}` });
        } finally {
            this.isProcessing = false;
        }
    }

    private async handleSlashCommand(text: string) {
        const parts = text.split(/\s+/);
        const command = parts[0].toLowerCase();
        const rest = text.slice(command.length).trim();
        let code = rest;

        if (!code) {
            const editor = vscode.window.activeTextEditor;
            if (editor && !editor.selection.isEmpty) {
                code = editor.document.getText(editor.selection);
            }
        }

        let prompt = '';
        switch (command) {
            case '/explain':
                prompt = code
                    ? `Explain the following code in detail:\n\n\`\`\`\n${code}\n\`\`\``
                    : 'Please provide code to explain after the command, or select code in the editor.';
                break;
            case '/refactor':
                prompt = code
                    ? `Refactor the following code to improve readability, performance, and best practices. Explain the changes:\n\n\`\`\`\n${code}\n\`\`\``
                    : 'Please provide code to refactor after the command, or select code in the editor.';
                break;
            case '/test':
                prompt = code
                    ? `Write comprehensive unit tests for the following code:\n\n\`\`\`\n${code}\n\`\`\``
                    : 'Please provide code to test after the command, or select code in the editor.';
                break;
            case '/doc':
                prompt = code
                    ? `Add JSDoc/docstring comments to the following code. Return the full documented code:\n\n\`\`\`\n${code}\n\`\`\``
                    : 'Please provide code to document after the command, or select code in the editor.';
                break;
            case '/ask':
            default:
                prompt = rest || 'How can I help you?';
                break;
        }

        if (!code && command !== '/ask') {
            this.postMessage({ type: 'addMessage', role: 'assistant', content: prompt });
            this.postMessage({ type: 'status', status: 'idle', text: 'Ready' });
            return;
        }

        this.messages.push({ role: 'user', content: prompt });
        this.postMessage({ type: 'addMessage', role: 'user', content: prompt });
    }

    private async runAgentLoop() {
        const config = this.llmClient.getConfig();
        const accessConfig = getAccessControlConfig();

        let iterations = 0;
        const maxIterations = 10;

        while (iterations < maxIterations) {
            iterations++;

            const systemPrompt = buildAgentSystemPrompt(config.systemPrompt, accessConfig);
            const messagesForLLM: ChatMessage[] = [
                { role: 'system', content: systemPrompt },
                ...this.messages.filter(m => m.role !== 'system')
            ];

            this.postMessage({ type: 'status', status: 'thinking', text: iterations === 1 ? 'Thinking...' : 'Using tools...' });

            let fullResponse = '';
            let gotFirstToken = false;
            const slowTimeout = setTimeout(() => {
                if (!gotFirstToken) {
                    this.postMessage({ type: 'status', status: 'slow', text: 'Backend is slow...' });
                }
            }, 5000);

            try {
                for await (const token of this.llmClient.streamChat(messagesForLLM)) {
                    if (!gotFirstToken) {
                        clearTimeout(slowTimeout);
                        gotFirstToken = true;
                    }
                    fullResponse += token;
                }
            } catch (error) {
                clearTimeout(slowTimeout);
                this.postMessage({ type: 'status', status: 'error', text: `Backend error` });
                this.postMessage({ type: 'error', text: `Error: ${error}` });
                break;
            }
            clearTimeout(slowTimeout);

            const tools = parseToolCalls(fullResponse);
            if (tools.length === 0) {
                this.postMessage({ type: 'addMessage', role: 'assistant', content: fullResponse });
                this.messages.push({ role: 'assistant', content: fullResponse });
                this.postMessage({ type: 'status', status: 'idle', text: 'Ready' });
                break;
            }

            this.postMessage({ type: 'status', status: 'thinking', text: 'Executing tools...' });
            this.messages.push({ role: 'assistant', content: fullResponse });

            const toolResults: string[] = [];
            for (const tool of tools) {
                let result: any;
                if (tool.name === 'run_terminal') {
                    result = await executeTerminalCommand(tool.params.command || tool.params, accessConfig);
                } else if (tool.name === 'fetch_url') {
                    if (!isExternalAccessAllowed(accessConfig.accessLevel)) {
                        result = { success: false, error: 'Blocked: fetch_url requires FULL access.' };
                    } else {
                        result = await fetchUrlTool(tool.params.url || tool.params);
                    }
                } else {
                    result = await executeFileTool(tool.name, tool.params, accessConfig.accessLevel, accessConfig.nonWorkspaceFileAccess);
                }
                toolResults.push(`<<tool_result name="${tool.name}">${JSON.stringify(result)}</tool_result>`);
            }

            const toolResultContent = `<tool_results>\n${toolResults.join('\n')}\n</tool_results>`;
            this.messages.push({ role: 'user', content: toolResultContent });
        }

        if (iterations >= maxIterations) {
            this.postMessage({ type: 'error', text: 'Agent reached maximum tool iteration limit.' });
            this.postMessage({ type: 'status', status: 'error', text: 'Max iterations reached' });
        }
    }

    async sendCodeQuery(prompt: string, code: string) {
        const text = `${prompt}\n\n\`\`\`\n${code}\n\`\`\``;
        await this.handleUserMessage(text);
    }

    clearChat() {
        this.messages = [];
        this.postMessage({ type: 'clearChat' });
    }

    updateConfig() {
        this.updateModelInfo();
        this.checkConnection();
        this.sendAccessConfig();
    }

    private updateModelInfo() {
        const config = this.llmClient.getConfig();
        this.postMessage({ type: 'setModelInfo', text: `${config.backend} • ${config.modelName}` });
    }

    private async checkConnection() {
        this.postMessage({ type: 'status', status: 'thinking', text: 'Checking connection...' });
        const result = await this.llmClient.testConnection();
        if (result.success) {
            this.postMessage({ type: 'status', status: 'idle', text: 'Connected' });
        } else {
            this.postMessage({ type: 'status', status: 'disconnected', text: 'Disconnected' });
        }
    }

    private sendAccessConfig() {
        const accessConfig = getAccessControlConfig();
        this.postMessage({ type: 'accessConfig', config: accessConfig });
    }

    private postMessage(message: any) {
        if (this.view && this.isReady) {
            this.view.webview.postMessage(message);
        } else {
            this.pendingMessages.push(message);
        }
    }
}

function buildAgentSystemPrompt(basePrompt: string, accessConfig: ReturnType<typeof getAccessControlConfig>): string {
    const tools = getAvailableToolsDescription(accessConfig);
    return `${basePrompt}\n\nYou are an agentic AI assistant with access to tools. You can read, write, and manage files, run terminal commands, and fetch URLs (when permitted).\n\nCurrent access level: ${accessConfig.accessLevel}\n\nAvailable tools:\n${tools}\n\nUse tools by outputting XML tags:\n<<tool name="TOOL_NAME">{ "param1": "value1", ... }</tool>\n\nAfter using tools, you will receive <tool_result> tags with the results. Use these to formulate your final response.\n\nImportant: Only use tools when necessary. Do not make up file contents. Always verify paths exist before reading.`;
}

function getAvailableToolsDescription(accessConfig: ReturnType<typeof getAccessControlConfig>): string {
    const allTools = [
        { name: 'read_file', params: '{ "path": "..." }', desc: 'Read a file' },
        { name: 'write_file', params: '{ "path": "...", "content": "..." }', desc: 'Write to a file' },
        { name: 'create_file', params: '{ "path": "...", "content": "..." }', desc: 'Create a new file' },
        { name: 'rename_file', params: '{ "from": "...", "to": "..." }', desc: 'Rename a file' },
        { name: 'list_dir', params: '{ "path": "..." }', desc: 'List directory contents' },
        { name: 'search_files', params: '{ "pattern": "...", "contains": "..." }', desc: 'Search files' },
        { name: 'patch_file', params: '{ "path": "...", "search": "...", "replace": "..." }', desc: 'Patch a file' },
        { name: 'run_terminal', params: '{ "command": "..." }', desc: 'Run a terminal command' },
    ];

    if (accessConfig.accessLevel === 'sandboxed' || accessConfig.accessLevel === 'full') {
        allTools.push({ name: 'delete_file', params: '{ "path": "..." }', desc: 'Delete a file' });
    }

    if (accessConfig.accessLevel === 'full') {
        allTools.push({ name: 'fetch_url', params: '{ "url": "..." }', desc: 'Fetch a URL' });
    }

    return allTools.map(t => `- ${t.name}: ${t.desc} ${t.params}`).join('\n');
}

function parseToolCalls(response: string): Array<{ name: string; params: any }> {
    const tools: Array<{ name: string; params: any }> = [];
    const regex = /<tool\s+name="([^"]+)">(.*?)<<\/tool>/gs;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(response)) !== null) {
        try {
            const name = match[1];
            const paramsText = match[2].trim();
            const params = JSON.parse(paramsText);
            tools.push({ name, params });
        } catch {
            // Invalid tool format, skip
        }
    }

    const altRegex = /<tool>(.*?)<<\/tool>/gs;
    while ((match = altRegex.exec(response)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.name && parsed.params) {
                tools.push({ name: parsed.name, params: parsed.params });
            }
        } catch {
            // Skip
        }
    }

    return tools;
}

async function fetchUrlTool(url: string): Promise<any> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const text = await response.text();
        return { success: true, content: text.slice(0, 10000) };
    } catch (error) {
        return { success: false, error: `${error}` };
    }
}