import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AccessControlConfig, getTerminalExecutionDecision, approvePattern, logAction } from './accessControl';

const execAsync = promisify(exec);

export async function executeTerminalCommand(
    command: string,
    config: AccessControlConfig
): Promise<{ success: boolean; output?: string; error?: string }> {
    const decision = getTerminalExecutionDecision(command, config);

    if (decision.action === 'block') {
        vscode.window.showErrorMessage(`⛔ Terminal command blocked: ${command}. ${decision.reason}`);
        logAction('BLOCKED_TERMINAL', command);
        return { success: false, error: `Blocked: ${decision.reason}` };
    }

    if (decision.action === 'review') {
        const choice = await vscode.window.showWarningMessage(
            `Agent wants to run:\n$ ${command}`,
            { modal: true, detail: decision.reason || 'This command requires your approval.' },
            'Run',
            'Run All Similar',
            'Reject'
        );
        if (choice === 'Reject' || !choice) {
            logAction('REJECTED_TERMINAL', command);
            return { success: false, error: 'User rejected the command.' };
        }
        if (choice === 'Run All Similar') {
            approvePattern(command);
        }
    }

    logAction('RUN_TERMINAL', command);
    try {
        let output: string;
        if (config.shellIntegrationEnabled) {
            output = await runWithShellIntegration(command);
        } else {
            output = await runWithChildProcess(command);
        }
        return { success: true, output };
    } catch (error) {
        return { success: false, error: `${error}` };
    }
}

async function runWithChildProcess(command: string): Promise<string> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const { stdout, stderr } = await execAsync(command, { cwd, timeout: 30000, maxBuffer: 1024 * 1024 });
    return stdout + (stderr ? `\nstderr: ${stderr}` : '');
}

async function runWithShellIntegration(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const terminalName = 'Local LLM Agent';
        let terminal = vscode.window.terminals.find(t => t.name === terminalName);
        if (!terminal) {
            terminal = vscode.window.createTerminal({ name: terminalName });
        }
        terminal.show();
        terminal.sendText(command, true);
        resolve(`Command executed in terminal: ${command}\n(Enable shell integration in settings for captured output)`);
    });
}