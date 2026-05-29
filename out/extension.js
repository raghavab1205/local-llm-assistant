"use strict";var ee=Object.create;var T=Object.defineProperty;var te=Object.getOwnPropertyDescriptor;var se=Object.getOwnPropertyNames;var oe=Object.getPrototypeOf,ne=Object.prototype.hasOwnProperty;var ae=(t,e)=>{for(var s in e)T(t,s,{get:e[s],enumerable:!0})},B=(t,e,s,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of se(e))!ne.call(t,r)&&r!==s&&T(t,r,{get:()=>e[r],enumerable:!(o=te(e,r))||o.enumerable});return t};var w=(t,e,s)=>(s=t!=null?ee(oe(t)):{},B(e||!t||!t.__esModule?T(s,"default",{value:t,enumerable:!0}):s,t)),re=t=>B(T({},"__esModule",{value:!0}),t);var Se={};ae(Se,{activate:()=>Ee,deactivate:()=>Pe});module.exports=re(Se);var m=w(require("vscode"));var N=w(require("vscode")),$=class{getConfig(){let e=N.workspace.getConfiguration("localLLM"),s=e.get("baseUrl","http://localhost:11434");return s=s.replace(/\/$/,""),{backend:e.get("backend","ollama"),baseUrl:s,modelName:e.get("modelName","llama3"),apiKey:e.get("apiKey"),maxTokens:e.get("maxTokens",2048),temperature:e.get("temperature",.7),systemPrompt:e.get("systemPrompt","You are a helpful AI coding assistant. You write clean, well-documented code and explain concepts clearly.")}}async*streamChat(e){let s=this.getConfig();s.backend==="ollama"?yield*this.streamOllama(e,s):s.backend==="llamacpp"?yield*this.streamLlamaCpp(e,s):yield*this.streamOpenAICompatible(e,s)}async*streamOllama(e,s){let o=`${s.baseUrl}/api/chat`,r=await fetch(o,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:s.modelName,messages:e,stream:!0,options:{temperature:s.temperature,num_predict:s.maxTokens}})});if(!r.ok)throw new Error(`Ollama error: ${r.status} ${r.statusText}`);let a=r.body?.getReader();if(!a)throw new Error("No response body");let n=new TextDecoder;for(;;){let{done:c,value:d}=await a.read();if(c)break;let h=n.decode(d,{stream:!0}).split(`
`).filter(v=>v.trim());for(let v of h)try{let g=JSON.parse(v);if(g.message?.content&&(yield g.message.content),g.done)return}catch{}}}async*streamOpenAICompatible(e,s){let o=`${s.baseUrl}/v1/chat/completions`,r={"Content-Type":"application/json"};s.apiKey&&(r.Authorization=`Bearer ${s.apiKey}`);let a=await fetch(o,{method:"POST",headers:r,body:JSON.stringify({model:s.modelName,messages:e,stream:!0,max_tokens:s.maxTokens,temperature:s.temperature})});if(!a.ok)throw new Error(`API error: ${a.status} ${a.statusText}`);let n=a.body?.getReader();if(!n)throw new Error("No response body");let c=new TextDecoder;for(;;){let{done:d,value:u}=await n.read();if(d)break;let v=c.decode(u,{stream:!0}).split(`
`).filter(g=>g.trim());for(let g of v)if(g.startsWith("data: ")){let p=g.slice(6).trim();if(p==="[DONE]")continue;try{let W=JSON.parse(p).choices?.[0]?.delta?.content;W&&(yield W)}catch{}}}}async*streamLlamaCpp(e,s){let o=this.messagesToPrompt(e),r=`${s.baseUrl}/completion`,a=await fetch(r,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:o,stream:!0,n_predict:s.maxTokens,temperature:s.temperature})});if(!a.ok)throw new Error(`llama.cpp error: ${a.status} ${a.statusText}`);let n=a.body?.getReader();if(!n)throw new Error("No response body");let c=new TextDecoder;for(;;){let{done:d,value:u}=await n.read();if(d)break;let v=c.decode(u,{stream:!0}).split(`
`).filter(g=>g.trim());for(let g of v)if(g.startsWith("data: ")){let p=g.slice(6).trim();try{let b=JSON.parse(p);if(b.content&&(yield b.content),b.stop)return}catch{}}}}messagesToPrompt(e){return e.map(s=>s.role==="system"?`System: ${s.content}
`:s.role==="user"?`User: ${s.content}
`:`Assistant: ${s.content}
`).join("")+"Assistant: "}async testConnection(){try{let e=this.getConfig(),s;e.backend==="ollama"?s=`${e.baseUrl}/api/tags`:e.backend==="llamacpp"?s=`${e.baseUrl}/health`:s=`${e.baseUrl}/v1/models`;let o={};e.apiKey&&(o.Authorization=`Bearer ${e.apiKey}`);let r=new AbortController,a=setTimeout(()=>r.abort(),5e3),n=await fetch(s,{headers:o,signal:r.signal});return clearTimeout(a),n.ok?{success:!0,message:`Connected to ${e.backend} at ${e.baseUrl}`}:{success:!1,message:`HTTP ${n.status}: ${n.statusText}`}}catch(e){return{success:!1,message:`${e}`}}}};var M=w(require("vscode"));var A=w(require("vscode")),x=w(require("path")),j=w(require("os"));function L(){let t=A.workspace.getConfiguration("localLLM");return{accessLevel:t.get("accessLevel","strict"),terminalAutoExecution:t.get("terminalAutoExecution","request_review"),shellIntegrationEnabled:t.get("shellIntegrationEnabled",!1),nonWorkspaceFileAccess:t.get("nonWorkspaceFileAccess",!1),terminalDenyList:t.get("terminalDenyList",["rm -rf /","rm -rf ~","mkfs.*","dd if=.*","curl.*|.*sh","wget.*|.*sh",":(){ :|:& };:"]),terminalAllowList:t.get("terminalAllowList",["npm *","npx *","python *","pip *","cargo *","go *","git *"]),logAgentActions:t.get("logAgentActions",!0),snapshotsEnabled:t.get("snapshotsEnabled",!0)}}function E(t){switch(t){case"strict":return"\u{1F512} Strict";case"sandboxed":return"\u{1F7E1} Sandboxed";case"full":return"\u{1F513} Full Access"}}function q(t,e){let s=["read_file","write_file","create_file","rename_file","list_dir","search_files","patch_file","run_terminal"],o=[...s,"delete_file"],r=[...o,"fetch_url"];switch(e){case"strict":return s.includes(t);case"sandboxed":return o.includes(t);case"full":return r.includes(t)}}function H(t){return t==="full"}function F(t){return t.startsWith("~/")||t==="~"?x.join(j.homedir(),t.slice(1)):t}function D(t){let e=F(t),s=x.normalize(e).toLowerCase(),o=[/\.env$/,/\.env\./,/\.envrc$/,/secret/,/credential/,/password/,/token/,/\.pem$/,/\.p12$/,/\.pfx$/,/\.key$/,/\/\.ssh\//,/\/\.aws\/credentials/,/\/\.aws\/config/,/\/etc\/passwd/,/\/etc\/shadow/],r=[".env",".envrc"],a=x.basename(e);if(r.includes(a))return!0;for(let n of o)if(n.test(s))return!0;return!1}function ie(t){let e=A.workspace.workspaceFolders;if(!e)return!1;let s=F(t),o=x.normalize(s);for(let r of e){let a=x.normalize(r.uri.fsPath);if(o.startsWith(a+x.sep)||o===a)return!0}return!1}function J(t,e,s){let o=F(t);return D(o)?!1:!!(ie(o)||e==="full"&&s)}function I(t,e){return new RegExp("^"+e.replace(/[.+^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*").replace(/\?/g,".")+"$").test(t.trim())}function ce(t,e){for(let s of e)if(I(t,s))return!0;return!1}function le(t,e){for(let s of e)if(I(t,s))return!0;return!1}var O=new Set;function K(){O.clear()}function de(t){for(let e of O)if(I(t,e))return!0;return!1}function z(t){O.add(t)}function Y(t,e){return ce(t,e.terminalDenyList)?{action:"block",reason:"Command matches deny list"}:de(t)?{action:"proceed"}:e.accessLevel==="strict"?{action:"review",reason:"Strict mode requires manual approval"}:e.accessLevel==="full"&&e.terminalAutoExecution==="always_proceed"?{action:"proceed"}:e.accessLevel==="sandboxed"&&e.terminalAutoExecution==="proceed_in_sandbox"?le(t,e.terminalAllowList)?{action:"proceed"}:{action:"review",reason:"Command not in safe list"}:{action:"review"}}var ue=A.window.createOutputChannel("Local LLM Agent");function f(t,e){L().logAgentActions&&ue.appendLine(`[${new Date().toISOString()}] ${t}: ${e}`)}var i=w(require("vscode")),k=w(require("path"));async function G(t,e,s,o){if(!q(t,s))return{success:!1,error:`Blocked: this action requires ${pe(t)} access.`};let r=me(t,e);for(let a of r){if(D(a))return i.window.showWarningMessage(`\u26D4 Agent attempted to access a protected file: ${a}. Request was blocked.`),f("BLOCKED_PATH",a),{success:!1,error:`Blocked: ${a} is a protected file.`};if(!J(a,s,o))return f("DENIED_PATH",a),{success:!1,error:"Access denied: path is outside the trusted workspace."}}try{switch(t){case"read_file":return await fe(e.path);case"write_file":return await ge(e.path,e.content);case"create_file":return await he(e.path,e.content);case"delete_file":return await ve(e.path);case"rename_file":return await we(e.from,e.to);case"list_dir":return await ye(e.path);case"search_files":return await be(e.pattern,e.contains);case"patch_file":return await xe(e.path,e.search,e.replace);default:return{success:!1,error:`Unknown tool: ${t}`}}}catch(a){return f("TOOL_ERROR",`${t}: ${a}`),{success:!1,error:`${a}`}}}function pe(t){return["delete_file"].includes(t)?"SANDBOXED":["fetch_url"].includes(t)?"FULL":"STRICT"}function me(t,e){switch(t){case"read_file":case"write_file":case"create_file":case"delete_file":case"list_dir":case"patch_file":return[e.path];case"rename_file":return[e.from,e.to];default:return[]}}async function fe(t){let e=i.Uri.file(t),s=await i.workspace.fs.readFile(e),o=Buffer.from(s).toString("utf-8");return f("READ_FILE",t),{success:!0,content:o}}async function ge(t,e){await P(t);let s=i.Uri.file(t);return await i.workspace.fs.writeFile(s,Buffer.from(e,"utf-8")),f("WRITE_FILE",t),{success:!0,content:`File written: ${t}`}}async function he(t,e){let s=i.Uri.file(t);try{return await i.workspace.fs.stat(s),{success:!1,error:`File already exists: ${t}`}}catch{}return await i.workspace.fs.writeFile(s,Buffer.from(e,"utf-8")),f("CREATE_FILE",t),{success:!0,content:`File created: ${t}`}}async function ve(t){await P(t);let e=i.Uri.file(t);return await i.workspace.fs.delete(e),f("DELETE_FILE",t),{success:!0,content:`File deleted: ${t}`}}async function we(t,e){await P(t);let s=i.Uri.file(t),o=i.Uri.file(e);return await i.workspace.fs.rename(s,o),f("RENAME_FILE",`${t} -> ${e}`),{success:!0,content:`Renamed ${t} to ${e}`}}async function ye(t){let e=i.Uri.file(t),o=(await i.workspace.fs.readDirectory(e)).map(([r,a])=>`${a===i.FileType.Directory?"dir":a===i.FileType.File?"file":"other"}: ${r}`);return f("LIST_DIR",t),{success:!0,content:o.join(`
`)||"(empty directory)"}}async function be(t,e){let s=[],o=await i.workspace.findFiles(t,"**/node_modules/**",50);for(let r of o)if(e)try{let a=await i.workspace.fs.readFile(r);Buffer.from(a).toString("utf-8").includes(e)&&s.push(r.fsPath)}catch{}else s.push(r.fsPath);return f("SEARCH_FILES",`${t} ${e||""}`),{success:!0,content:s.join(`
`)||"No files found."}}async function xe(t,e,s){await P(t);let o=i.Uri.file(t),r=await i.workspace.fs.readFile(o),a=Buffer.from(r).toString("utf-8");if(!a.includes(e))return{success:!1,error:"Search text not found in file."};let n=a.replace(e,s);return await i.workspace.fs.writeFile(o,Buffer.from(n,"utf-8")),f("PATCH_FILE",t),{success:!0,content:`Patched ${t}`}}async function P(t){if(L().snapshotsEnabled)try{let s=await i.workspace.fs.readFile(i.Uri.file(t)),o=i.workspace.workspaceFolders?.[0]?.uri.fsPath||".",r=k.join(o,".local-llm-snapshots"),a=Date.now(),n=`${k.basename(t)}.${a}.snapshot`,c=k.join(r,n);await i.workspace.fs.createDirectory(i.Uri.file(r)),await i.workspace.fs.writeFile(i.Uri.file(c),s)}catch{}}var C=w(require("vscode")),Q=require("child_process"),V=require("util");var Le=(0,V.promisify)(Q.exec);async function X(t,e){let s=Y(t,e);if(s.action==="block")return C.window.showErrorMessage(`\u26D4 Terminal command blocked: ${t}. ${s.reason}`),f("BLOCKED_TERMINAL",t),{success:!1,error:`Blocked: ${s.reason}`};if(s.action==="review"){let o=await C.window.showWarningMessage(`Agent wants to run:
$ ${t}`,{modal:!0,detail:s.reason||"This command requires your approval."},"Run","Run All Similar","Reject");if(o==="Reject"||!o)return f("REJECTED_TERMINAL",t),{success:!1,error:"User rejected the command."};o==="Run All Similar"&&z(t)}f("RUN_TERMINAL",t);try{let o;return e.shellIntegrationEnabled?o=await Ae(t):o=await Ce(t),{success:!0,output:o}}catch(o){return{success:!1,error:`${o}`}}}async function Ce(t){let e=C.workspace.workspaceFolders?.[0]?.uri.fsPath||process.cwd(),{stdout:s,stderr:o}=await Le(t,{cwd:e,timeout:3e4,maxBuffer:1024*1024});return s+(o?`
stderr: ${o}`:"")}async function Ae(t){return new Promise((e,s)=>{let o="Local LLM Agent",r=C.window.terminals.find(a=>a.name===o);r||(r=C.window.createTerminal({name:o})),r.show(),r.sendText(t,!0),e(`Command executed in terminal: ${t}
(Enable shell integration in settings for captured output)`)})}var S=class{constructor(e,s){this.extensionUri=e;this.llmClient=s}view;messages=[];pendingMessages=[];isReady=!1;isProcessing=!1;resolveWebviewView(e){this.view=e,this.isReady=!0,e.webview.options={enableScripts:!0,localResourceRoots:[this.extensionUri]},e.webview.html=this.getHtml(e.webview),e.webview.onDidReceiveMessage(async s=>{switch(s.type){case"sendMessage":await this.handleUserMessage(s.text);break;case"clearChat":this.clearChat();break;case"ready":this.updateModelInfo(),this.checkConnection(),this.sendAccessConfig();break}});for(let s of this.pendingMessages)e.webview.postMessage(s);this.pendingMessages=[],e.onDidDispose(()=>{this.view=void 0,this.isReady=!1})}getHtml(e){let s=e.asWebviewUri(M.Uri.joinPath(this.extensionUri,"media","chat.js")),o=e.asWebviewUri(M.Uri.joinPath(this.extensionUri,"media","chat.css"));return`<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${e.cspSource}; script-src ${e.cspSource};">
            <link rel="stylesheet" href="${o}">
        </head>
        <body>
            <div id="header">
                <div id="header-left">
                    <div id="model-info">Loading...</div>
                    <div id="status-bar">
                        <span id="status-dot" class="disconnected"></span>
                        <span id="status-text">Checking connection...</span>
                    </div>
                </div>
                <button id="clear" title="Clear chat">Clear</button>
            </div>
            <div id="warning-banner" style="display:none;">\u26A0 Terminal auto-execution is on</div>
            <div id="messages"></div>
            <div id="input-area">
                <textarea id="input" placeholder="Ask something... (Shift+Enter for new line)"></textarea>
                <div id="input-actions">
                    <span id="input-status"></span>
                    <button id="send" title="Send message">Send</button>
                </div>
            </div>
            <script src="${s}"></script>
        </body>
        </html>`}async handleUserMessage(e){if(this.isProcessing){this.postMessage({type:"status",status:"error",text:"Please wait for the current response."});return}this.isProcessing=!0;try{e.startsWith("/")?await this.handleSlashCommand(e):(this.messages.push({role:"user",content:e}),this.postMessage({type:"addMessage",role:"user",content:e})),await this.runAgentLoop()}catch(s){this.postMessage({type:"status",status:"error",text:`Error: ${s}`}),this.postMessage({type:"error",text:`Error: ${s}`})}finally{this.isProcessing=!1}}async handleSlashCommand(e){let o=e.split(/\s+/)[0].toLowerCase(),r=e.slice(o.length).trim(),a=r;if(!a){let c=M.window.activeTextEditor;c&&!c.selection.isEmpty&&(a=c.document.getText(c.selection))}let n="";switch(o){case"/explain":n=a?`Explain the following code in detail:

\`\`\`
${a}
\`\`\``:"Please provide code to explain after the command, or select code in the editor.";break;case"/refactor":n=a?`Refactor the following code to improve readability, performance, and best practices. Explain the changes:

\`\`\`
${a}
\`\`\``:"Please provide code to refactor after the command, or select code in the editor.";break;case"/test":n=a?`Write comprehensive unit tests for the following code:

\`\`\`
${a}
\`\`\``:"Please provide code to test after the command, or select code in the editor.";break;case"/doc":n=a?`Add JSDoc/docstring comments to the following code. Return the full documented code:

\`\`\`
${a}
\`\`\``:"Please provide code to document after the command, or select code in the editor.";break;case"/ask":default:n=r||"How can I help you?";break}if(!a&&o!=="/ask"){this.postMessage({type:"addMessage",role:"assistant",content:n}),this.postMessage({type:"status",status:"idle",text:"Ready"});return}this.messages.push({role:"user",content:n}),this.postMessage({type:"addMessage",role:"user",content:n})}async runAgentLoop(){let e=this.llmClient.getConfig(),s=L(),o=0,r=10;for(;o<r;){o++;let n=[{role:"system",content:ke(e.systemPrompt,s)},...this.messages.filter(p=>p.role!=="system")];this.postMessage({type:"status",status:"thinking",text:o===1?"Thinking...":"Using tools..."});let c="",d=!1,u=setTimeout(()=>{d||this.postMessage({type:"status",status:"slow",text:"Backend is slow..."})},5e3);try{for await(let p of this.llmClient.streamChat(n))d||(clearTimeout(u),d=!0),c+=p}catch(p){clearTimeout(u),this.postMessage({type:"status",status:"error",text:"Backend error"}),this.postMessage({type:"error",text:`Error: ${p}`});break}clearTimeout(u);let h=Te(c);if(h.length===0){this.postMessage({type:"addMessage",role:"assistant",content:c}),this.messages.push({role:"assistant",content:c}),this.postMessage({type:"status",status:"idle",text:"Ready"});break}this.postMessage({type:"status",status:"thinking",text:"Executing tools..."}),this.messages.push({role:"assistant",content:c});let v=[];for(let p of h){let b;p.name==="run_terminal"?b=await X(p.params.command||p.params,s):p.name==="fetch_url"?H(s.accessLevel)?b=await $e(p.params.url||p.params):b={success:!1,error:"Blocked: fetch_url requires FULL access."}:b=await G(p.name,p.params,s.accessLevel,s.nonWorkspaceFileAccess),v.push(`<<tool_result name="${p.name}">${JSON.stringify(b)}</tool_result>`)}let g=`<tool_results>
${v.join(`
`)}
</tool_results>`;this.messages.push({role:"user",content:g})}o>=r&&(this.postMessage({type:"error",text:"Agent reached maximum tool iteration limit."}),this.postMessage({type:"status",status:"error",text:"Max iterations reached"}))}async sendCodeQuery(e,s){let o=`${e}

\`\`\`
${s}
\`\`\``;await this.handleUserMessage(o)}clearChat(){this.messages=[],this.postMessage({type:"clearChat"})}updateConfig(){this.updateModelInfo(),this.checkConnection(),this.sendAccessConfig()}updateModelInfo(){let e=this.llmClient.getConfig();this.postMessage({type:"setModelInfo",text:`${e.backend} \u2022 ${e.modelName}`})}async checkConnection(){this.postMessage({type:"status",status:"thinking",text:"Checking connection..."}),(await this.llmClient.testConnection()).success?this.postMessage({type:"status",status:"idle",text:"Connected"}):this.postMessage({type:"status",status:"disconnected",text:"Disconnected"})}sendAccessConfig(){let e=L();this.postMessage({type:"accessConfig",config:e})}postMessage(e){this.view&&this.isReady?this.view.webview.postMessage(e):this.pendingMessages.push(e)}};function ke(t,e){let s=Me(e);return`${t}

You are an agentic AI assistant with access to tools. You can read, write, and manage files, run terminal commands, and fetch URLs (when permitted).

Current access level: ${e.accessLevel}

Available tools:
${s}

Use tools by outputting XML tags:
<<tool name="TOOL_NAME">{ "param1": "value1", ... }</tool>

After using tools, you will receive <tool_result> tags with the results. Use these to formulate your final response.

Important: Only use tools when necessary. Do not make up file contents. Always verify paths exist before reading.`}function Me(t){let e=[{name:"read_file",params:'{ "path": "..." }',desc:"Read a file"},{name:"write_file",params:'{ "path": "...", "content": "..." }',desc:"Write to a file"},{name:"create_file",params:'{ "path": "...", "content": "..." }',desc:"Create a new file"},{name:"rename_file",params:'{ "from": "...", "to": "..." }',desc:"Rename a file"},{name:"list_dir",params:'{ "path": "..." }',desc:"List directory contents"},{name:"search_files",params:'{ "pattern": "...", "contains": "..." }',desc:"Search files"},{name:"patch_file",params:'{ "path": "...", "search": "...", "replace": "..." }',desc:"Patch a file"},{name:"run_terminal",params:'{ "command": "..." }',desc:"Run a terminal command"}];return(t.accessLevel==="sandboxed"||t.accessLevel==="full")&&e.push({name:"delete_file",params:'{ "path": "..." }',desc:"Delete a file"}),t.accessLevel==="full"&&e.push({name:"fetch_url",params:'{ "url": "..." }',desc:"Fetch a URL"}),e.map(s=>`- ${s.name}: ${s.desc} ${s.params}`).join(`
`)}function Te(t){let e=[],s=/<tool\s+name="([^"]+)">(.*?)<<\/tool>/gs,o;for(;(o=s.exec(t))!==null;)try{let a=o[1],n=o[2].trim(),c=JSON.parse(n);e.push({name:a,params:c})}catch{}let r=/<tool>(.*?)<<\/tool>/gs;for(;(o=r.exec(t))!==null;)try{let a=JSON.parse(o[1].trim());a.name&&a.params&&e.push({name:a.name,params:a.params})}catch{}return e}async function $e(t){try{let e=new AbortController,s=setTimeout(()=>e.abort(),1e4),o=await fetch(t,{signal:e.signal});return clearTimeout(s),{success:!0,content:(await o.text()).slice(0,1e4)}}catch(e){return{success:!1,error:`${e}`}}}var R=w(require("vscode"));var _=class{constructor(e){this.llmClient=e;this.statusBarItem=R.window.createStatusBarItem(R.StatusBarAlignment.Right,100),this.statusBarItem.command="localLLM.openSettings",this.update()}statusBarItem;async update(){let e=this.llmClient.getConfig(),s=L(),o=await this.llmClient.testConnection(),r=E(s.accessLevel);o.success?(this.statusBarItem.text=`$(check) ${e.modelName} | ${r}`,this.statusBarItem.tooltip=`${e.backend} \u2022 ${e.baseUrl}
${o.message}
Access: ${s.accessLevel}`):(this.statusBarItem.text=`$(error) ${e.modelName} | ${r}`,this.statusBarItem.tooltip=`${e.backend} \u2022 ${e.baseUrl}
${o.message}
Access: ${s.accessLevel}`),this.statusBarItem.show()}dispose(){this.statusBarItem.dispose()}};var l=w(require("vscode"));function Z(t,e,s){let o=()=>{let n=l.window.activeTextEditor;return!n||n.selection.isEmpty?(l.window.showWarningMessage("Please select some code first."),null):{text:n.document.getText(n.selection),language:n.document.languageId}},r=async n=>{let d=[{role:"system",content:e.getConfig().systemPrompt},{role:"user",content:n}],u="";for await(let h of e.streamChat(d))u+=h;return u},a=n=>{let c=n.match(/```[\w]*\n([\s\S]*?)```/);return c?c[1].trim():n.trim()};t.subscriptions.push(l.commands.registerCommand("localLLM.explainCode",async()=>{let n=o();n&&(await l.commands.executeCommand("localLLM.chat.focus"),await s.sendCodeQuery("Explain the following code in detail:",n.text))}),l.commands.registerCommand("localLLM.refactorCode",async()=>{let n=o();n&&await l.window.withProgress({location:l.ProgressLocation.Notification,title:"Refactoring code with Local LLM...",cancellable:!1},async()=>{let c=`Refactor the following code to improve readability, performance, and best practices. Only return the refactored code, no explanations:

