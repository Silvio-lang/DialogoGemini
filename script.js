document.addEventListener('DOMContentLoaded', () => {
    // ================================================================
    // 1. SELEÇÃO DE ELEMENTOS
    // ================================================================
    const elements = {
        systemPromptInput: document.getElementById('system-prompt-input'),
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
        continueTypingBtn: document.getElementById('continue-typing-btn'), 
        startNewPromptBtn: document.getElementById('start-new-prompt-btn'),
        openSidebarBtn: document.getElementById('open-sidebar-btn'),
        closeSidebarBtn: document.getElementById('close-sidebar-btn'),
        toolsSidebar: document.getElementById('tools-sidebar'),
        conversationNameInput: document.getElementById('conversation-name-input'),
        saveConversationBtn: document.getElementById('save-conversation-btn'),
        savedConversationsList: document.getElementById('saved-conversations-list'),
        importConversationBtn: document.getElementById('import-conversation-btn'),
        exportJsonBtn: document.getElementById('export-json-btn'),
        exportMdBtn: document.getElementById('export-md-btn'),
        analyzeTitleBtn: document.getElementById('analyze-title-btn'),
        analyzeTopicsBtn: document.getElementById('analyze-topics-btn'),
        analyzeSummaryBtn: document.getElementById('analyze-summary-btn'),
        analyzeDetailedBtn: document.getElementById('analyze-detailed-btn'),
        toggleSearchBtn: document.getElementById('toggle-search-btn'),
        searchBtn: document.getElementById('search-btn'),
        clearSearchBtn: document.getElementById('clear-search-btn'),
        clearPromptBtn: document.getElementById('clear-prompt-btn'),
        attachFileBtn: document.getElementById('attach-file-btn'),
        imageInput: document.getElementById('image-input'),
        imagePreviewContainer: document.getElementById('image-preview-container'),
        imagePreview: document.getElementById('image-preview'),
        removeImageBtn: document.getElementById('remove-image-btn'),
        responseModeToggle: document.getElementById('response-mode-toggle'), 
        speedSliderSidebar: document.getElementById('speed-slider-sidebar'), 
        contextMeter: document.getElementById('context-meter') 
    };

    // ================================================================
    // 2. VARIÁVEIS DE ESTADO
    // ================================================================
    let conversationHistory = { messages: [], systemPrompt: null };
    let isTyping = false;
    let typingSpeed = 180;
    let isSearchMode = false;
    let stopTypingFlag = false;
    let currentFileName = null;
    
    // TEMPOS PADRÃO
    const DEFAULT_PARAGRAPH_PAUSE = 2000; // Seu pedido de 2000 mSeg (2 segundos)
    const DEFAULT_TYPING_SPEED = 180; 

    let responseQueue = [];
    let currentMessageContentContainer = null;
    let currentParagraphSentences = [];
    let currentSentenceIndex = 0;
    let sentenceCountSincePause = 0;
    let tokensDisplayedSincePause = 0; 
    const TOKEN_LIMIT_PER_CHUNK = 200; 
    
    let attachedImage = { base64: null, mimeType: null };

    const ACTIVE_CONVERSATION_KEY = 'activeConversation';
    const DEFAULT_SYSTEM_PROMPT = "Você é o DiálogoGemini, um assistente de IA prestativo e amigável. Responda em português do Brasil.";
    
    // ================================================================
    // 3. FUNÇÕES DE UI
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
// Localize a função ui.unlockInput:
unlockInput: () => {
            if (elements.userInput) elements.userInput.disabled = false;
            const hasText = elements.userInput.value.length > 0;
            const hasImage = attachedImage.base64 !== null;
            if (elements.sendLevel1Btn) elements.sendLevel1Btn.disabled = !hasText && !hasImage;
            if (elements.sendLevel2Btn) elements.sendLevel2Btn.disabled = !hasText && !hasImage;
            if (elements.sendLevel3Btn) elements.sendLevel3Btn.disabled = !hasText && !hasImage;
             
             // ESTA LINHA DEVE SER REMOVIDA:
            // if (elements.userInput) elements.userInput.focus();
        }
    };

    // ================================================================
    // 4. FUNÇÕES DE PERSISTÊNCIA
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
                    
                    if (conversationHistory.messages.length === 1 && conversationHistory.messages[0]?.role === 'model') {
                        localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
                        localStorage.removeItem('activeConversationName');
                        conversationHistory = { messages: [], systemPrompt: loadedHistory.systemPrompt || null };
                        return false; 
                    }
                    
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
                console.error("Erro ao carregar a conversa ativa:", error);
                localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
                return false;
            }
        }
        return false;
    }

    // ================================================================
    // 5. ARQUITETURA DE EXIBIÇÃO DE TEXTO
    // ================================================================
    function startResponseDisplay(fullResponseText) {
        responseQueue = fullResponseText.split(/\n{2,}/g).filter(chunk => chunk.trim() !== '');
        currentMessageContentContainer = null;
        currentParagraphSentences = [];
        currentSentenceIndex = 0;
        sentenceCountSincePause = 0;
        tokensDisplayedSincePause = 0; 
        stopTypingFlag = false;
        processNextQueueItem();
    }

    async function processNextQueueItem() {
        if (stopTypingFlag) { console.log("Exibição interrompida."); ui.unlockInput(); return; }
        const isSingleBlockMode = elements.responseModeToggle ? elements.responseModeToggle.checked : false;

        if (currentSentenceIndex >= currentParagraphSentences.length) {
            if (responseQueue.length === 0) { 
                ui.unlockInput(); 
                elements.continueBtn.classList.add('hidden');
                elements.continueTypingBtn.classList.remove('hidden');
                ui.showContinueBtn();
                return; 
            }
            if (currentMessageContentContainer !== null && !isSingleBlockMode) { 
                await new Promise(resolve => setTimeout(resolve, DEFAULT_PARAGRAPH_PAUSE)); 
            }
            const nextParagraph = responseQueue.shift();
            currentParagraphSentences = nextParagraph.match(/[^.!?]+[.!?]*\s*|[^.!?]+$/g) || [];
            currentSentenceIndex = 0;
            if (currentMessageContentContainer === null) {
                const timestamp = conversationHistory.messages[conversationHistory.messages.length - 1].timestamp;
                const messageDiv = createMessageElement('model', timestamp);
                currentMessageContentContainer = messageDiv.querySelector('.message-content-container');
            }
            const newParagraphElement = document.createElement('p');
            currentMessageContentContainer.appendChild(newParagraphElement);
        }
        const sentenceToWrite = currentParagraphSentences[currentSentenceIndex];
        const targetParagraph = currentMessageContentContainer.lastElementChild;
        await typeSentence(sentenceToWrite, targetParagraph);
    }
    
    async function typeSentence(sentence, targetParagraph) {
        isTyping = true;
        ui.lockInput();
        for (const word of sentence.trim().split(' ')) {
            if (stopTypingFlag) {
                const remainingWords = sentence.trim().substring(targetParagraph.textContent.length).trim();
                targetParagraph.textContent += remainingWords;
                targetParagraph.innerHTML = marked.parse(targetParagraph.textContent.trim());
                
                renderRestOfQueueStatically();
                
                ui.unlockInput();
                return; 
            }
            targetParagraph.textContent += word + ' ';
            elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
            const interval = 300 - typingSpeed;
            await new Promise(resolve => setTimeout(resolve, interval));
            
            tokensDisplayedSincePause += 4; 
        }
        const renderedSentences = (targetParagraph.textContent).trim();
        targetParagraph.innerHTML = marked.parse(renderedSentences);
        elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
        currentSentenceIndex++;
        sentenceCountSincePause++;
        
        const isSingleBlockMode = elements.responseModeToggle ? elements.responseModeToggle.checked : false;
        
        const lastUserPrompt = conversationHistory.messages.slice().reverse().find(msg => msg.role === 'user');
        const level = lastUserPrompt ? lastUserPrompt.level : 3;

        const tokenLimitReached = tokensDisplayedSincePause >= TOKEN_LIMIT_PER_CHUNK; 
        
        if (tokenLimitReached && (level === 3) && !isSingleBlockMode) { 
            isTyping = false;
// CÓDIGO DO MARCADOR DE PAUSA
            const targetParagraph = currentMessageContentContainer.lastElementChild;
            const pauseMarker = document.createElement('span');
            pauseMarker.textContent = ' ◼︎ '; // Adiciona o bloco separador
            pauseMarker.style.fontWeight = '900';
            pauseMarker.style.color = '#000000'; // Estava aqui
            targetParagraph.appendChild(pauseMarker);
// FIM DO CÓDIGO DO MARCADOR
            ui.showContinueBtn();
            elements.continueBtn.classList.remove('hidden'); 
            elements.continueTypingBtn.classList.remove('hidden'); 
            ui.unlockInput(); 
        } else {
            isTyping = false;
            processNextQueueItem();
        }
    }

    function renderRestOfQueueStatically() {
        const contentContainer = currentMessageContentContainer;
        if (!contentContainer) return;
        
        const targetParagraph = contentContainer.lastElementChild;
        if (currentSentenceIndex < currentParagraphSentences.length) {
            const remainingSentenceText = currentParagraphSentences.slice(currentSentenceIndex).join('');
            targetParagraph.textContent += remainingSentenceText;
        }
        const parsedRemainingText = marked.parse(targetParagraph.textContent.trim());
        targetParagraph.innerHTML = parsedRemainingText;

        const remainingText = responseQueue.map(p => `<p>${marked.parse(p)}</p>`).join('');
        contentContainer.innerHTML += remainingText;
        
        responseQueue = [];
        stopTypingFlag = true;
        elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
    }

