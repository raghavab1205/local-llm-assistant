(function() {
    const vscode = acquireVsCodeApi();

    const messagesContainer = document.getElementById('messages');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const clearBtn = document.getElementById('clear');
    const modelInfo = document.getElementById('model-info');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const inputStatus = document.getElementById('input-status');
    const warningBanner = document.getElementById('warning-banner');

    let currentAssistantMessage = null;

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function renderMarkdown(text) {
        let html = escapeHtml(text);
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang || 'text'}">${code}</code></pre>`;
        });
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    function addMessage(role, content, streaming = false) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        if (streaming) {
            div.id = 'streaming-message';
            currentAssistantMessage = div;
        }
        div.innerHTML = `<div class="content">${renderMarkdown(content)}</div>`;
        messagesContainer.appendChild(div);
        scrollToBottom();
        return div;
    }

    function appendToStreaming(token) {
        if (currentAssistantMessage) {
            const contentDiv = currentAssistantMessage.querySelector('.content');
            const currentText = contentDiv.getAttribute('data-raw') || '';
            const newText = currentText + token;
            contentDiv.setAttribute('data-raw', newText);
            contentDiv.innerHTML = renderMarkdown(newText);
            scrollToBottom();
        }
    }

    function finishStreaming() {
        if (currentAssistantMessage) {
            currentAssistantMessage.removeAttribute('id');
            currentAssistantMessage = null;
        }
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function updateStatus(status, text) {
        statusDot.className = 'status-dot ' + status;
        statusText.textContent = text;

        if (status === 'thinking' || status === 'slow') {
            inputStatus.textContent = text;
            input.disabled = true;
            sendBtn.disabled = true;
        } else if (status === 'error' || status === 'disconnected') {
            inputStatus.textContent = text;
            input.disabled = false;
            sendBtn.disabled = false;
        } else {
            inputStatus.textContent = '';
            input.disabled = false;
            sendBtn.disabled = false;
        }
    }

    function sendMessage() {
        const text = input.value.trim();
        if (!text || input.disabled) return;
        input.value = '';
        vscode.postMessage({ type: 'sendMessage', text });
    }

    sendBtn.addEventListener('click', sendMessage);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    clearBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'clearChat' });
    });

    window.addEventListener('message', (e) => {
        const message = e.data;
        switch (message.type) {
            case 'addMessage':
                addMessage(message.role, message.content);
                break;
            case 'startStream':
                addMessage('assistant', '', true);
                break;
            case 'streamToken':
                appendToStreaming(message.token);
                break;
            case 'endStream':
                finishStreaming();
                break;
            case 'setModelInfo':
                modelInfo.textContent = message.text;
                break;
            case 'status':
                updateStatus(message.status, message.text);
                break;
            case 'clearChat':
                messagesContainer.innerHTML = '';
                break;
            case 'error':
                addMessage('error', message.text);
                finishStreaming();
                break;
            case 'accessConfig':
                if (message.config.terminalAutoExecution === 'always_proceed') {
                    warningBanner.style.display = 'block';
                } else {
                    warningBanner.style.display = 'none';
                }
                break;
        }
    });

    vscode.postMessage({ type: 'ready' });
})();