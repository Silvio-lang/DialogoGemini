document.addEventListener('DOMContentLoaded', () => {
    // ================================================================
    // 1. SELEÇÃO DE ELEMENTOS
    // ================================================================
    const elements = {
        systemPromptInput: document.getElementById('system-prompt-input'),
        sendLevelsContainer: document.getElementById('send-levels-container'),
        sendLevel1Btn: document.getElementById('send-level-1-btn'),
        sendLevel2Btn: document.getElementById('send-level-2-btn'),
        sendLevel3Btn: document.getElementById('send-level-3-btn'),
        userInput: document.getElementById('user-input'),
        chatWindow: document.getElementById('chat-window'),
        apiKeyModal: document.getElementById('api-key-modal'),
        apiKeyInput: document.getElementById('api-key-input'),
        saveApiKeyBtn: document.getElementById('save-api-key-btn'),
        changeApiKeyLink: document.getElementById('change-api-key-link'),
        newChatLink: document.getElementById('new-chat-link'),
        loadingIndicator: document.getElementById('loading-indicator'),
        continueBtn: document.getElementById('continue-btn'),
        continueContainer: document.getElementById('continue-container'),
        speedSlider: document.getElementById('speed-slider'),
        showTourLink: document.getElementById('show-tour-link'),
        openSidebarBtn: document.getElementById('open-sidebar-btn'),
        closeSidebarBtn: document.getElementById('close-sidebar-btn'),
        toolsSidebar: document.getElementById('tools-sidebar'),
        conversationNameInput: document.getElementById('conversation-name-input'),
        saveConversationBtn: document.getElementById('save-conversation-btn'),
        savedConversationsList: document.getElementById('saved-conversations-list'),
        importConversationBtn: document.getElementById('import-conversation-btn'),
        exportJsonBtn: document.getElementById('export-json-btn'),
        exportMdBtn: document.getElementById('export-md-btn'),
        openAssistantLink: document.getElementById('open-assistant-link'),
        analyzeTitleBtn: document.getElementById('analyze-title-btn'),
        analyzeTopicsBtn: document.getElementById('analyze-topics-btn'),
        analyzeSummaryBtn: document.getElementById('analyze-summary-btn'),
        analyzeDetailedBtn: document.getElementById('analyze-detailed-btn'),
        toggleSearchBtn: document.getElementById('toggle-search-btn'),
        searchBtn: document.getElementById('search-btn'),
        clearSearchBtn: document.getElementById('clear-search-btn'),
        clearPromptBtn: document.getElementById('clear-prompt-btn'),
    };

    // ================================================================
    // 2. VARIÁVEIS DE ESTADO
    // ================================================================
    let conversationHistory = { messages: [], systemPrompt: null };
    let cachedChunks = [], currentChunkIndex = 0;
    let isTyping = false, typingSpeed = 180;
    let isSearchMode = false;
    let charsSinceLastPause = 0;
    const ACTIVE_CONVERSATION_KEY = 'activeConversation';
    const DEFAULT_SYSTEM_PROMPT = "Você é o DiálogoGemini, um assistente de IA prestativo e amigável. Responda em português do Brasil.";

    // ================================================================
    // 3. FUNÇÕES DE UI (INTERFACE DO USUÁRIO)
    // ================================================================
    const ui = {
        showLoading: () => { if (elements.loadingIndicator) elements.loadingIndicator.classList.remove('hidden'); },
        hideLoading: () => { if (elements.loadingIndicator) elements.loadingIndicator.classList.add('hidden'); },
        showContinueBtn: () => { if (elements.continueContainer) elements.continueContainer.classList.remove('hidden'); },
        hideContinueBtn: () => { if (elements.continueContainer) elements.continueContainer.classList.add('hidden'); },
        lockInput: () => {
            if (elements.userInput) elements.userInput.disabled = true;
            if (elements.sendLevel1Btn) elements.sendLevel1Btn.disabled = true;
            if (elements.sendLevel2Btn) elements.sendLevel2Btn.disabled = true;
            if (elements.sendLevel3Btn) elements.sendLevel3Btn.disabled = true;
        },
        unlockInput: () => {
            if (elements.userInput) elements.userInput.disabled = false;
            const hasText = elements.userInput.value.length > 0;
            if (elements.sendLevel1Btn) elements.sendLevel1Btn.disabled = !hasText;
            if (elements.sendLevel2Btn) elements.sendLevel2Btn.disabled = !hasText;
            if (elements.sendLevel3Btn) elements.sendLevel3Btn.disabled = !hasText;
            if (elements.userInput) elements.userInput.focus();
        }
    };

    // ================================================================
    // 4. FUNÇÕES DE PERSISTÊNCIA DA CONVERSA ATIVA
    // ================================================================
    function saveActiveConversation() {
        if (conversationHistory.messages.length > 0) {
            localStorage.setItem(ACTIVE_CONVERSATION_KEY, JSON.stringify(conversationHistory));
        } else {
            localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
        }
    }

    function loadActiveConversation() {
        const savedState = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
        if (savedState) {
            try {
                const loadedHistory = JSON.parse(savedState);
                if (loadedHistory && Array.isArray(loadedHistory.messages)) {
                    conversationHistory = loadedHistory;
                    rebuildChatFromHistory();
                    if (conversationHistory.systemPrompt) {
                        elements.systemPromptInput.value = conversationHistory.systemPrompt;
                    }
                    const savedName = localStorage.getItem('activeConversationName');
                    if (savedName) {
                        elements.conversationNameInput.value = savedName;
                    }
                    return true;
                }
            } catch (error) {
                console.error("Erro ao carregar a conversa ativa do LocalStorage:", error);
                localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
                return false;
            }
        }
        return false;
    }

// ================================================================
    // 5. FUNÇÕES PRINCIPAIS E DE LÓGICA
    // ================================================================
    function addSafeEventListener(element, event, handler) { if (element) { element.addEventListener(event, handler); } }

    function performSearch() {
        const searchTerm = elements.userInput.value.trim();
        rebuildChatFromHistory();
        if (!searchTerm) return;
        const chatMessages = elements.chatWindow.querySelectorAll('.message p');
        const searchRegex = new RegExp(searchTerm, 'gi');
        chatMessages.forEach(p => {
            const originalText = p.innerHTML;
            const newText = originalText.replace(searchRegex, (match) => `<mark>${match}</mark>`);
            p.innerHTML = newText;
        });
    }

    function clearSearch() {
        rebuildChatFromHistory();
    }

    function toggleSearchMode() {
        isSearchMode = !isSearchMode;
        elements.sendLevelsContainer.classList.toggle('hidden', isSearchMode);
        elements.searchBtn.classList.toggle('hidden', !isSearchMode);
        elements.clearSearchBtn.classList.toggle('hidden', !isSearchMode);
        elements.toggleSearchBtn.classList.toggle('active', isSearchMode);
        if (isSearchMode) {
            elements.userInput.placeholder = "Localizar na conversa...";
            elements.clearPromptBtn.classList.add('hidden');
        } else {
            elements.userInput.placeholder = "Digite sua mensagem aqui...";
            clearSearch();
        }
    }

    async function callAnalysisAPI(instruction, analysisTitle) {
        if (conversationHistory.messages.length < 2) {
            alert("A conversa é muito curta para ser analisada.");
            return;
        }
        ui.showLoading();
        elements.toolsSidebar.classList.remove('open');
        try {
            const apiKey = localStorage.getItem('geminiApiKey');
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const historyAsText = conversationHistory.messages
                .map(msg => `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}`)
                .join('\n\n');
            const fullPrompt = `${instruction}\n\n---\n\nHISTÓRICO DA CONVERSA:\n${historyAsText}`;
            const requestBody = { contents: [{ parts: [{ text: fullPrompt }] }] };
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            const data = await response.json();
            if (!response.ok || !data.candidates || !data.candidates[0].content) {
                const errorReason = data?.error?.message || data?.promptFeedback?.blockReason || 'A API não retornou um resultado válido.';
                throw new Error(errorReason);
            }
            const resultText = data.candidates[0].content.parts[0].text;
            const fullAnalysisContent = `**Análise: ${analysisTitle}**\n\n${resultText}`;
            const analysisMessage = {
                role: 'model',
                content: fullAnalysisContent,
                timestamp: new Date().toISOString()
            };
            conversationHistory.messages.push(analysisMessage);
            displayStaticMessage(analysisMessage.content, 'model', analysisMessage.timestamp);
            updateContextMeter();
        } catch (error) {
            console.error(`Erro na análise (${analysisTitle}):`, error);
            displayStaticMessage(`**Erro na Análise**\n\nOcorreu um erro: ${error.message}`, 'model');
        } finally {
            ui.hideLoading();
            ui.unlockInput();
        }
    }

    function setupSystemPrompt() {
        const savedSystemPrompt = localStorage.getItem('systemPrompt');
        if (savedSystemPrompt !== null) {
            elements.systemPromptInput.value = savedSystemPrompt;
            conversationHistory.systemPrompt = savedSystemPrompt;
        } else {
            elements.systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
            conversationHistory.systemPrompt = DEFAULT_SYSTEM_PROMPT;
        }
        addSafeEventListener(elements.systemPromptInput, 'input', () => {
            const currentPrompt = elements.systemPromptInput.value;
            localStorage.setItem('systemPrompt', currentPrompt);
            conversationHistory.systemPrompt = currentPrompt;
        });
    }

    function startNewChat() {
        console.log("Ação: Iniciando uma conversa nova e limpa.");
        conversationHistory = { messages: [], systemPrompt: null };
        const globalSystemPrompt = localStorage.getItem('systemPrompt') || DEFAULT_SYSTEM_PROMPT;
        conversationHistory.systemPrompt = globalSystemPrompt;
        elements.systemPromptInput.value = globalSystemPrompt;
        elements.chatWindow.innerHTML = '';
        elements.conversationNameInput.value = '';
        cachedChunks = [];
        currentChunkIndex = 0;
        isTyping = false;
        ui.hideContinueBtn();
        localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
        localStorage.removeItem('activeConversationName');
        displayStaticMessage('Olá! **DiálogoGemini** às ordens!', 'model');
        ui.unlockInput();
        setTimeout(() => updateContextMeter(), 0);
    }

    async function handleNewPrompt(level = 3) {
        const userMessageText = elements.userInput.value.trim();
        if (!userMessageText || isTyping) return;
        const metaPrompts = {
            1: "\n\n[Instrução: Responda de forma curta e direta, em no máximo 3 frases.]",
            2: "\n\n[Instrução: Responda de forma clara e com detalhes médios, em cerca de 5 a 7 frases.]",
            3: ""
        };
        const userMessage = { role: 'user', content: userMessageText, timestamp: new Date().toISOString() };
        const promptForApi = userMessageText + (metaPrompts[level] || metaPrompts[3]);
        ui.hideContinueBtn();
        conversationHistory.messages.push(userMessage);
        displayStaticMessage(userMessage.content, userMessage.role, userMessage.timestamp);
        saveActiveConversation();
        updateContextMeter();
        elements.userInput.value = '';
        elements.userInput.style.height = 'auto';
        ui.lockInput();
        ui.showLoading();
        const apiFormattedHistory = conversationHistory.messages.slice(0, -1).map(msg => ({ role: msg.role, parts: [{ text: msg.content }] }));
        apiFormattedHistory.push({ role: 'user', parts: [{ text: promptForApi }] });
        try {
            const apiKey = localStorage.getItem('geminiApiKey');
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const requestBody = { contents: apiFormattedHistory };
            const now = new Date();
            const formattedDateTime = now.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
            const userSystemPrompt = conversationHistory.systemPrompt || '';
            const finalSystemPrompt = `${userSystemPrompt}\n\n[Instrução Crítica: A data e hora de hoje são EXATAMENTE ${formattedDateTime}. TODAS as suas respostas que envolverem datas devem se basear estritamente nesta informação.]`.trim();
            if (finalSystemPrompt) {
                requestBody.systemInstruction = { parts: [{ text: finalSystemPrompt }] };
            }
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`Erro da API: ${errorBody.error.message || response.statusText}`);
            }
            const data = await response.json();
            const fullResponseText = data.candidates[0].content.parts[0].text;
            const modelMessage = { role: 'model', content: fullResponseText, timestamp: new Date().toISOString() };
            conversationHistory.messages.push(modelMessage);
            saveActiveConversation();
            updateContextMeter();
            cachedChunks = fullResponseText.split(/\n{2,}/g).filter(chunk => chunk.trim() !== '');
            currentChunkIndex = 0;
            charsSinceLastPause = 0;
            ui.hideLoading();
            if (cachedChunks.length > 0) {
                displayChunks();
            } else {
                ui.unlockInput();
            }
        } catch (error) {
            console.error("Erro detalhado:", error);
            displayStaticMessage(`Ocorreu um erro: ${error.message}`, 'model', new Date().toISOString());
            ui.hideLoading();
            ui.unlockInput();
        }
    }

    function rebuildChatFromHistory() { elements.chatWindow.innerHTML = ''; conversationHistory.messages.forEach(message => { const role = message.role === 'model' ? 'model' : 'user'; displayStaticMessage(message.content, role, message.timestamp); }); elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; updateContextMeter(); }
    function displayStaticMessage(text, role, timestamp) { const messageElement = createMessageElement(role, timestamp); messageElement.querySelector('p').innerHTML = marked.parse(text); elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; }
    function createMessageElement(role, timestamp) { const messageElement = document.createElement('div'); const senderClass = role === 'user' ? 'user-message' : 'gemini-message'; messageElement.classList.add('message', senderClass); messageElement.dataset.timestamp = timestamp; const paragraph = document.createElement('p'); messageElement.appendChild(paragraph); if (timestamp) { const deleteBtn = document.createElement('button'); deleteBtn.className = 'delete-message-btn'; deleteBtn.innerHTML = '🗑️'; deleteBtn.dataset.timestamp = timestamp; deleteBtn.title = 'Excluir Mensagem'; messageElement.appendChild(deleteBtn); const timestampEl = document.createElement('div'); timestampEl.className = 'message-timestamp'; const date = new Date(timestamp); const formattedDateTime = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); timestampEl.textContent = formattedDateTime; messageElement.appendChild(timestampEl); } elements.chatWindow.appendChild(messageElement); return messageElement; }
    function typewriter(element, text, onComplete) { isTyping = true; ui.lockInput(); const words = text.split(' '); let i = 0; element.innerHTML = ''; const interval = 300 - typingSpeed; const typingInterval = setInterval(() => { if (i < words.length) { element.innerHTML += words[i] + ' '; elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; i++; } else { clearInterval(typingInterval); isTyping = false; element.innerHTML = marked.parse(text); onComplete(); } }, interval); }
    
    function displayChunks() {
        if (currentChunkIndex >= cachedChunks.length) { ui.unlockInput(); return; }
        const chunk = cachedChunks[currentChunkIndex];
        const timestamp = conversationHistory.messages[conversationHistory.messages.length - 1].timestamp;
        const messageElement = createMessageElement('model', timestamp);
        typewriter(messageElement.querySelector('p'), chunk, () => {
            charsSinceLastPause += chunk.length;
            const hasMoreChunks = currentChunkIndex < cachedChunks.length - 1;
            const CHARACTER_THRESHOLD = 250;
            if (hasMoreChunks && charsSinceLastPause >= CHARACTER_THRESHOLD) {
                ui.showContinueBtn();
                ui.unlockInput();
            } else if (hasMoreChunks) {
                currentChunkIndex++;
                displayChunks();
            } else {
                ui.unlockInput();
            }
        });
    }

    async function runWelcomeTour() {
        const tourSteps = ["👋 Olá! Bem-vindo ao **DiálogoGemini!** Aqui, buscamos dar a você uma experiência confortável e fluente de conversa. (clique Continuar)", "Perceba que a resposta está sendo *apresentada gradualmente*, sendo que esta velocidade pode ser controlada pelo slider **Velocidade** abaixo, deixando a minha escrita mais rápida ou mais lenta.", "Após um determinado tamanho apresentado, aparecerá o botão **Continuar** evitando aquele deslocamento do texto para cima, dificultando a  leitura.", "Esta parada para 'Continuar' permite ao usuário digitar um novo prompt e mude o rumo da conversa, evitando a continuação e o consumo desnecessário de 'tokens'.", "\n\n Para uma melhor qualidade da conversa, é interessante **fornecer seu nome, e designar um nome e um papel para mim**.", "Um primeiro prompt com estes dados ajuda a produzir uma conversa bem melhor. Por exemplo:\n\n\n  *'Olá! Meu nome é **Fulano** e partir de agora, seu nome será **LuzIA**. Aja como uma **experiente chef de cozinha**. Eu preciso de idéias para um jantar muito especial. Para que eu verifique se entendeu estas instruções, já me cumprimente usando seu novo nome e especialidade.'* \n\n Este é um bom modelo de prompt que já testa a si próprio! Se você me der um nome e um papel, isto me ajudará a manter o foco.", " Com a evolução da conversa, você poderá salvá-la. Neste caso, procure incluir no seu título, o personagem e o assunto. Isto ajudará você a localizá-la, podendo reabrir e continuar no futuro. Assim, esta conversa poderá ficar nos seus registros por longo tempo, e evoluindo!  \n\n Estas sugestões são **recomendadas mas não obrigatórias**. Se quiser, poderá conversar anônimamente sem problemas.  Consulte também o 'Assistente' que lhe dará mais informações. *(O **prompt** não é apenas uma simples mensagem, mas também uma **ordem** doque eu devo fazer)*.\n\n Mas vamos lá?   Digite seu prompt."];
        ui.lockInput();
        elements.chatWindow.innerHTML = '';
        for (let i = 0; i < tourSteps.length; i++) {
            const messageElement = createMessageElement('model');
            await new Promise(resolve => typewriter(messageElement.querySelector('p'), tourSteps[i], resolve));
            if (i < tourSteps.length - 1) {
                ui.showContinueBtn();
                await new Promise(resolve => {
                    const continueClickHandler = () => {
                        elements.continueBtn.removeEventListener('click', continueClickHandler);
                        ui.hideContinueBtn();
                        resolve();
                    };
                    addSafeEventListener(elements.continueBtn, 'click', continueClickHandler);
                });
            }
        }
        localStorage.setItem('hasSeenTour', 'true');
        ui.unlockInput();
    }

    function handleContinue() {
        if (isTyping) return;
        ui.hideContinueBtn();
        charsSinceLastPause = 0;
        currentChunkIndex++;
        displayChunks();
    }

    function handleDeleteMessage(timestamp) { if (confirm("Tem certeza de que deseja apagar esta mensagem permanentemente?")) { conversationHistory.messages = conversationHistory.messages.filter(msg => msg.timestamp !== timestamp); const messageElement = document.querySelector(`.message[data-timestamp="${timestamp}"]`); if (messageElement) { messageElement.remove(); } updateContextMeter(); saveActiveConversation(); } }

    // ================================================================
    // 6. FUNÇÕES DE GERENCIAMENTO DE CONVERSA
    // ================================================================

    function updateContextMeter() {
        const meterElement = document.getElementById('context-meter');
        if (!meterElement) { return; }
        const totalChars = conversationHistory.messages.reduce((sum, message) => {
            return sum + (message.content ? message.content.length : 0);
        }, 0);
        const approximateTokens = Math.round(totalChars / 4);
        meterElement.textContent = `Contexto: ~${approximateTokens.toLocaleString('pt-BR')} tokens`;
    }

    function saveConversation() {
        const name = elements.conversationNameInput.value.trim();
        if (!name) { alert("Por favor, dê um nome para a conversa antes de salvar."); return; }
        if (conversationHistory.messages.length === 0) { alert("Não há nada para salvar. Inicie uma conversa primeiro."); return; }
        const savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || [];
        const newConversation = { name: name, history: conversationHistory, timestamp: new Date().toISOString() };
        const updatedConversations = savedConversations.filter(c => c.name !== name);
        updatedConversations.push(newConversation);
        localStorage.setItem('savedConversations', JSON.stringify(updatedConversations));
        localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
        localStorage.removeItem('activeConversationName');
        alert(`Conversa "${name}" salva com sucesso!`);
        elements.conversationNameInput.value = name;
        renderSavedConversations();
    }

    function loadConversation(timestamp) {
        const savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || [];
        const conversationToLoad = savedConversations.find(c => c.timestamp === timestamp);
        if (conversationToLoad) {
            conversationHistory = conversationToLoad.history;
            rebuildChatFromHistory();
            elements.conversationNameInput.value = conversationToLoad.name;
            if (conversationHistory.systemPrompt) {
                elements.systemPromptInput.value = conversationHistory.systemPrompt;
            } else {
                conversationHistory.systemPrompt = elements.systemPromptInput.value;
            }
            localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
            localStorage.removeItem('activeConversationName');
            alert(`Conversa "${conversationToLoad.name}" carregada com sucesso!`);
            elements.toolsSidebar.classList.remove('open');
        }
    }

    function deleteConversation(timestamp) {
        let savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || [];
        const conversationName = savedConversations.find(c => c.timestamp === timestamp)?.name || "esta conversa";
        if (confirm(`Tem certeza que deseja excluir permanentemente "${conversationName}"?`)) {
            const updatedConversations = savedConversations.filter(c => c.timestamp !== timestamp);
            localStorage.setItem('savedConversations', JSON.stringify(updatedConversations));
            renderSavedConversations();
        }
    }

    function renderSavedConversations() {
        const savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || [];
        elements.savedConversationsList.innerHTML = '';
        if (savedConversations.length === 0) {
            elements.savedConversationsList.innerHTML = '<p style="padding: 10px; text-align: center; color: #6c757d;">Nenhuma conversa salva.</p>';
            return;
        }
        savedConversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        savedConversations.forEach(conv => {
            const date = new Date(conv.timestamp);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            const item = document.createElement('div');
            item.className = 'saved-conversation-item';
            item.innerHTML = `<div class="conversation-info"><span class="name">${conv.name}</span><span class="timestamp">${formattedDate}</span></div><div class="conversation-actions"><button class="load-btn" data-timestamp="${conv.timestamp}">Carregar</button><button class="delete-btn" data-timestamp="${conv.timestamp}">Excluir</button></div>`;
            elements.savedConversationsList.appendChild(item);
        });
    }

    async function exportConversationToJson() {
        if (conversationHistory.messages.length === 0) { alert("A conversa está vazia."); return; }
        const jsonString = JSON.stringify(conversationHistory, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const defaultName = `conversa_${new Date().toISOString().split('T')[0]}.json`;
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({ suggestedName: defaultName, types: [{ description: 'Arquivo JSON', accept: { 'application/json': ['.json'] } }] });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            } catch (err) { if (err.name !== 'AbortError') { console.error(err); } else { return; } }
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = defaultName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    async function exportConversationToMarkdown() {
        if (conversationHistory.messages.length === 0) { alert("A conversa está vazia."); return; }
        let markdownContent = `# DiálogoGemini - Conversa\n\n`;
        if (conversationHistory.systemPrompt) { markdownContent += `## Instrução do Assistente (Persona)\n\n> ${conversationHistory.systemPrompt}\n\n---\n\n`; }
        conversationHistory.messages.forEach(message => { const role = message.role === 'user' ? 'Usuário' : 'Assistente'; const date = new Date(message.timestamp); const formattedDateTime = date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); markdownContent += `**${role}** (*${formattedDateTime}*):\n\n${message.content}\n\n---\n\n`; });
        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
        const defaultName = `conversa_${new Date().toISOString().split('T')[0]}.md`;
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({ suggestedName: defaultName, types: [{ description: 'Arquivo Markdown', accept: { 'text/markdown': ['.md'] } }] });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            } catch (err) { if (err.name !== 'AbortError') { console.error(err); } else { return; } }
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = defaultName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function importConversationFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) { return; }
            const fileNameWithoutExt = file.name.endsWith('.json') ? file.name.slice(0, -5) : file.name;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedObject = JSON.parse(e.target.result);
                    if (typeof importedObject !== 'object' || importedObject === null || !Array.isArray(importedObject.messages)) { throw new Error("O arquivo não parece ser um histórico de conversa válido."); }
                    conversationHistory = importedObject;
                    rebuildChatFromHistory();
                    elements.conversationNameInput.value = fileNameWithoutExt;
                    if (conversationHistory.systemPrompt) {
                        elements.systemPromptInput.value = conversationHistory.systemPrompt;
                    } else {
                        conversationHistory.systemPrompt = elements.systemPromptInput.value;
                    }
                    localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
                    localStorage.removeItem('activeConversationName');
                    alert("Conversa importada com sucesso!");
                    elements.toolsSidebar.classList.remove('open');
                } catch (error) { console.error("Erro ao importar o arquivo:", error); alert(`Ocorreu um erro ao ler o arquivo: ${error.message}`); }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function saveApiKey() { const apiKey = elements.apiKeyInput.value.trim(); if (apiKey) { localStorage.setItem('geminiApiKey', apiKey); elements.apiKeyModal.classList.add('hidden'); startNewChat(); } else { alert("Por favor, insira uma chave de API válida."); } }
    
    function setupSpeedControl() { if (!elements.speedSlider) return; const savedSpeed = localStorage.getItem('typingSpeed'); if (savedSpeed) { typingSpeed = parseInt(savedSpeed, 10); elements.speedSlider.value = savedSpeed; } addSafeEventListener(elements.speedSlider, 'input', (e) => { typingSpeed = parseInt(e.target.value, 10); localStorage.setItem('typingSpeed', typingSpeed); }); }
    
    function openProjectAssistant(event) { event.preventDefault(); if (window.GPT_CHAT_IFRAME_FUNCTIONS && typeof window.GPT_CHAT_IFRAME_FUNCTIONS.toogleChat === 'function') { window.GPT_CHAT_IFRAME_FUNCTIONS.toogleChat(); } else { alert('Não foi possível se comunicar com o assistente.'); } }

    // ================================================================
    // 7. LÓGICA DO MODAL DE CONFIRMAÇÃO
    // ================================================================
    const confirmationModal = document.getElementById('confirmation-modal-overlay');
    const modalBtnCancel = document.getElementById('modal-btn-cancel');
    const modalBtnDiscard = document.getElementById('modal-btn-discard');
    const modalBtnSave = document.getElementById('modal-btn-save');
    let pendingAction = null;

    function showConfirmationModal(action) {
        pendingAction = action;
        if (confirmationModal) confirmationModal.classList.remove('hidden');
    }

    function hideConfirmationModal() {
        pendingAction = null;
        if (confirmationModal) confirmationModal.classList.add('hidden');
    }

    // ================================================================
    // 8. LÓGICA DE INICIALIZAÇÃO E EVENT LISTENERS
    // ================================================================

    /**
     * Ponto de entrada principal do aplicativo.
     */
    function initializeApp() {
        // --- ETAPA 1: REGISTRAR TODOS OS EVENTOS ---
        addSafeEventListener(elements.userInput, 'input', () => {
            const hasText = elements.userInput.value.length > 0;
            elements.clearPromptBtn.classList.toggle('hidden', !hasText);
            elements.sendLevel1Btn.disabled = !hasText;
            elements.sendLevel2Btn.disabled = !hasText;
            elements.sendLevel3Btn.disabled = !hasText;
            const textarea = elements.userInput;
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        });
        
        addSafeEventListener(elements.conversationNameInput, 'input', () => {
            if (localStorage.getItem(ACTIVE_CONVERSATION_KEY)) {
                localStorage.setItem('activeConversationName', elements.conversationNameInput.value);
            }
        });

        addSafeEventListener(elements.chatWindow, 'click', (event) => { const target = event.target.closest('.delete-message-btn'); if (target) { const timestamp = target.dataset.timestamp; handleDeleteMessage(timestamp); } });
        addSafeEventListener(elements.userInput, 'keypress', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (isSearchMode) { performSearch(); } else { if (elements.userInput.value.trim().length > 0) { handleNewPrompt(3); } } } });
        addSafeEventListener(elements.sendLevel1Btn, 'click', () => handleNewPrompt(1));
        addSafeEventListener(elements.sendLevel2Btn, 'click', () => handleNewPrompt(2));
        addSafeEventListener(elements.sendLevel3Btn, 'click', () => handleNewPrompt(3));
        addSafeEventListener(elements.saveApiKeyBtn, 'click', saveApiKey);
        addSafeEventListener(elements.changeApiKeyLink, 'click', (e) => { e.preventDefault(); if (elements.apiKeyModal) elements.apiKeyModal.classList.remove('hidden'); });
        addSafeEventListener(elements.newChatLink, 'click', (e) => { e.preventDefault(); if (elements.chatWindow.children.length <= 1 && !localStorage.getItem(ACTIVE_CONVERSATION_KEY)) { startNewChat(); } else { showConfirmationModal(startNewChat); } });
        addSafeEventListener(elements.showTourLink, 'click', (e) => { e.preventDefault(); if (elements.chatWindow.children.length <= 1 && !localStorage.getItem(ACTIVE_CONVERSATION_KEY)) { runWelcomeTour(); } else { showConfirmationModal(runWelcomeTour); } });
        addSafeEventListener(modalBtnCancel, 'click', hideConfirmationModal);
        addSafeEventListener(modalBtnDiscard, 'click', () => { if (typeof pendingAction === 'function') { pendingAction(); } hideConfirmationModal(); });
        addSafeEventListener(modalBtnSave, 'click', () => { saveConversation(); if (typeof pendingAction === 'function') { pendingAction(); } hideConfirmationModal(); });
        addSafeEventListener(elements.continueBtn, 'click', handleContinue);
        addSafeEventListener(elements.openSidebarBtn, 'click', () => { if (elements.toolsSidebar) { renderSavedConversations(); elements.toolsSidebar.classList.add('open'); } });
        addSafeEventListener(elements.closeSidebarBtn, 'click', () => { if (elements.toolsSidebar) { elements.toolsSidebar.classList.remove('open'); } });
        addSafeEventListener(elements.saveConversationBtn, 'click', saveConversation);
        addSafeEventListener(elements.savedConversationsList, 'click', (event) => { const target = event.target; const timestamp = target.getAttribute('data-timestamp'); if (!timestamp) return; if (target.classList.contains('load-btn')) { loadConversation(timestamp); } else if (target.classList.contains('delete-btn')) { deleteConversation(timestamp); } });
        addSafeEventListener(elements.importConversationBtn, 'click', importConversationFromFile);
        addSafeEventListener(elements.exportJsonBtn, 'click', exportConversationToJson);
        addSafeEventListener(elements.exportMdBtn, 'click', exportConversationToMarkdown);
        addSafeEventListener(elements.openAssistantLink, 'click', openProjectAssistant);
        addSafeEventListener(elements.toggleSearchBtn, 'click', toggleSearchMode);
        addSafeEventListener(elements.searchBtn, 'click', performSearch);
        addSafeEventListener(elements.clearSearchBtn, 'click', () => { clearSearch(); elements.userInput.value = ''; });
        addSafeEventListener(elements.analyzeTitleBtn, 'click', () => { callAnalysisAPI("Gere um título curto e conciso para a conversa a seguir.", "Título da Conversa"); });
        addSafeEventListener(elements.analyzeTopicsBtn, 'click', () => { callAnalysisAPI("Liste os principais tópicos da conversa a seguir em formato de bullet points.", "Tópicos Principais"); });
        addSafeEventListener(elements.analyzeSummaryBtn, 'click', () => { callAnalysisAPI("Liste os tópicos da conversa a seguir e adicione uma descrição curta (uma frase) para cada um.", "Resumo dos Tópicos"); });
        addSafeEventListener(elements.analyzeDetailedBtn, 'click', () => { callAnalysisAPI("Gere um resumo detalhado, em parágrafos, conectando as ideias da conversa a seguir.", "Resumo Detalhado"); });
        addSafeEventListener(elements.clearPromptBtn, 'click', () => { elements.userInput.value = ''; elements.clearPromptBtn.classList.add('hidden'); elements.sendLevel1Btn.disabled = true; elements.sendLevel2Btn.disabled = true; elements.sendLevel3Btn.disabled = true; elements.userInput.style.height = 'auto'; elements.userInput.focus(); });
        
        // --- ETAPA 2: CONFIGURAR ESTADOS INICIAIS ---
        setupSystemPrompt();
        setupSpeedControl();

        // --- ETAPA 3: DECIDIR O ESTADO DA CONVERSA ---
        checkApiKey();
    }
    
    function checkApiKey() {
        console.log("Verificando estado inicial...");
        if (localStorage.getItem('geminiApiKey')) {
            const wasLoaded = loadActiveConversation();
            if (!wasLoaded) {
                if (!localStorage.getItem('hasSeenTour')) {
                    runWelcomeTour();
                } else {
                    startNewChat();
                }
            } else {
                ui.unlockInput();
            }
        } else {
            if (elements.apiKeyModal) elements.apiKeyModal.classList.remove('hidden');
        }
    }

    // --- EXECUÇÃO INICIAL ---
    initializeApp();
});
