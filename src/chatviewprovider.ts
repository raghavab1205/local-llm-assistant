import * as vscode from 'vscode';
import { LLMClient, ChatMessage } from './llmClient';

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
                    break;
            }
        });

        // Flush pending messages
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
                <span id="model-info">Loading...</span>
                <button id="clear" title="Clear chat">Clear</button>
            </div>
            <div id="messages"></div>
            <div id="loading" style="display:none; padding: 8px 12px; opacity: 0.7;">Thinking...</div>
            <div id="input-container">
                <textarea id="input" placeholder="Ask something... (Shift+Enter for new line)"></textarea>
                <button id="send" title="Send message">Send</button>
            </div>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    async handleUserMessage(text: string) {
        if (this.isProcessing) {
            this.postMessage({ type: 'error', text: 'Please wait for the current response to complete.' });
            return;
        }

        this.isProcessing = true;
        this.postMessage({ type: 'setLoading', loading: true });

        // Add user message
        this.messages.push({ role: 'user', content: text });
        this.postMessage({ type: 'addMessage', role: 'user', content: text });

        try {
            if (text.startsWith('/')) {
                await this.handleSlashCommand(text);
            } else {
                await this.sendToLLM();
            }
        } catch (error) {
            this.postMessage({ type: 'error', text: `Error: ${error}` });
        } finally {
            this.isProcessing = false;
            this.postMessage({ type: 'setLoading', loading: false });
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
            return;
        }

        await this.streamLLMResponse(prompt);
    }

    private async sendToLLM() {
        const config = this.llmClient.getConfig();
        const systemMessage: ChatMessage = { role: 'system', content: config.systemPrompt };
        await this.streamLLMResponseWithHistory([systemMessage, ...this.messages]);
    }

    private async streamLLMResponse(prompt: string) {
        const config = this.llmClient.getConfig();
        const messages: ChatMessage[] = [
            { role: 'system', content: config.systemPrompt },
            { role: 'user', content: prompt }
        ];
        await this.streamLLMResponseWithHistory(messages);
    }

    private async streamLLMResponseWithHistory(messages: ChatMessage[]) {
        this.postMessage({ type: 'startStream' });

        try {
            let fullResponse = '';
            for await (const token of this.llmClient.streamChat(messages)) {
                fullResponse += token;
                this.postMessage({ type: 'streamToken', token });
            }
            this.messages.push({ role: 'assistant', content: fullResponse });
            this.postMessage({ type: 'endStream' });
        } catch (error) {
            this.postMessage({ type: 'error', text: `Error: ${error}` });
            this.postMessage({ type: 'endStream' });
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
    }

    private updateModelInfo() {
        const config = this.llmClient.getConfig();
        this.postMessage({ type: 'setModelInfo', text: `${config.backend} • ${config.modelName}` });
    }

    private postMessage(message: any) {
        if (this.view && this.isReady) {
            this.view.webview.postMessage(message);
        } else {
            this.pendingMessages.push(message);
        }
    }
}