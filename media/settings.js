(function() {
    const vscode = acquireVsCodeApi();

    const accessCards = document.querySelectorAll('.card');
    const terminalAuto = document.getElementById('terminal-auto');
    const shellIntegration = document.getElementById('shell-integration');
    const nonWorkspaceAccess = document.getElementById('non-workspace-access');
    const nonWorkspaceHint = document.getElementById('non-workspace-hint');
    const allowListContainer = document.getElementById('allow-list');
    const denyListContainer = document.getElementById('deny-list');
    const clearSnapshots = document.getElementById('clear-snapshots');
    const resetSettings = document.getElementById('reset-settings');

    let currentConfig = {};
    let allowListItems = [];
    let denyListItems = [];

    function createTagInput(container, items, onChange) {
        container.innerHTML = '';
        const tags = document.createElement('div');
        tags.className = 'tags';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Add item...';
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                items.push(input.value.trim());
                input.value = '';
                render();
                onChange([...items]);
            }
        });

        function render() {
            tags.innerHTML = '';
            items.forEach((item, i) => {
                const tag = document.createElement('span');
                tag.className = 'tag';
                tag.textContent = item;
                const remove = document.createElement('span');
                remove.className = 'remove';
                remove.textContent = '×';
                remove.onclick = () => {
                    items.splice(i, 1);
                    render();
                    onChange([...items]);
                };
                tag.appendChild(remove);
                tags.appendChild(tag);
            });
        }

        render();
        container.appendChild(tags);
        container.appendChild(input);
    }

    accessCards.forEach(card => {
        card.addEventListener('click', () => {
            const level = card.dataset.level;
            if (level === 'full') {
                if (!confirm('Full Access gives the agent unrestricted access to your machine. Continue?')) return;
            }
            vscode.postMessage({ type: 'updateSetting', key: 'accessLevel', value: level });
        });
    });

    terminalAuto.addEventListener('change', () => {
        vscode.postMessage({ type: 'updateSetting', key: 'terminalAutoExecution', value: terminalAuto.value });
    });

    shellIntegration.addEventListener('change', () => {
        vscode.postMessage({ type: 'updateSetting', key: 'shellIntegrationEnabled', value: shellIntegration.checked });
    });

    nonWorkspaceAccess.addEventListener('change', () => {
        vscode.postMessage({ type: 'updateSetting', key: 'nonWorkspaceFileAccess', value: nonWorkspaceAccess.checked });
    });

    clearSnapshots.addEventListener('click', () => {
        vscode.postMessage({ type: 'clearSnapshots' });
    });

    resetSettings.addEventListener('click', () => {
        vscode.postMessage({ type: 'resetSettings' });
    });

    window.addEventListener('message', (e) => {
        const message = e.data;
        if (message.type === 'config') {
            currentConfig = message.config;

            accessCards.forEach(card => {
                card.classList.toggle('active', card.dataset.level === currentConfig.accessLevel);
            });

            terminalAuto.value = currentConfig.terminalAutoExecution;
            shellIntegration.checked = currentConfig.shellIntegrationEnabled;
            nonWorkspaceAccess.checked = currentConfig.nonWorkspaceFileAccess;

            if (currentConfig.accessLevel !== 'full') {
                nonWorkspaceAccess.disabled = true;
                nonWorkspaceHint.textContent = 'Requires Full Access mode';
                nonWorkspaceHint.classList.add('warning');
            } else {
                nonWorkspaceAccess.disabled = false;
                nonWorkspaceHint.textContent = 'Allow agent to access files outside the workspace root.';
                nonWorkspaceHint.classList.remove('warning');
            }

            allowListItems = [...currentConfig.terminalAllowList];
            denyListItems = [...currentConfig.terminalDenyList];

            createTagInput(allowListContainer, allowListItems, (items) => {
                vscode.postMessage({ type: 'updateSetting', key: 'terminalAllowList', value: items });
            });
            createTagInput(denyListContainer, denyListItems, (items) => {
                vscode.postMessage({ type: 'updateSetting', key: 'terminalDenyList', value: items });
            });
        }
    });
})();