import * as vscode from 'vscode';
import { LLMClient } from './llmClient';
import { ChatViewProvider } from './chatviewprovider';

export function registerCodeActions(
    context: vscode.ExtensionContext,
    llmClient: LLMClient,
    chatProvider: ChatViewProvider
) {
    const getSelectedCode = (): { text: string; language: string } | null => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showWarningMessage('Please select some code first.');
            return null;
        }
        return {
            text: editor.document.getText(editor.selection),
            language: editor.document.languageId
        };
    };

    const getLLMResponse = async (prompt: string): Promise<string> => {
        const config = llmClient.getConfig();
        const messages = [
            { role: 'system' as const, content: config.systemPrompt },
            { role: 'user' as const, content: prompt }
        ];
        let response = '';
        for await (const token of llmClient.streamChat(messages)) {
            response += token;
        }
        return response;
    };

    const extractCode = (response: string): string => {
        const match = response.match(/```[\w]*\n([\s\S]*?)```/);
        return match ? match[1].trim() : response.trim();
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('localLLM.explainCode', async () => {
            const selected = getSelectedCode();
            if (!selected) return;
            await vscode.commands.executeCommand('localLLM.chat.focus');
            await chatProvider.sendCodeQuery('Explain the following code in detail:', selected.text);
        }),

        vscode.commands.registerCommand('localLLM.refactorCode', async () => {
            const selected = getSelectedCode();
            if (!selected) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Refactoring code with Local LLM...',
                cancellable: false
            }, async () => {
                const prompt = `Refactor the following code to improve readability, performance, and best practices. Only return the refactored code, no explanations:\n\n\`\`\`\n${selected!.text}\n\`\`\``;
                const refactored = await getLLMResponse(prompt);
                const cleanCode = extractCode(refactored);

                const originalDoc = await vscode.workspace.openTextDocument({
                    content: selected!.text,
                    language: selected!.language
                });
                const modifiedDoc = await vscode.workspace.openTextDocument({
                    content: cleanCode,
                    language: selected!.language
                });

                await vscode.commands.executeCommand('vscode.diff',
                    originalDoc.uri,
                    modifiedDoc.uri,
                    'Refactor Suggestion'
                );
            });
        }),

        vscode.commands.registerCommand('localLLM.generateTests', async () => {
            const selected = getSelectedCode();
            if (!selected) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Generating tests with Local LLM...',
                cancellable: false
            }, async () => {
                const prompt = `Write comprehensive unit tests for the following code. Only return the test code:\n\n\`\`\`\n${selected!.text}\n\`\`\``;
                const tests = await getLLMResponse(prompt);
                const cleanTests = extractCode(tests);

                const doc = await vscode.workspace.openTextDocument({
                    content: cleanTests,
                    language: selected!.language
                });
                await vscode.window.showTextDocument(doc, { preview: false });
            });
        }),

        vscode.commands.registerCommand('localLLM.fixCode', async () => {
            const selected = getSelectedCode();
            if (!selected) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Fixing code with Local LLM...',
                cancellable: false
            }, async () => {
                const prompt = `Fix any bugs or issues in the following code. Only return the fixed code, no explanations:\n\n\`\`\`\n${selected!.text}\n\`\`\``;
                const fixed = await getLLMResponse(prompt);
                const cleanCode = extractCode(fixed);

                const originalDoc = await vscode.workspace.openTextDocument({
                    content: selected!.text,
                    language: selected!.language
                });
                const modifiedDoc = await vscode.workspace.openTextDocument({
                    content: cleanCode,
                    language: selected!.language
                });

                await vscode.commands.executeCommand('vscode.diff',
                    originalDoc.uri,
                    modifiedDoc.uri,
                    'Fix Suggestion'
                );
            });
        })
    );
}