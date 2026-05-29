import * as vscode from 'vscode';

export type BackendType = 'ollama' | 'lmstudio' | 'llamacpp' | 'openai-compatible';

export interface LLMConfig {
    backend: BackendType;
    baseUrl: string;
    modelName: string;
    apiKey?: string;
    maxTokens: number;
    temperature: number;
    systemPrompt: string;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class LLMClient {
    getConfig(): LLMConfig {
        const config = vscode.workspace.getConfiguration('localLLM');
        let baseUrl = config.get<string>('baseUrl', 'http://localhost:11434');
        baseUrl = baseUrl.replace(/\/$/, '');
        return {
            backend: config.get<BackendType>('backend', 'ollama'),
            baseUrl,
            modelName: config.get<string>('modelName', 'llama3'),
            apiKey: config.get<string>('apiKey'),
            maxTokens: config.get<number>('maxTokens', 2048),
            temperature: config.get<number>('temperature', 0.7),
            systemPrompt: config.get<string>('systemPrompt', 'You are a helpful AI coding assistant. You write clean, well-documented code and explain concepts clearly.')
        };
    }

    async *streamChat(messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
        const config = this.getConfig();
        if (config.backend === 'ollama') {
            yield* this.streamOllama(messages, config);
        } else if (config.backend === 'llamacpp') {
            yield* this.streamLlamaCpp(messages, config);
        } else {
            yield* this.streamOpenAICompatible(messages, config);
        }
    }

    private async *streamOllama(messages: ChatMessage[], config: LLMConfig): AsyncGenerator<string> {
        const url = `${config.baseUrl}/api/chat`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.modelName,
                messages,
                stream: true,
                options: {
                    temperature: config.temperature,
                    num_predict: config.maxTokens
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.message?.content) {
                        yield data.message.content;
                    }
                    if (data.done) {
                        return;
                    }
                } catch {
                    // ignore parse errors
                }
            }
        }
    }

    private async *streamOpenAICompatible(messages: ChatMessage[], config: LLMConfig): AsyncGenerator<string> {
        const url = `${config.baseUrl}/v1/chat/completions`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (config.apiKey) {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: config.modelName,
                messages,
                stream: true,
                max_tokens: config.maxTokens,
                temperature: config.temperature
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (dataStr === '[DONE]') continue;
                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices?.[0]?.delta?.content;
                        if (content) {
                            yield content;
                        }
                    } catch {
                        // ignore
                    }
                }
            }
        }
    }

    private async *streamLlamaCpp(messages: ChatMessage[], config: LLMConfig): AsyncGenerator<string> {
        const prompt = this.messagesToPrompt(messages);
        const url = `${config.baseUrl}/completion`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                stream: true,
                n_predict: config.maxTokens,
                temperature: config.temperature
            })
        });

        if (!response.ok) {
            throw new Error(`llama.cpp error: ${response.status} ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.content) {
                            yield data.content;
                        }
                        if (data.stop) {
                            return;
                        }
                    } catch {
                        // ignore
                    }
                }
            }
        }
    }

    private messagesToPrompt(messages: ChatMessage[]): string {
        return messages.map(m => {
            if (m.role === 'system') return `System: ${m.content}\n`;
            if (m.role === 'user') return `User: ${m.content}\n`;
            return `Assistant: ${m.content}\n`;
        }).join('') + 'Assistant: ';
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            const config = this.getConfig();
            let testUrl: string;

            if (config.backend === 'ollama') {
                testUrl = `${config.baseUrl}/api/tags`;
            } else if (config.backend === 'llamacpp') {
                testUrl = `${config.baseUrl}/health`;
            } else {
                testUrl = `${config.baseUrl}/v1/models`;
            }

            const headers: Record<string, string> = {};
            if (config.apiKey) {
                headers['Authorization'] = `Bearer ${config.apiKey}`;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(testUrl, {
                headers,
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (response.ok) {
                return { success: true, message: `Connected to ${config.backend} at ${config.baseUrl}` };
            } else {
                return { success: false, message: `HTTP ${response.status}: ${response.statusText}` };
            }
        } catch (error) {
            return { success: false, message: `${error}` };
        }
    }
}