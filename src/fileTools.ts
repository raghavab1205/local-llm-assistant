import * as vscode from 'vscode';
import * as path from 'path';
import { AccessLevel, isPathAllowed, isPathBlocked, isToolAllowed, getAccessControlConfig, logAction } from './accessControl';

export interface ToolResult {
    success: boolean;
    content?: string;
    error?: string;
}

export async function executeFileTool(
    toolName: string,
    params: any,
    level: AccessLevel,
    nonWorkspaceEnabled: boolean
): Promise<ToolResult> {
    if (!isToolAllowed(toolName, level)) {
        return { success: false, error: `Blocked: this action requires ${getRequiredLevel(toolName)} access.` };
    }

    const pathsToCheck = getPathsFromParams(toolName, params);
    for (const p of pathsToCheck) {
        if (isPathBlocked(p)) {
            vscode.window.showWarningMessage(`⛔ Agent attempted to access a protected file: ${p}. Request was blocked.`);
            logAction('BLOCKED_PATH', p);
            return { success: false, error: `Blocked: ${p} is a protected file.` };
        }
        if (!isPathAllowed(p, level, nonWorkspaceEnabled)) {
            logAction('DENIED_PATH', p);
            return { success: false, error: `Access denied: path is outside the trusted workspace.` };
        }
    }

    try {
        switch (toolName) {
            case 'read_file': return await readFile(params.path);
            case 'write_file': return await writeFile(params.path, params.content);
            case 'create_file': return await createFile(params.path, params.content);
            case 'delete_file': return await deleteFile(params.path);
            case 'rename_file': return await renameFile(params.from, params.to);
            case 'list_dir': return await listDir(params.path);
            case 'search_files': return await searchFiles(params.pattern, params.contains);
            case 'patch_file': return await patchFile(params.path, params.search, params.replace);
            default: return { success: false, error: `Unknown tool: ${toolName}` };
        }
    } catch (error) {
        logAction('TOOL_ERROR', `${toolName}: ${error}`);
        return { success: false, error: `${error}` };
    }
}

function getRequiredLevel(toolName: string): string {
    if (['delete_file'].includes(toolName)) return 'SANDBOXED';
    if (['fetch_url'].includes(toolName)) return 'FULL';
    return 'STRICT';
}

function getPathsFromParams(toolName: string, params: any): string[] {
    switch (toolName) {
        case 'read_file':
        case 'write_file':
        case 'create_file':
        case 'delete_file':
        case 'list_dir':
        case 'patch_file':
            return [params.path];
        case 'rename_file':
            return [params.from, params.to];
        default:
            return [];
    }
}

async function readFile(filePath: string): Promise<ToolResult> {
    const uri = vscode.Uri.file(filePath);
    const data = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(data).toString('utf-8');
    logAction('READ_FILE', filePath);
    return { success: true, content };
}

async function writeFile(filePath: string, content: string): Promise<ToolResult> {
    await createSnapshot(filePath);
    const uri = vscode.Uri.file(filePath);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
    logAction('WRITE_FILE', filePath);
    return { success: true, content: `File written: ${filePath}` };
}

async function createFile(filePath: string, content: string): Promise<ToolResult> {
    const uri = vscode.Uri.file(filePath);
    try {
        await vscode.workspace.fs.stat(uri);
        return { success: false, error: `File already exists: ${filePath}` };
    } catch {
        // doesn't exist
    }
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
    logAction('CREATE_FILE', filePath);
    return { success: true, content: `File created: ${filePath}` };
}

async function deleteFile(filePath: string): Promise<ToolResult> {
    await createSnapshot(filePath);
    const uri = vscode.Uri.file(filePath);
    await vscode.workspace.fs.delete(uri);
    logAction('DELETE_FILE', filePath);
    return { success: true, content: `File deleted: ${filePath}` };
}

async function renameFile(from: string, to: string): Promise<ToolResult> {
    await createSnapshot(from);
    const fromUri = vscode.Uri.file(from);
    const toUri = vscode.Uri.file(to);
    await vscode.workspace.fs.rename(fromUri, toUri);
    logAction('RENAME_FILE', `${from} -> ${to}`);
    return { success: true, content: `Renamed ${from} to ${to}` };
}

async function listDir(dirPath: string): Promise<ToolResult> {
    const uri = vscode.Uri.file(dirPath);
    const entries = await vscode.workspace.fs.readDirectory(uri);
    const lines = entries.map(([name, type]) => {
        const typeStr = type === vscode.FileType.Directory ? 'dir' : type === vscode.FileType.File ? 'file' : 'other';
        return `${typeStr}: ${name}`;
    });
    logAction('LIST_DIR', dirPath);
    return { success: true, content: lines.join('\n') || '(empty directory)' };
}

async function searchFiles(pattern: string, contains?: string): Promise<ToolResult> {
    const results: string[] = [];
    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 50);
    for (const file of files) {
        if (contains) {
            try {
                const data = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(data).toString('utf-8');
                if (text.includes(contains)) {
                    results.push(file.fsPath);
                }
            } catch {
                // skip unreadable
            }
        } else {
            results.push(file.fsPath);
        }
    }
    logAction('SEARCH_FILES', `${pattern} ${contains || ''}`);
    return { success: true, content: results.join('\n') || 'No files found.' };
}

async function patchFile(filePath: string, search: string, replace: string): Promise<ToolResult> {
    await createSnapshot(filePath);
    const uri = vscode.Uri.file(filePath);
    const data = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(data).toString('utf-8');
    if (!content.includes(search)) {
        return { success: false, error: `Search text not found in file.` };
    }
    const newContent = content.replace(search, replace);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(newContent, 'utf-8'));
    logAction('PATCH_FILE', filePath);
    return { success: true, content: `Patched ${filePath}` };
}

async function createSnapshot(filePath: string): Promise<void> {
    const config = getAccessControlConfig();
    if (!config.snapshotsEnabled) return;
    try {
        const data = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '.';
        const snapshotDir = path.join(workspaceRoot, '.local-llm-snapshots');
        const timestamp = Date.now();
        const snapshotName = `${path.basename(filePath)}.${timestamp}.snapshot`;
        const snapshotPath = path.join(snapshotDir, snapshotName);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(snapshotDir));
        await vscode.workspace.fs.writeFile(vscode.Uri.file(snapshotPath), data);
    } catch {
        // file might not exist yet
    }
}