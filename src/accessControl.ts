import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export type AccessLevel = 'strict' | 'sandboxed' | 'full';
export type TerminalAutoExecution = 'always_proceed' | 'proceed_in_sandbox' | 'request_review';

export interface AccessControlConfig {
    accessLevel: AccessLevel;
    terminalAutoExecution: TerminalAutoExecution;
    shellIntegrationEnabled: boolean;
    nonWorkspaceFileAccess: boolean;
    terminalDenyList: string[];
    terminalAllowList: string[];
    logAgentActions: boolean;
    snapshotsEnabled: boolean;
}

export function getAccessControlConfig(): AccessControlConfig {
    const config = vscode.workspace.getConfiguration('localLLM');
    return {
        accessLevel: config.get<AccessLevel>('accessLevel', 'strict'),
        terminalAutoExecution: config.get<TerminalAutoExecution>('terminalAutoExecution', 'request_review'),
        shellIntegrationEnabled: config.get<boolean>('shellIntegrationEnabled', false),
        nonWorkspaceFileAccess: config.get<boolean>('nonWorkspaceFileAccess', false),
        terminalDenyList: config.get<string[]>('terminalDenyList', [
            'rm -rf /', 'rm -rf ~', 'mkfs.*', 'dd if=.*',
            'curl.*|.*sh', 'wget.*|.*sh', ':(){ :|:& };:'
        ]),
        terminalAllowList: config.get<string[]>('terminalAllowList', [
            'npm *', 'npx *', 'python *', 'pip *', 'cargo *', 'go *', 'git *'
        ]),
        logAgentActions: config.get<boolean>('logAgentActions', true),
        snapshotsEnabled: config.get<boolean>('snapshotsEnabled', true)
    };
}

export function getAccessLevelLabel(level: AccessLevel): string {
    switch (level) {
        case 'strict': return '🔒 Strict';
        case 'sandboxed': return '🟡 Sandboxed';
        case 'full': return '🔓 Full Access';
    }
}

export function getAccessLevelDescription(level: AccessLevel): string {
    switch (level) {
        case 'strict': return 'Trusted workspace only. All terminal commands require approval.';
        case 'sandboxed': return 'Restricted mode. Terminal commands auto-proceed only if in allowlist.';
        case 'full': return 'Full machine access. Use with caution.';
    }
}

export function isToolAllowed(toolName: string, level: AccessLevel): boolean {
    const strictTools = ['read_file', 'write_file', 'create_file', 'rename_file', 'list_dir', 'search_files', 'patch_file', 'run_terminal'];
    const sandboxedTools = [...strictTools, 'delete_file'];
    const fullTools = [...sandboxedTools, 'fetch_url'];
    switch (level) {
        case 'strict': return strictTools.includes(toolName);
        case 'sandboxed': return sandboxedTools.includes(toolName);
        case 'full': return fullTools.includes(toolName);
    }
}

export function isExternalAccessAllowed(level: AccessLevel): boolean {
    return level === 'full';
}

function expandHome(filePath: string): string {
    if (filePath.startsWith('~/') || filePath === '~') {
        return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
}

export function isPathBlocked(filePath: string): boolean {
    const expanded = expandHome(filePath);
    const normalized = path.normalize(expanded).toLowerCase();
    const blockedPatterns = [
        /\.env$/, /\.env\./, /\.envrc$/,
        /secret/, /credential/, /password/, /token/,
        /\.pem$/, /\.p12$/, /\.pfx$/, /\.key$/,
        /\/\.ssh\//, /\/\.aws\/credentials/, /\/\.aws\/config/,
        /\/etc\/passwd/, /\/etc\/shadow/
    ];
    const blockedExact = ['.env', '.envrc'];
    const basename = path.basename(expanded);
    if (blockedExact.includes(basename)) return true;
    for (const pattern of blockedPatterns) {
        if (pattern.test(normalized)) return true;
    }
    return false;
}

export function isPathInWorkspace(filePath: string): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return false;
    const expanded = expandHome(filePath);
    const normalized = path.normalize(expanded);
    for (const folder of workspaceFolders) {
        const folderPath = path.normalize(folder.uri.fsPath);
        if (normalized.startsWith(folderPath + path.sep) || normalized === folderPath) return true;
    }
    return false;
}

export function isPathAllowed(filePath: string, level: AccessLevel, nonWorkspaceEnabled: boolean): boolean {
    const expanded = expandHome(filePath);
    if (isPathBlocked(expanded)) return false;
    if (isPathInWorkspace(expanded)) return true;
    if (level === 'full' && nonWorkspaceEnabled) return true;
    return false;
}

export function matchesPattern(command: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return regex.test(command.trim());
}

export function isTerminalCommandDenied(command: string, denyList: string[]): boolean {
    for (const pattern of denyList) {
        if (matchesPattern(command, pattern)) return true;
    }
    return false;
}

export function isTerminalCommandAllowed(command: string, allowList: string[]): boolean {
    for (const pattern of allowList) {
        if (matchesPattern(command, pattern)) return true;
    }
    return false;
}

const approvedPatterns = new Set<string>();

export function clearApprovedPatterns(): void {
    approvedPatterns.clear();
}

export function isPatternApproved(command: string): boolean {
    for (const pattern of approvedPatterns) {
        if (matchesPattern(command, pattern)) return true;
    }
    return false;
}

export function approvePattern(command: string): void {
    approvedPatterns.add(command);
}

export function getTerminalExecutionDecision(
    command: string,
    config: AccessControlConfig
): { action: 'proceed' | 'review' | 'block'; reason?: string } {
    if (isTerminalCommandDenied(command, config.terminalDenyList)) {
        return { action: 'block', reason: 'Command matches deny list' };
    }
    if (isPatternApproved(command)) {
        return { action: 'proceed' };
    }
    if (config.accessLevel === 'strict') {
        return { action: 'review', reason: 'Strict mode requires manual approval' };
    }
    if (config.accessLevel === 'full' && config.terminalAutoExecution === 'always_proceed') {
        return { action: 'proceed' };
    }
    if (config.accessLevel === 'sandboxed' && config.terminalAutoExecution === 'proceed_in_sandbox') {
        if (isTerminalCommandAllowed(command, config.terminalAllowList)) {
            return { action: 'proceed' };
        }
        return { action: 'review', reason: 'Command not in safe list' };
    }
    return { action: 'review' };
}

const outputChannel = vscode.window.createOutputChannel('Local LLM Agent');

export function logAction(action: string, details: string): void {
    const config = getAccessControlConfig();
    if (config.logAgentActions) {
        outputChannel.appendLine(`[${new Date().toISOString()}] ${action}: ${details}`);
    }
}