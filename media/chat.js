(function() {
    const vscode = acquireVsCodeApi();

    const messagesContainer = document.getElementById('messages');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const clearBtn = document.getElementById('clear');
    const modelInfo = document.getElementById('model-info');
    const loading = document.getElementById('loading');

    let currentAssistantMessage = null;

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function renderMarkdown(text) {
        let html = escapeHtml(text);

        // Code blocks
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang || 'text'}">${code}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Line breaks
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

    function setLoading(isLoading) {
        loading.style.display = isLoading ? 'block' : 'none';
        input.disabled = isLoading;
        sendBtn.disabled = isLoading;
    }

    function sendMessage() {
        const text = input.value.trim();
        if (!text || input.disabled) return;
        addMessage('user', text);
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
            case 'setLoading':
                setLoading(message.loading);
                break;
            case 'clearChat':
                messagesContainer.innerHTML = '';
                break;
            case 'error':
                addMessage('error', message.text);
                finishStreaming();
                break;
        }
    });

    // Notify extension that webview is ready
    vscode.postMessage({ type: 'ready' });
})();