\`\`\`
${n.text}
\`\`\``,d=await r(c),u=a(d),h=await l.workspace.openTextDocument({content:n.text,language:n.language}),v=await l.workspace.openTextDocument({content:u,language:n.language});await l.commands.executeCommand("vscode.diff",h.uri,v.uri,"Refactor Suggestion")})}),l.commands.registerCommand("localLLM.generateTests",async()=>{let n=o();n&&await l.window.withProgress({location:l.ProgressLocation.Notification,title:"Generating tests with Local LLM...",cancellable:!1},async()=>{let c=`Write comprehensive unit tests for the following code. Only return the test code:

\`\`\`
${n.text}
\`\`\``,d=await r(c),u=a(d),h=await l.workspace.openTextDocument({content:u,language:n.language});await l.window.showTextDocument(h,{preview:!1})})}),l.commands.registerCommand("localLLM.fixCode",async()=>{let n=o();n&&await l.window.withProgress({location:l.ProgressLocation.Notification,title:"Fixing code with Local LLM...",cancellable:!1},async()=>{let c=`Fix any bugs or issues in the following code. Only return the fixed code, no explanations:

\`\`\`
${n.text}
\`\`\``,d=await r(c),u=a(d),h=await l.workspace.openTextDocument({content:n.text,language:n.language}),v=await l.workspace.openTextDocument({content:u,language:n.language});await l.commands.executeCommand("vscode.diff",h.uri,v.uri,"Fix Suggestion")})}))}var y=w(require("vscode"));var U=class{constructor(e){this.context=e}panel;show(){if(this.panel){this.panel.reveal();return}this.panel=y.window.createWebviewPanel("localLLM.settings","Local LLM Agent Settings",y.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0}),this.panel.webview.html=this.getHtml(this.panel.webview),this.panel.webview.onDidReceiveMessage(async e=>{switch(e.type){case"updateSetting":await y.workspace.getConfiguration("localLLM").update(e.key,e.value,!0),this.refresh();break;case"resetSettings":{let s=y.workspace.getConfiguration("localLLM"),o=["accessLevel","terminalAutoExecution","shellIntegrationEnabled","nonWorkspaceFileAccess","terminalDenyList","terminalAllowList","logAgentActions","snapshotsEnabled"];for(let r of o)await s.update(r,void 0,!0);y.window.showInformationMessage("Agent settings reset to defaults."),this.refresh();break}case"clearSnapshots":y.window.showInformationMessage("Snapshots cleared (placeholder).");break}}),this.refresh(),this.panel.onDidDispose(()=>{this.panel=void 0})}refresh(){this.panel?.webview.postMessage({type:"config",config:L()})}getHtml(e){let s=e.asWebviewUri(y.Uri.joinPath(this.context.extensionUri,"media","settings.js")),o=e.asWebviewUri(y.Uri.joinPath(this.context.extensionUri,"media","settings.css"));return`<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${e.cspSource}; script-src ${e.cspSource};">
            <link rel="stylesheet" href="${o}">
        </head>
        <body>
            <div class="container">
                <h1>Agent Settings</h1>
                <section>
                    <h2>Access Level</h2>
                    <div class="cards" id="access-cards">
                        <div class="card" data-level="strict">
                            <div class="card-icon">\u{1F512}</div>
                            <div class="card-title">Strict</div>
                            <div class="card-desc">Trusted workspace only. All terminal commands require approval.</div>
                        </div>
                        <div class="card" data-level="sandboxed">
                            <div class="card-icon">\u{1F7E1}</div>
                            <div class="card-title">Sandboxed</div>
                            <div class="card-desc">Restricted mode. Terminal commands auto-proceed only if in allowlist.</div>
                        </div>
                        <div class="card" data-level="full">
                            <div class="card-icon">\u{1F513}</div>
                            <div class="card-title">Full Access</div>
                            <div class="card-desc">Full machine access. Use with caution.</div>
                        </div>
                    </div>
                </section>
                <section>
                    <h2>Terminal</h2>
                    <div class="field">
                        <label>Terminal Command Auto Execution</label>
                        <select id="terminal-auto">
                            <option value="request_review">Request Review</option>
                            <option value="proceed_in_sandbox">Proceed In Sandbox</option>
                            <option value="always_proceed">Always Proceed</option>
                        </select>
                        <div class="hint">Controls how terminal commands are handled.</div>
                    </div>
                    <div class="field">
                        <label class="toggle">
                            <input type="checkbox" id="shell-integration">
                            <span class="toggle-slider"></span>
                            Enable Shell Integration
                        </label>
                        <div class="hint">Use VS Code's shell integration API for richer terminal output.</div>
                    </div>
                </section>
                <section>
                    <h2>File Access</h2>
                    <div class="field">
                        <label class="toggle">
                            <input type="checkbox" id="non-workspace-access">
                            <span class="toggle-slider"></span>
                            Agent Non-Workspace File Access
                        </label>
                        <div class="hint" id="non-workspace-hint">Allow agent to access files outside the workspace root.</div>
                    </div>
                </section>
                <section>
                    <h2>Lists</h2>
                    <div class="field">
                        <label>Safe Commands (Allowlist)</label>
                        <div class="tag-input" id="allow-list"></div>
                        <div class="hint">Commands that auto-proceed in Sandboxed mode.</div>
                    </div>
                    <div class="field">
                        <label>Deny List</label>
                        <div class="tag-input" id="deny-list"></div>
                        <div class="hint">Commands that are always blocked.</div>
                    </div>
                </section>
                <section class="danger">
                    <h2>\u26A0 Danger Zone</h2>
                    <button id="clear-snapshots" class="danger-btn">Clear all snapshots</button>
                    <button id="reset-settings" class="danger-btn">Reset all agent settings</button>
                </section>
            </div>
            <script src="${s}"></script>
        </body>
        </html>`}};function Ee(t){let e=new $,s=new S(t.extensionUri,e),o=new _(e),r=new U(t);t.subscriptions.push(m.window.registerWebviewViewProvider("localLLM.chat",s,{webviewOptions:{retainContextWhenHidden:!0}})),t.subscriptions.push(m.commands.registerCommand("localLLM.openChat",()=>{m.commands.executeCommand("localLLM.chat.focus")}),m.commands.registerCommand("localLLM.testConnection",async()=>{let n=await e.testConnection();n.success?m.window.showInformationMessage(`Local LLM: ${n.message}`):m.window.showErrorMessage(`Local LLM: ${n.message}`),o.update()}),m.commands.registerCommand("localLLM.clearChat",()=>{s.clearChat(),K()}),m.commands.registerCommand("localLLM.openSettings",()=>{r.show()}),m.commands.registerCommand("localLLM.changeAccessLevel",async()=>{let c=["strict","sandboxed","full"].map(u=>({label:E(u),description:u,level:u})),d=await m.window.showQuickPick(c,{placeHolder:"Select access level for the Local LLM Agent"});if(d){if(d.level==="full"&&await m.window.showWarningMessage("Full Access gives the agent unrestricted access to your machine and external resources. All actions are logged. Continue?",{modal:!0},"Continue","Cancel")!=="Continue")return;await m.workspace.getConfiguration("localLLM").update("accessLevel",d.level,!0),m.window.showInformationMessage(`Access level changed to ${d.label}`),o.update(),s.updateConfig()}})),Z(t,e,s),t.subscriptions.push(o),o.update(),m.workspace.getConfiguration("localLLM").get("baseUrl")||m.window.showWarningMessage("Local LLM: baseUrl is not configured. Please set it in settings.","Open Settings").then(n=>{n==="Open Settings"&&m.commands.executeCommand("localLLM.openSettings")}),t.subscriptions.push(m.workspace.onDidChangeConfiguration(n=>{n.affectsConfiguration("localLLM")&&(o.update(),s.updateConfig())}))}function Pe(){}0&&(module.exports={activate,deactivate});