function handleContinue() {
        // CORREÇÃO: Força a remoção do foco para não abrir o teclado no celular.
        elements.userInput.blur();
        
        ui.hideContinueBtn();
        elements.continueBtn.classList.add('hidden');
        elements.continueTypingBtn.classList.add('hidden');
        
        sentenceCountSincePause = 0;
        tokensDisplayedSincePause = 0;
        
        if (currentMessageContentContainer && currentParagraphSentences.length > 0) {
            const targetParagraph = currentMessageContentContainer.lastElementChild;
            const remainingText = targetParagraph.textContent.trim();
            targetParagraph.innerHTML = marked.parse(remainingText);
        }
        
        processNextQueueItem();
    }

function handleStartNewPrompt() {
        stopTypingFlag = true;
        ui.hideContinueBtn();
        elements.continueBtn.classList.add('hidden'); 
        elements.continueTypingBtn.classList.add('hidden'); 
        
        ui.unlockInput();
        // Não chamamos focus() aqui para evitar teclado indesejado no celular.
    }
    // ================================================================
    // 6. FUNÇÕES PRINCIPAIS E DE LÓGICA
    // ================================================================
    function addSafeEventListener(element, event, handler) { if (element) { element.addEventListener(event, handler); } }

async function handleNewPrompt(level = 3) {
    elements.userInput.blur();
    if (isTyping) {
        stopTypingFlag = true;
        await new Promise(resolve => setTimeout(resolve, Math.max(300 - typingSpeed, 50))); 
    }

    const userMessageText = elements.userInput.value.trim();

    let promptPrefix = "";
    switch (level) {
        case 1:
            promptPrefix = "Responda objetivamente, de forma curta e direta: "; 
            break;
        case 2:
            promptPrefix = "Se for possível, responda em no máximo 2 parágrafos, de forma concisa: ";
            break;
        case 3:
        default:
            promptPrefix = "";
            break;
    }

    let contentToSendToAPI = userMessageText;
    if (promptPrefix) { contentToSendToAPI = promptPrefix + userMessageText; }
    if (promptPrefix && !userMessageText) { contentToSendToAPI = promptPrefix; }

    if (!userMessageText && !attachedImage.base64) return;

    ui.hideContinueBtn();
    elements.continueBtn.classList.add('hidden'); 
    elements.continueTypingBtn.classList.add('hidden'); 

    let displayUserContent = userMessageText;
    let feedbackPrefix = "";
    switch (level) {
        case 1:
            feedbackPrefix = "  **Objetivamente:** ";
            break;
        case 2:
            feedbackPrefix = "  **2 parágrafos:** ";
            break;
    }

    if (feedbackPrefix && userMessageText) {
        displayUserContent = feedbackPrefix + userMessageText;
    } else if (feedbackPrefix && !userMessageText) {
        displayUserContent = feedbackPrefix + "[Imagem anexada]";
    } else if (!userMessageText && attachedImage.base64) {
        displayUserContent = "[Imagem anexada]";
    }

    const userMessage = { role: 'user', content: displayUserContent, timestamp: new Date().toISOString(), level: level }; 
    conversationHistory.messages.push(userMessage);
    displayStaticMessage(userMessage.content, userMessage.role, userMessage.timestamp);

    saveActiveConversation();
    updateContextMeter();
    elements.userInput.value = '';
    elements.userInput.style.height = 'auto';
    ui.lockInput();
    ui.showLoading();

    try {
        const apiKey = localStorage.getItem('geminiApiKey');
        const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

        const messageParts = [];
        if (contentToSendToAPI) {
            messageParts.push({ text: contentToSendToAPI });
        }
        if (attachedImage.base64) {
            messageParts.push({
                inline_data: {
                    mime_type: attachedImage.mimeType,
                    data: attachedImage.base64
                }
            });
        }

        const now = new Date();
        const formattedDateTime = now.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
        const userSystemPrompt = conversationHistory.systemPrompt || '';
        const finalSystemPrompt = `${userSystemPrompt}\n\n[Instrução Crítica: A data e hora de hoje são EXATAMENTE ${formattedDateTime}.]`.trim();

        const apiFormattedHistory = conversationHistory.messages.slice(0, -1).map(msg => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.content.replace(/  \*\*(Objetivamente|2 parágrafos):(?:\s*\*\/)?\s\*\*/g, '').replace(/\[Imagem anexada\]/g, '').trim() }]
        }));

        let finalUserPromptParts = messageParts;
        if (apiFormattedHistory.length === 0 && finalSystemPrompt) {
            const systemPart = { text: `${finalSystemPrompt}\n\n---\n\n` };
            finalUserPromptParts = [systemPart, ...messageParts];
        }
        apiFormattedHistory.push({ role: 'user', parts: finalUserPromptParts });

        let generationConfig = {};
        switch (level) {
            case 1: 
                generationConfig = { maxOutputTokens: 50, temperature: 0.2, topP: 0.8 }; break;
            case 2:
                generationConfig = { maxOutputTokens: 200, temperature: 0.5, topP: 0.9 }; break;
            case 3:
            default:
                generationConfig = { maxOutputTokens: 2048, temperature: 0.7, topP: 1.0 }; break;
        }

        const requestBody = { contents: apiFormattedHistory, generationConfig: generationConfig };
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });

        document.getElementById('remove-image-btn').click();

        if (!response.ok) {
            let errorDetail = response.statusText;
            try {
                const errorBody = await response.json();
                errorDetail = errorBody.error.message || response.statusText;
            } catch (e) {}
            throw new Error(`Erro da API (${response.status}): ${errorDetail}`);
        }
        
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
            throw new Error("Resposta da API não contém texto de candidato válido.");
        }
        
        let fullResponseText = data.candidates[0].content.parts[0].text;

        const modelMessage = { role: 'model', content: fullResponseText, timestamp: new Date().toISOString() };
        conversationHistory.messages.push(modelMessage);
        saveActiveConversation();
        updateContextMeter();
        ui.hideLoading();
        startResponseDisplay(fullResponseText);

    } catch (error) {
        console.error("Erro detalhado:", error);
        displayStaticMessage(`Ocorreu um erro: ${error.message}`, 'model', new Date().toISOString());
        ui.hideLoading();
        ui.unlockInput();
    }
}
    async function callAnalysisAPI(instruction, analysisType) {
        if (conversationHistory.messages.length === 0) { alert("Não há conversa para analisar."); return; }
        if (isTyping) { alert("Aguarde a resposta atual terminar."); return; }
        if (elements.toolsSidebar) { elements.toolsSidebar.classList.remove('open'); }
        ui.lockInput();
        ui.showLoading();
        const historyText = conversationHistory.messages
            .map(msg => `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}`)
            .join('\n\n---\n\n');
        const fullAnalysisPrompt = `${instruction}\n\n"""\n${historyText}\n"""`;
        const analysisUserMessage = { role: 'user', content: `[Análise Solicitada: ${analysisType}]`, timestamp: new Date().toISOString() };
        conversationHistory.messages.push(analysisUserMessage);
        displayStaticMessage(analysisUserMessage.content, analysisUserMessage.role, analysisUserMessage.timestamp);
        saveActiveConversation();
        updateContextMeter();
        try {
            const apiKey = localStorage.getItem('geminiApiKey');
            const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
            const requestBody = { contents: [{ role: 'user', parts: [{ text: fullAnalysisPrompt }] }] };
            const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`Erro da API: ${errorBody.error.message || response.statusText}`);
            }
            const data = await response.json();
            let fullResponseText = data.candidates[0].content.parts[0].text;
            const modelMessage = { role: 'model', content: fullResponseText, timestamp: new Date().toISOString() };
            conversationHistory.messages.push(modelMessage);
            saveActiveConversation();
            updateContextMeter();
            ui.hideLoading();
            startResponseDisplay(fullResponseText);
        } catch (error) {
            console.error("Erro na análise:", error);
            displayStaticMessage(`Ocorreu um erro ao analisar: ${error.message}`, 'model', new Date().toISOString());
            ui.hideLoading();
            ui.unlockInput();
        }
    }

    function startNewChat() {
        stopTypingFlag = true;
        currentFileName = null;
        conversationHistory = { messages: [], systemPrompt: null }; 
        const globalSystemPrompt = localStorage.getItem('systemPrompt') || DEFAULT_SYSTEM_PROMPT;
        elements.systemPromptInput.value = globalSystemPrompt;
        conversationHistory.systemPrompt = globalSystemPrompt;
        elements.chatWindow.innerHTML = '';
        elements.conversationNameInput.value = '';
        ui.hideContinueBtn();
        elements.continueBtn.classList.add('hidden');
        elements.continueTypingBtn.classList.add('hidden');
        localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
        localStorage.removeItem('activeConversationName');
        
        const welcomeMessage = { role: 'model', content: 'Olá! **DiálogoGemini** às ordens!', timestamp: new Date().toISOString() };
        conversationHistory.messages.push(welcomeMessage);
        displayStaticMessage(welcomeMessage.content, welcomeMessage.role, welcomeMessage.timestamp);
        
        ui.unlockInput();
        // REMOVIDO o foco automático aqui para evitar teclado no celular
        setTimeout(() => updateContextMeter(), 0);
    }
    
    function performSearch() {
        const searchTerm = elements.userInput.value.trim();
        rebuildChatFromHistory();
        if (!searchTerm) return;
        const chatMessages = elements.chatWindow.querySelectorAll('.message .message-content-container');
        chatMessages.forEach(container => {
            container.querySelectorAll('p').forEach(p => {
                p.innerHTML = p.innerHTML.replace(new RegExp(searchTerm, 'gi'), (match) => `<mark>${match}</mark>`);
            });
        });
    }

    function clearSearch() { rebuildChatFromHistory(); }

    function toggleSearchMode() {
        elements.userInput.blur();
        isSearchMode = !isSearchMode;
        elements.searchBtn.classList.toggle('hidden', !isSearchMode);
        elements.clearSearchBtn.classList.toggle('hidden', !isSearchMode);
        elements.toggleSearchBtn.classList.toggle('active', isSearchMode);
        if (isSearchMode) {
            elements.userInput.placeholder = "Localizar na conversa...";
            elements.clearPromptBtn.classList.add('hidden');
        } else {
            elements.userInput.placeholder = "Digite sua mensagem ou anexe uma imagem...";
            clearSearch();
        }
        // Chamada de foco mantida aqui pois o modo busca/entrada DEVE focar o input
        elements.userInput.focus(); 
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

    function rebuildChatFromHistory() {
        elements.chatWindow.innerHTML = '';
        conversationHistory.messages.forEach(message => {
            displayStaticMessage(message.content, message.role, message.timestamp);
        });
        elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
        updateContextMeter();
    }
    
    function displayStaticMessage(text, role, timestamp) {
        const messageElement = createMessageElement(role, timestamp);
        const contentContainer = messageElement.querySelector('.message-content-container');
        const paragraphs = text.split(/\n{2,}/g).filter(p => p.trim() !== '');
        contentContainer.innerHTML = paragraphs.map(pText => `<p>${marked.parse(pText)}</p>`).join('');
        elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
    }
    
    function createMessageElement(role, timestamp) {
        const messageElement = document.createElement('div');
        const senderClass = role === 'user' ? 'user-message' : 'gemini-message';
        messageElement.classList.add('message', senderClass);
        if (timestamp) { messageElement.dataset.timestamp = timestamp; }
        const contentContainer = document.createElement('div');
        contentContainer.className = 'message-content-container';
        messageElement.appendChild(contentContainer);
        if (timestamp) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-message-btn';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.dataset.timestamp = timestamp;
            deleteBtn.title = 'Excluir Mensagem';
            messageElement.appendChild(deleteBtn);
            const timestampEl = document.createElement('div');
            timestampEl.className = 'message-timestamp';
            const date = new Date(timestamp);
            const formattedDateTime = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            timestampEl.textContent = formattedDateTime;
            messageElement.appendChild(timestampEl);
        }
        elements.chatWindow.appendChild(messageElement);
        return messageElement;
    }
    
    function handleDeleteMessage(timestamp) {
        if (confirm("Tem certeza?")) {
            conversationHistory.messages = conversationHistory.messages.filter(msg => msg.timestamp !== timestamp);
            const messageElement = document.querySelector(`.message[data-timestamp="${timestamp}"]`);
            if (messageElement) { messageElement.remove(); }
            updateContextMeter();
            saveActiveConversation();
        }
    }
    
    // ================================================================
    // 7. FUNÇÕES DE GERENCIAMENTO DE CONVERSA
    // ================================================================
    function updateContextMeter() {
        if (!elements.contextMeter) { return; }
        const totalChars = conversationHistory.messages.reduce((sum, message) => sum + (message.content ? message.content.length : 0), 0);
        let approximateTokens = Math.round(totalChars / 4);
        approximateTokens = Math.floor(approximateTokens / 10) * 10;
        elements.contextMeter.textContent = `Contexto: ~${approximateTokens.toLocaleString('pt-BR')} tokens`;
    }

    function saveConversation() {
        const name = elements.conversationNameInput.value.trim();
        if (!name) { alert("Por favor, dê um nome para a conversa."); return; }
        if (conversationHistory.messages.length === 0) { alert("Não há nada para salvar."); return; }
        
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
        stopTypingFlag = true;
        currentFileName = null;
        const savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || [];
        const conversationToLoad = savedConversations.find(c => c.timestamp === timestamp);
        
        if (conversationToLoad) {
            // 1. ATUALIZA O ESTADO GLOBAL
            conversationHistory = conversationToLoad.history;
            
            // 2. RECUPERA O SYSTEM PROMPT SALVO
            if (conversationHistory.systemPrompt) {
                elements.systemPromptInput.value = conversationHistory.systemPrompt;
            } else {
                conversationHistory.systemPrompt = elements.systemPromptInput.value;
            }

            // 3. LIMPA A TELA E RENDERIZA O NOVO HISTÓRICO
            // Atrasamos a reconstrução para dar tempo ao Marked.js carregar.
            setTimeout(() => {
                rebuildChatFromHistory(); 
                alert(`Conversa "${conversationToLoad.name}" carregada.`);
                elements.toolsSidebar.classList.remove('open');
                // Colocamos o foco aqui para que o teclado apareça após a tela carregar no celular
                ui.unlockInput(); 
            }, 400); // Um pequeno atraso de 50ms resolve o problema da CDN.
            
            // 4. ATUALIZA NOME E ARMAZENAMENTO
            elements.conversationNameInput.value = conversationToLoad.name;
            localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
            localStorage.removeItem('activeConversationName');
        }
    }

    function deleteConversation(timestamp) {
        let savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || [];
        const conversationName = savedConversations.find(c => c.timestamp === timestamp)?.name || "esta conversa";
        if (confirm(`Tem certeza que deseja excluir "${conversationName}"?`)) {
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
            const formattedDate = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const item = document.createElement('div');
            item.className = 'saved-conversation-item';
            item.innerHTML = `<div class="conversation-info"><span class="name">${conv.name}</span><span class="timestamp">${formattedDate}</span></div><div class="conversation-actions"><button class="load-btn" data-timestamp="${conv.timestamp}">Carregar</button><button class="delete-btn" data-timestamp="${conv.timestamp}">Excluir</button></div>`;
            elements.savedConversationsList.appendChild(item);
        });
    }

    async function exportConversationToJson() {
        if (conversationHistory.messages.length === 0) { alert("A conversa está vazia."); return; }
        const jsonString = JSON.stringify(conversationHistory, null, 2);
        const defaultName = `conversa_${new Date().toISOString().split('T')[0]}.json`;
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({ suggestedName: defaultName, types: [{ description: 'Arquivo JSON', accept: { 'application/json': ['.json'] } }] });
                const writable = await handle.createWritable();
                await writable.write(new Blob([jsonString], { type: 'application/json' }));
                await writable.close();
            } catch (err) { if (err.name !== 'AbortError') console.error(err); }
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([jsonString], { type: 'application/json' }));
            link.download = defaultName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    async function exportConversationToMarkdown() {
        if (conversationHistory.messages.length === 0) { alert("A conversa está vazia."); return; }
        let markdownContent = `# DiálogoGemini - Conversa\n\n`;
        if (conversationHistory.systemPrompt) { markdownContent += `## Persona\n\n> ${conversationHistory.systemPrompt}\n\n---\n\n`; }
        conversationHistory.messages.forEach(message => {
            const role = message.role === 'user' ? 'Usuário' : 'Assistente';
            const date = new Date(message.timestamp);
            const formattedDateTime = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            markdownContent += `**${role}** (*${formattedDateTime}*):\n\n${message.content}\n\n---\n\n`;
        });
        const defaultName = `conversa_${new Date().toISOString().split('T')[0]}.md`;
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({ suggestedName: defaultName, types: [{ description: 'Arquivo Markdown', accept: { 'text/markdown': ['.md'] } }] });
                const writable = await handle.createWritable();
                await writable.write(new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' }));
                await writable.close();
            } catch (err) { if (err.name !== 'AbortError') console.error(err); }
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' }));
            link.download = defaultName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    function importConversationFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            stopTypingFlag = true;
            const file = event.target.files[0];
            if (!file) return;
            currentFileName = file.name;
            const fileNameWithoutExt = file.name.endsWith('.json') ? file.name.slice(0, -5) : file.name;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedObject = JSON.parse(e.target.result);
                    if (typeof importedObject !== 'object' || !Array.isArray(importedObject.messages)) { throw new Error("Arquivo inválido."); }
                    conversationHistory = importedObject;
                    rebuildChatFromHistory();
                    elements.conversationNameInput.value = fileNameWithoutExt;
                    if (conversationHistory.systemPrompt) { elements.systemPromptInput.value = conversationHistory.systemPrompt; }
                    else { elements.systemPromptInput.value = DEFAULT_SYSTEM_PROMPT; } 
                    localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
                    localStorage.removeItem('activeConversationName');
                    alert("Conversa importada com sucesso!");
                    elements.toolsSidebar.classList.remove('open');
                    ui.unlockInput();
                } catch (error) {
                    currentFileName = null;
                    console.error("Erro ao importar:", error);
                    alert(`Erro ao ler o arquivo: ${error.message}`);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // CORREÇÃO FINAL: Combina preventDefault com setTimeout(0)
    function saveApiKey(event) {
        event.preventDefault(); // IMPEDE O RECARREGAMENTO E O LOOP DO MODAL
        
        const apiKey = elements.apiKeyInput.value.trim();
        if (apiKey) {
            localStorage.setItem('geminiApiKey', apiKey);
            localStorage.removeItem('hasSeenTour'); 

            // 1. FECHA O MODAL IMEDIATAMENTE
            if (elements.apiKeyModal) elements.apiKeyModal.classList.add('hidden');
            
            // 2. AGENDA O INÍCIO DO CHAT para 0ms depois
            setTimeout(startNewChat, 0); 
            
        } else {
            alert("Por favor, insira uma chave de API válida.");
        }
    }
    
    function setupSpeedControl() {
        if (!elements.speedSliderSidebar) return;
        const savedSpeed = localStorage.getItem('typingSpeed');
        if (savedSpeed) {
            typingSpeed = parseInt(savedSpeed, 10);
            elements.speedSliderSidebar.value = savedSpeed;
        }
        addSafeEventListener(elements.speedSliderSidebar, 'input', (e) => {
            typingSpeed = parseInt(e.target.value, 10);
            localStorage.setItem('typingSpeed', typingSpeed);
        });
        
        if (elements.responseModeToggle) {
            const savedSingleBlock = localStorage.getItem('singleBlockMode');
            elements.responseModeToggle.checked = savedSingleBlock === 'true';
        }
        addSafeEventListener(elements.responseModeToggle, 'change', (e) => {
             localStorage.setItem('singleBlockMode', e.target.checked);
        });
    }

    // ================================================================
    // 8. LÓGICA DO MODAL DE CONFIRMAÇÃO
    // ================================================================
    
    const confirmationModal = document.getElementById('confirmation-modal-overlay');
    const modalBtnCancel = document.getElementById('modal-btn-cancel');
    const modalBtnDiscard = document.getElementById('modal-btn-discard');
    const modalBtnSave = document.getElementById('modal-btn-save');
    let pendingAction = null;
    
    function showConfirmationModal(action) {
        if (!confirmationModal) { 
            if (typeof action === 'function') { action(); }
            return;
        }
        if (conversationHistory.messages.length <= 1 && !localStorage.getItem(ACTIVE_CONVERSATION_KEY)) {
            if (typeof action === 'function') { action(); }
            hideConfirmationModal(); 
            return;
        }
        pendingAction = action;
        if (confirmationModal) confirmationModal.classList.remove('hidden');
    }
    function hideConfirmationModal() {
        pendingAction = null;
        if (confirmationModal) confirmationModal.classList.add('hidden');
    }

    // ================================================================
    // 9. LÓGICA DE INICIALIZAÇÃO E EVENT LISTENERS
    // ================================================================
    function initializeApp() {
        addSafeEventListener(elements.userInput, 'input', () => {
            const hasText = elements.userInput.value.length > 0;
            elements.clearPromptBtn.classList.toggle('hidden', !hasText);
            const hasImage = attachedImage.base64 !== null;
            elements.sendLevel1Btn.disabled = !hasText && !hasImage;
            elements.sendLevel2Btn.disabled = !hasText && !hasImage;
            elements.sendLevel3Btn.disabled = !hasText && !hasImage;
            
            elements.userInput.style.height = 'auto';
            elements.userInput.style.height = `${elements.userInput.scrollHeight}px`;
        });
        
        addSafeEventListener(elements.conversationNameInput, 'input', () => {
            if (localStorage.getItem(ACTIVE_CONVERSATION_KEY)) {
                localStorage.setItem('activeConversationName', elements.conversationNameInput.value);
            }
        });
        addSafeEventListener(elements.chatWindow, 'click', (event) => {
            const target = event.target.closest('.delete-message-btn');
            if (target) {
                const timestamp = target.dataset.timestamp;
                handleDeleteMessage(timestamp);
            }
        });
        addSafeEventListener(elements.userInput, 'keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (isSearchMode) {
                    performSearch();
                } else {
                    if (elements.userInput.value.trim().length > 0 || attachedImage.base64 !== null) {
                        handleNewPrompt(3);
                    }
                }
            }
        });
        addSafeEventListener(elements.sendLevel1Btn, 'click', () => handleNewPrompt(1));
        addSafeEventListener(elements.sendLevel2Btn, 'click', () => handleNewPrompt(2));
        addSafeEventListener(elements.sendLevel3Btn, 'click', () => handleNewPrompt(3));
        
        // CORREÇÃO: Passa o 'event' para a função
        addSafeEventListener(elements.saveApiKeyBtn, 'click', (event) => {
            saveApiKey(event);
        });
        
        addSafeEventListener(elements.changeApiKeyLink, 'click', (e) => {
            e.preventDefault();
            if (elements.apiKeyModal) elements.apiKeyModal.classList.remove('hidden');
        });
        
        addSafeEventListener(elements.newChatLink, 'click', (e) => {
            e.preventDefault();
            showConfirmationModal(startNewChat);
        });

        addSafeEventListener(modalBtnCancel, 'click', hideConfirmationModal);
        addSafeEventListener(modalBtnDiscard, 'click', () => {
            if (typeof pendingAction === 'function') { pendingAction(); }
            hideConfirmationModal();
        });
        addSafeEventListener(modalBtnSave, 'click', () => {
            saveConversation();
            if (typeof pendingAction === 'function') { pendingAction(); }
            hideConfirmationModal();
        });
        
        addSafeEventListener(elements.continueBtn, 'click', handleContinue); 
        addSafeEventListener(elements.continueTypingBtn, 'click', handleStartNewPrompt); 
        
        addSafeEventListener(elements.openSidebarBtn, 'click', () => {
            if (elements.toolsSidebar) {
                renderSavedConversations();
                elements.toolsSidebar.classList.add('open');
            }
        });
        addSafeEventListener(elements.closeSidebarBtn, 'click', () => {
            if (elements.toolsSidebar) {
                elements.toolsSidebar.classList.remove('open');
            }
        });
        addSafeEventListener(elements.saveConversationBtn, 'click', saveConversation);
        addSafeEventListener(elements.savedConversationsList, 'click', (event) => {
            const target = event.target;
            const timestamp = target.getAttribute('data-timestamp');
            if (!timestamp) return;
            if (target.classList.contains('load-btn')) {
                loadConversation(timestamp);
            } else if (target.classList.contains('delete-btn')) {
                deleteConversation(timestamp);
            }
        });
        addSafeEventListener(elements.importConversationBtn, 'click', importConversationFromFile);
        addSafeEventListener(elements.exportJsonBtn, 'click', exportConversationToJson);
        addSafeEventListener(elements.exportMdBtn, 'click', exportConversationToMarkdown);
        addSafeEventListener(elements.toggleSearchBtn, 'click', toggleSearchMode);
        addSafeEventListener(elements.searchBtn, 'click', performSearch);
        addSafeEventListener(elements.clearSearchBtn, 'click', () => {
            clearSearch();
            elements.userInput.value = '';
        });
        addSafeEventListener(elements.analyzeTitleBtn, 'click', () => { callAnalysisAPI("Gere um título curto.", "Título"); });
        addSafeEventListener(elements.analyzeTopicsBtn, 'click', () => { callAnalysisAPI("Liste os tópicos.", "Tópicos"); });
        addSafeEventListener(elements.analyzeSummaryBtn, 'click', () => { callAnalysisAPI("Resuma os tópicos.", "Resumo"); });
        addSafeEventListener(elements.analyzeDetailedBtn, 'click', () => { callAnalysisAPI("Gere um resumo detalhado.", "Resumo Detalhado"); });
        addSafeEventListener(elements.clearPromptBtn, 'click', () => {
            elements.userInput.value = '';
            elements.clearPromptBtn.classList.add('hidden');
            elements.sendLevel1Btn.disabled = true;
            elements.sendLevel2Btn.disabled = true;
            elements.sendLevel3Btn.disabled = true;
            elements.userInput.style.height = 'auto';
            // Chamada de foco mantida aqui, pois a limpeza implica que o usuário quer começar a digitar.
            elements.userInput.focus(); 
        });
        addSafeEventListener(window, 'beforeunload', saveActiveConversation);

        setupSystemPrompt();
        setupSpeedControl();
        setupImageUpload(); 
        checkApiKey();
    }
    
    function checkApiKey() {
        if (localStorage.getItem('geminiApiKey')) {
            if (elements.apiKeyModal) elements.apiKeyModal.classList.add('hidden');
            
            const wasLoaded = loadActiveConversation();
            if (!wasLoaded) {
                startNewChat(); 
            } else {
                ui.unlockInput();
                // REMOVIDO o foco aqui. O usuário pode ter voltado para a página para continuar lendo.
            }
        } else {
            if (elements.apiKeyModal) elements.apiKeyModal.classList.remove('hidden');
        }
    }

    // ================================================================
    // 10. SETUP IMAGE UPLOAD
    // ================================================================

function setupImageUpload() {
    function resetImageState() {
        attachedImage.base64 = null;
        attachedImage.mimeType = null;
        elements.imageInput.value = ''; 
        elements.imagePreviewContainer.classList.add('hidden');
    }

    addSafeEventListener(elements.attachFileBtn, 'click', () => {
        elements.imageInput.click(); 
    });

    addSafeEventListener(elements.removeImageBtn, 'click', resetImageState);

    addSafeEventListener(elements.imageInput, 'change', (event) => {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) {
            resetImageState();
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            attachedImage.mimeType = file.type;
            attachedImage.base64 = e.target.result.split(',')[1];
            
            elements.imagePreview.src = e.target.result;
            elements.imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });
}
    initializeApp();
});