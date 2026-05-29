# Local LLM Assistant

A VS Code extension that connects to locally running Large Language Models for AI-powered coding assistance. Keep your code private by using local AI backends.

## Features

- **Chat Panel**: Sidebar chat interface with real-time streaming responses and Markdown rendering
- **Inline Code Actions**: Right-click on selected code to:
  - Explain code
  - Refactor code (with diff preview)
  - Generate unit tests (in new editor tab)
  - Fix code (with diff preview)
- **Slash Commands**: Quick commands in chat
  - `/explain` – explain selected or pasted code
  - `/refactor` – refactor code
  - `/test` – generate unit tests
  - `/doc` – generate JSDoc/docstring comments
  - `/ask` – general questions
- **Status Bar**: Shows active model and connection status (click to open settings)
- **Connection Test**: Verify your backend is reachable from the command palette

## Supported Backends

### Ollama (Default)
The easiest way to run local LLMs.

1. Install [Ollama](https://ollama.com)
2. Pull a model: `ollama pull llama3` (or `codellama`, `mistral`, etc.)
3. Start Ollama: `ollama serve`
4. Extension settings:
   - Backend: `ollama`
   - Base URL: `http://localhost:11434`
   - Model: `llama3`

### LM Studio
User-friendly GUI for local LLMs.

1. Install [LM Studio](https://lmstudio.ai)
2. Download a model from the LM Studio model browser
3. Go to the **Developer** tab and start the local server
4. Extension settings:
   - Backend: `lmstudio`
   - Base URL: `http://localhost:1234`
   - Model: (leave empty or use the model ID shown in LM Studio)

### llama.cpp
Lightweight, efficient C++ implementation.

1. Build or download [llama.cpp](https://github.com/ggerganov/llama.cpp)
2. Start the server:
   ```bash
   ./server -m models/your-model.gguf -c 4096