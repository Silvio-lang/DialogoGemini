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

        // ELEMENTOS DA BUSCA INTELIGENTE
        toggleSearchBtn: document.getElementById('toggle-search-btn'),
        searchBtn: document.getElementById('search-btn'),
        clearSearchBtn: document.getElementById('clear-search-btn'),

        clearPromptBtn: document.getElementById('clear-prompt-btn'), 

    };
    
// ================================================================
//  ADICIONE ESTA LINHA DE DIAGNÓSTICO AQUI
// ================================================================
console.log('TESTE DE ELEMENTO:', document.getElementById('context-meter'));
// ================================================================

    // ================================================================
    // 2. VARIÁVEIS DE ESTADO
    // ================================================================
    let conversationHistory = { messages: [], systemPrompt: null };
    let cachedChunks = [], currentChunkIndex = 0;
    let isTyping = false, typingSpeed = 180;
    let isSearchMode = false; // <<<-- NOVO ESTADO PARA O MODO DE BUSCA

    // ================================================================
    // 3. FUNÇÕES DE UI (INTERFACE DO USUÁRIO)
    // ================================================================
const ui = {
    showLoading: () => { if (elements.loadingIndicator) elements.loadingIndicator.classList.remove('hidden'); },
    hideLoading: () => { if (elements.loadingIndicator) elements.loadingIndicator.classList.add('hidden'); },
    showContinueBtn: () => { if (elements.continueContainer) elements.continueContainer.classList.remove('hidden'); },
    hideContinueBtn: () => { if (elements.continueContainer) elements.continueContainer.classList.add('hidden'); },

    // Bloqueia o input e os botões de envio
    lockInput: () => { 
        if (elements.userInput) elements.userInput.disabled = true; 
        if (elements.sendLevel1Btn) elements.sendLevel1Btn.disabled = true;
        if (elements.sendLevel2Btn) elements.sendLevel2Btn.disabled = true;
        if (elements.sendLevel3Btn) elements.sendLevel3Btn.disabled = true;
    },

    // Desbloqueia o input e habilita os botões de envio se houver texto
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
    // 4. FUNÇÕES PRINCIPAIS E DE BUSCA
    // ================================================================
    function addSafeEventListener(element, event, handler) { if (element) { element.addEventListener(event, handler); } }
    
    // --- NOVAS FUNÇÕES E FUNÇÕES MODIFICADAS PARA A BUSCA ---
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
    isSearchMode = !isSearchMode; // Inverte o modo de busca

    // Esconde/mostra o container dos botões 1,2,3
    elements.sendLevelsContainer.classList.toggle('hidden', isSearchMode);
    
    // Esconde/mostra os botões de busca
    elements.searchBtn.classList.toggle('hidden', !isSearchMode);
    elements.clearSearchBtn.classList.toggle('hidden', !isSearchMode);
    
    // Efeito visual no botão da lupa
    elements.toggleSearchBtn.classList.toggle('active', isSearchMode);

    if (isSearchMode) {
        elements.userInput.placeholder = "Localizar na conversa...";
        // Garante que a vassourinha de limpar prompt não apareça no modo de busca
        elements.clearPromptBtn.classList.add('hidden');
    } else {
        elements.userInput.placeholder = "Digite sua mensagem aqui...";
        clearSearch(); // Limpa as marcações da busca ao sair do modo
    }
}
    // --- FIM DAS FUNÇÕES DE BUSCA ---

// ================================================================
// 5. FUNÇÕES DE ANÁLISE DE CONVERSA (VERSÃO CORRIGIDA)
// ================================================================
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
        
        // Verificação de segurança para garantir que a resposta veio no formato esperado
        if (!response.ok || !data.candidates || !data.candidates[0].content) {
            const errorReason = data?.error?.message || data?.promptFeedback?.blockReason || 'A API não retornou um resultado válido.';
            throw new Error(errorReason);
        }
   
        // 1. Extrai o texto da resposta da API
        const resultText = data.candidates[0].content.parts[0].text;
        const fullAnalysisContent = `**Análise: ${analysisTitle}**\n\n${resultText}`;

        // 2. Cria o objeto de mensagem para a análise
        const analysisMessage = {
            role: 'model',
            content: fullAnalysisContent,
            timestamp: new Date().toISOString()
        };

        // 3. Adiciona a análise ao histórico
        conversationHistory.messages.push(analysisMessage);
        
        // 4. Exibe na tela
        displayStaticMessage(analysisMessage.content, 'model', analysisMessage.timestamp);
        
        // 5. Atualiza o medidor de tokens
        updateContextMeter();
        // --- FIM DO TRECHO CORRIGIDO ---

    } catch (error) {
        console.error(`Erro na análise (${analysisTitle}):`, error);
        displayStaticMessage(`**Erro na Análise**\n\nOcorreu um erro: ${error.message}`, 'model');
    } finally {
        ui.hideLoading();
        ui.unlockInput();
    }
}

    function setupSystemPrompt() { const savedSystemPrompt = localStorage.getItem('systemPrompt'); if (savedSystemPrompt) { elements.systemPromptInput.value = savedSystemPrompt; conversationHistory.systemPrompt = savedSystemPrompt; } addSafeEventListener(elements.systemPromptInput, 'input', () => { const currentPrompt = elements.systemPromptInput.value; localStorage.setItem('systemPrompt', currentPrompt); conversationHistory.systemPrompt = currentPrompt; }); }
    function startNewChat() { conversationHistory.messages = []; const globalSystemPrompt = localStorage.getItem('systemPrompt') || ''; conversationHistory.systemPrompt = globalSystemPrompt; elements.conversationNameInput.value = ''; elements.systemPromptInput.value = globalSystemPrompt; cachedChunks = []; currentChunkIndex = 0; isTyping = false; ui.hideContinueBtn(); if (isSearchMode) { toggleSearchMode(); } clearSearch(); if (!localStorage.getItem('hasSeenTour')) { runWelcomeTour(); } else { elements.chatWindow.innerHTML = ''; displayStaticMessage('Olá! **DiálogoGemini** às ordens!', 'model'); ui.unlockInput(); } setTimeout(() => updateContextMeter(), 0);}
    
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
    updateContextMeter();
    elements.userInput.value = '';
    elements.userInput.style.height = 'auto';
    ui.lockInput();
    ui.showLoading();

    const apiFormattedHistory = conversationHistory.messages.slice(0, -1).map(msg => ({ role: msg.role, parts: [{ text: msg.content }] }));
    apiFormattedHistory.push({ role: 'user', parts: [{ text: promptForApi }] });

    try {
        // As variáveis são definidas APENAS UMA VEZ, aqui dentro do try
        const apiKey = localStorage.getItem('geminiApiKey');
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const requestBody = { contents: apiFormattedHistory };

        // --- LÓGICA DE CONSCIÊNCIA TEMPORAL ---
        const now = new Date();
        const formattedDateTime = now.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
        const userSystemPrompt = conversationHistory.systemPrompt || '';
        const finalSystemPrompt = `${userSystemPrompt}\n\n[Contexto Adicional: A data e hora atuais são ${formattedDateTime}. Use esta informação para responder a perguntas relacionadas a tempo.]`.trim();
        
        if (finalSystemPrompt) {
            requestBody.systemInstruction = { parts: [{ text: finalSystemPrompt }] };
        }
        // --- FIM DA LÓGICA DE TEMPO ---

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
        
        updateContextMeter();
        cachedChunks = fullResponseText.split(/\n{2,}/g).filter(chunk => chunk.trim() !== '');
        currentChunkIndex = 0;
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

    function rebuildChatFromHistory() { elements.chatWindow.innerHTML = ''; conversationHistory.messages.forEach(message => { const role = message.role === 'model' ? 'gemini' : 'user'; displayStaticMessage(message.content, role, message.timestamp); }); elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; updateContextMeter(); }
    function displayStaticMessage(text, role, timestamp) { const messageElement = createMessageElement(role, timestamp); messageElement.querySelector('p').innerHTML = marked.parse(text); elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; }
    function createMessageElement(role, timestamp) { const messageElement = document.createElement('div'); const senderClass = role === 'user' ? 'user-message' : 'gemini-message'; messageElement.classList.add('message', senderClass); messageElement.dataset.timestamp = timestamp; const paragraph = document.createElement('p'); messageElement.appendChild(paragraph); if (timestamp) { const deleteBtn = document.createElement('button'); deleteBtn.className = 'delete-message-btn'; deleteBtn.innerHTML = '🗑️'; deleteBtn.dataset.timestamp = timestamp; deleteBtn.title = 'Excluir Mensagem'; messageElement.appendChild(deleteBtn); const timestampEl = document.createElement('div'); timestampEl.className = 'message-timestamp'; const date = new Date(timestamp); const formattedDateTime = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); timestampEl.textContent = formattedDateTime; messageElement.appendChild(timestampEl); } elements.chatWindow.appendChild(messageElement); return messageElement; }
    function typewriter(element, text, onComplete) { isTyping = true; ui.lockInput(); const words = text.split(' '); let i = 0; element.innerHTML = ''; const interval = 300 - typingSpeed; const typingInterval = setInterval(() => { if (i < words.length) { element.innerHTML += words[i] + ' '; elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; i++; } else { clearInterval(typingInterval); isTyping = false; element.innerHTML = marked.parse(text); onComplete(); } }, interval); }
    function displayChunks() { if (currentChunkIndex >= cachedChunks.length) { ui.unlockInput(); return; } const chunk = cachedChunks[currentChunkIndex]; const timestamp = conversationHistory.messages[conversationHistory.messages.length - 1].timestamp; const messageElement = createMessageElement('model', timestamp); typewriter(messageElement.querySelector('p'), chunk, () => { const CHARACTER_THRESHOLD = 150; const hasMoreChunks = currentChunkIndex < cachedChunks.length - 1; if (chunk.length < CHARACTER_THRESHOLD && hasMoreChunks) { setTimeout(() => { currentChunkIndex++; displayChunks(); }, 500); } else if (hasMoreChunks) { ui.showContinueBtn(); ui.unlockInput(); } else { ui.unlockInput(); } }); }
async function runWelcomeTour() {
    const tourSteps = [ "👋 Olá! Bem-vindo ao **DiálogoGemini!** Aqui, buscamos dar a você uma experiência confortável e fluente de conversa. (clique Continuar)", "Perceba que a resposta está sendo *apresentada gradualmente*, sendo que esta velocidade pode ser controlada pelo slider **Velocidade** abaixo, deixando a minha escrita mais rápida ou mais lenta.", "Após um determinado tamanho apresentado, aparecerá o botão **Continuar** evitando aquele deslocamento do texto para cima, dificultando a  leitura.", "Esta parada para 'Continuar' permite ao usuário digitar um novo prompt e mude o rumo da conversa, evitando a continuação e o consumo desnecessário de 'tokens'.","\n\n Para uma melhor qualidade da conversa, é interessante **fornecer seu nome, e designar um nome e um papel para mim**.", "Um primeiro prompt com estes dados ajuda a produzir uma conversa bem melhor. Por exemplo:\n\n\n  *'Olá! Meu nome é **Fulano** e partir de agora, seu nome será **LuzIA**. Aja como uma **experiente chef de cozinha**. Eu preciso de idéias para um jantar muito especial. Para que eu verifique se entendeu estas instruções, já me cumprimente usando seu novo nome e especialidade.'* \n\n Este é um bom modelo de prompt que já testa a si próprio! Se você me der um nome e um papel, isto me ajudará a manter o foco."," Com a evolução da conversa, você poderá salvá-la. Neste caso, procure incluir no seu título, o personagem e o assunto. Isto ajudará você a localizá-la, podendo reabrir e continuar no futuro. Assim, esta conversa poderá ficar nos seus registros por longo tempo, e evoluindo!  \n\n Estas sugestões são **recomendadas mas não obrigatórias**. Se quiser, poderá conversar anônimamente sem problemas.  Consulte também o 'Assistente' que lhe dará mais informações. *(O **prompt** não é apenas uma simples mensagem, mas também uma **ordem** doque eu devo fazer)*.\n\n Mas vamos lá?   Digite seu prompt." ];
    
    ui.lockInput();
    elements.chatWindow.innerHTML = '';

    // Loop direto dentro da função async, sem a complexidade extra
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
    function handleContinue() { if (isTyping) return; ui.hideContinueBtn(); currentChunkIndex++; displayChunks(); }
    function handleDeleteMessage(timestamp) { if (confirm("Tem certeza de que deseja apagar esta mensagem permanentemente?")) { conversationHistory.messages = conversationHistory.messages.filter(msg => msg.timestamp !== timestamp); const messageElement = document.querySelector(`.message[data-timestamp="${timestamp}"]`); if (messageElement) { messageElement.remove(); } updateContextMeter(); } }

function updateContextMeter() {
    // Procura pelo elemento TODA VEZ, em vez de usar a variável cacheada
    const meterElement = document.getElementById('context-meter');

    // Se não encontrar o elemento na hora, ele para.
    if (!meterElement) {
        console.error("ERRO CRÍTICO: O elemento #context-meter não foi encontrado no DOM no momento da atualização.");
        return;
    }

    const totalChars = conversationHistory.messages.reduce((sum, message) => {
        return sum + (message.content ? message.content.length : 0);
    }, 0);
    
    const approximateTokens = Math.round(totalChars / 4);

    // Atualiza o texto diretamente no elemento que acabou de encontrar
    meterElement.textContent = `Contexto: ~${approximateTokens.toLocaleString('pt-BR')} tokens`;
}

    function saveConversation() { const name = elements.conversationNameInput.value.trim(); if (!name) { alert("Por favor, dê um nome para a conversa antes de salvar."); return; } if (conversationHistory.messages.length === 0) { alert("Não há nada para salvar. Inicie uma conversa primeiro."); return; } const savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || []; const newConversation = { name: name, history: conversationHistory, timestamp: new Date().toISOString() }; savedConversations.push(newConversation); localStorage.setItem('savedConversations', JSON.stringify(savedConversations)); alert(`Conversa "${name}" salva com sucesso!`); elements.conversationNameInput.value = ''; renderSavedConversations(); }
    function loadConversation(timestamp) { const savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || []; const conversationToLoad = savedConversations.find(c => c.timestamp === timestamp); if (conversationToLoad) { conversationHistory = conversationToLoad.history; rebuildChatFromHistory(); elements.conversationNameInput.value = conversationToLoad.name;  if (conversationHistory.systemPrompt) { elements.systemPromptInput.value = conversationHistory.systemPrompt; } else { conversationHistory.systemPrompt = elements.systemPromptInput.value; } alert(`Conversa "${conversationToLoad.name}" carregada com sucesso!`); elements.toolsSidebar.classList.remove('open'); } }
    function deleteConversation(timestamp) { let savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || []; const conversationName = savedConversations.find(c => c.timestamp === timestamp)?.name || "esta conversa"; if (confirm(`Tem certeza que deseja excluir permanentemente "${conversationName}"?`)) { const updatedConversations = savedConversations.filter(c => c.timestamp !== timestamp); localStorage.setItem('savedConversations', JSON.stringify(updatedConversations)); renderSavedConversations(); } }
    function renderSavedConversations() { const savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || []; elements.savedConversationsList.innerHTML = ''; if (savedConversations.length === 0) { elements.savedConversationsList.innerHTML = '<p style="padding: 10px; text-align: center; color: #6c757d;">Nenhuma conversa salva.</p>'; return; } savedConversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); savedConversations.forEach(conv => { const date = new Date(conv.timestamp); const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`; const item = document.createElement('div'); item.className = 'saved-conversation-item'; item.innerHTML = `<div class="conversation-info"><span class="name">${conv.name}</span><span class="timestamp">${formattedDate}</span></div><div class="conversation-actions"><button class="load-btn" data-timestamp="${conv.timestamp}">Carregar</button><button class="delete-btn" data-timestamp="${conv.timestamp}">Excluir</button></div>`; elements.savedConversationsList.appendChild(item); }); }
    function exportConversationToJson() { if (conversationHistory.messages.length === 0) { alert("A conversa está vazia. Não há nada para exportar."); return; } const defaultName = `conversa_${new Date().toISOString().split('T')[0]}`; const filename = window.prompt("Digite o nome do arquivo para o backup (.json):", defaultName); if (filename === null || filename.trim() === "") { return; } const finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`; const jsonString = JSON.stringify(conversationHistory, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = finalFilename; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); }
    function exportConversationToMarkdown() { if (conversationHistory.messages.length === 0) { alert("A conversa está vazia. Não há nada para exportar."); return; } let markdownContent = `# DiálogoGemini - Conversa\n\n`; if (conversationHistory.systemPrompt) { markdownContent += `## Instrução do Assistente (Persona)\n\n`; markdownContent += `> ${conversationHistory.systemPrompt}\n\n`; markdownContent += `---\n\n`; } conversationHistory.messages.forEach(message => { const role = message.role === 'user' ? 'Usuário' : 'Assistente'; const date = new Date(message.timestamp); const formattedDateTime = date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); markdownContent += `**${role}** (*${formattedDateTime}*):\n\n`; markdownContent += `${message.content}\n\n`; markdownContent += `---\n\n`; }); const defaultName = `conversa_${new Date().toISOString().split('T')[0]}`; const filename = window.prompt("Digite o nome do arquivo de leitura (.md):", defaultName); if (filename === null || filename.trim() === "") { return; } const finalFilename = filename.endsWith('.md') ? filename : `${filename}.md`; const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = finalFilename; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); }
    function importConversationFromFile() { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.onchange = (event) => { const file = event.target.files[0]; if (!file) { return; } const reader = new FileReader(); reader.onload = (e) => { try { const importedObject = JSON.parse(e.target.result); if (typeof importedObject !== 'object' || importedObject === null || !Array.isArray(importedObject.messages)) { throw new Error("O arquivo não parece ser um histórico de conversa válido. Estrutura principal não encontrada."); } conversationHistory = importedObject; rebuildChatFromHistory(); if (conversationHistory.systemPrompt) { elements.systemPromptInput.value = conversationHistory.systemPrompt; } else { conversationHistory.systemPrompt = elements.systemPromptInput.value; } alert("Conversa importada com sucesso!"); elements.toolsSidebar.classList.remove('open'); } catch (error) { console.error("Erro ao importar o arquivo:", error); alert(`Ocorreu um erro ao ler o arquivo: ${error.message}`); } }; reader.readAsText(file); }; input.click(); }
    function saveApiKey() { const apiKey = elements.apiKeyInput.value.trim(); if (apiKey) { localStorage.setItem('geminiApiKey', apiKey); elements.apiKeyModal.classList.add('hidden'); startNewChat(); } else { alert("Por favor, insira uma chave de API válida."); } }
    function setupSpeedControl() { if (!elements.speedSlider) return; const savedSpeed = localStorage.getItem('typingSpeed'); if (savedSpeed) { typingSpeed = parseInt(savedSpeed, 10); elements.speedSlider.value = savedSpeed; } addSafeEventListener(elements.speedSlider, 'input', (e) => { typingSpeed = parseInt(e.target.value, 10); localStorage.setItem('typingSpeed', typingSpeed); }); }
    function checkApiKey() { if (localStorage.getItem('geminiApiKey')) { startNewChat(); } else { if (elements.apiKeyModal) elements.apiKeyModal.classList.remove('hidden'); } }
    function openProjectAssistant(event) { event.preventDefault(); if (window.GPT_CHAT_IFRAME_FUNCTIONS && typeof window.GPT_CHAT_IFRAME_FUNCTIONS.toogleChat === 'function') { window.GPT_CHAT_IFRAME_FUNCTIONS.toogleChat(); } else { alert('Não foi possível se comunicar com o assistente no momento.'); console.error('API do Assistente de Projeto (GPT_CHAT_IFRAME_FUNCTIONS) não foi encontrada.'); } }

    // ================================================================
    // 8. REGISTRO DE EVENTOS (EVENT LISTENERS)
    // ================================================================
    addSafeEventListener(elements.chatWindow, 'click', (event) => { const target = event.target.closest('.delete-message-btn'); if (target) { const timestamp = target.dataset.timestamp; handleDeleteMessage(timestamp); } });
    
    // --- LISTENER DO ENTER MODIFICADO ---
addSafeEventListener(elements.userInput, 'keypress', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (isSearchMode) {
            performSearch();
        } else {
            if (elements.userInput.value.trim().length > 0) {
                handleNewPrompt(3); // Enter envia a versão completa
            }
        }
    }
});

    addSafeEventListener(elements.sendLevel1Btn, 'click', () => handleNewPrompt(1));
    addSafeEventListener(elements.sendLevel2Btn, 'click', () => handleNewPrompt(2));
    addSafeEventListener(elements.sendLevel3Btn, 'click', () => handleNewPrompt(3));

    addSafeEventListener(elements.saveApiKeyBtn, 'click', saveApiKey);
    addSafeEventListener(elements.changeApiKeyLink, 'click', (e) => { e.preventDefault(); if (elements.apiKeyModal) elements.apiKeyModal.classList.remove('hidden'); });
    addSafeEventListener(elements.newChatLink, 'click', (e) => { e.preventDefault(); startNewChat(); });
    addSafeEventListener(elements.showTourLink, 'click', (e) => { e.preventDefault(); runWelcomeTour(); });
    addSafeEventListener(elements.continueBtn, 'click', handleContinue);
    addSafeEventListener(elements.openSidebarBtn, 'click', () => { if (elements.toolsSidebar) { renderSavedConversations(); elements.toolsSidebar.classList.add('open'); } });
    addSafeEventListener(elements.closeSidebarBtn, 'click', () => { if (elements.toolsSidebar) { elements.toolsSidebar.classList.remove('open'); } });
    addSafeEventListener(elements.saveConversationBtn, 'click', saveConversation);
    addSafeEventListener(elements.savedConversationsList, 'click', (event) => { const target = event.target; const timestamp = target.getAttribute('data-timestamp'); if (!timestamp) return; if (target.classList.contains('load-btn')) { loadConversation(timestamp); } else if (target.classList.contains('delete-btn')) { deleteConversation(timestamp); } });
    addSafeEventListener(elements.importConversationBtn, 'click', importConversationFromFile);
    addSafeEventListener(elements.exportJsonBtn, 'click', exportConversationToJson);
    addSafeEventListener(elements.exportMdBtn, 'click', exportConversationToMarkdown);
    addSafeEventListener(elements.openAssistantLink, 'click', openProjectAssistant);

    // --- NOVOS LISTENERS DA BUSCA INTELIGENTE ---
    addSafeEventListener(elements.toggleSearchBtn, 'click', toggleSearchMode);
    addSafeEventListener(elements.searchBtn, 'click', performSearch);
    addSafeEventListener(elements.clearSearchBtn, 'click', () => { clearSearch(); elements.userInput.value = ''; });

// --- LISTENERS DO ANALISADOR DE CONVERSA ---
addSafeEventListener(elements.analyzeTitleBtn, 'click', () => { callAnalysisAPI("Gere um título curto e conciso para a conversa a seguir.", "Título da Conversa"); });
addSafeEventListener(elements.analyzeTopicsBtn, 'click', () => { callAnalysisAPI("Liste os principais tópicos da conversa a seguir em formato de bullet points.", "Tópicos Principais");});
addSafeEventListener(elements.analyzeSummaryBtn, 'click', () => { callAnalysisAPI("Liste os tópicos da conversa a seguir e adicione uma descrição curta (uma frase) para cada um.", "Resumo dos Tópicos"); });
addSafeEventListener(elements.analyzeDetailedBtn, 'click', () => { callAnalysisAPI("Gere um resumo detalhado, em parágrafos, conectando as ideias da conversa a seguir.", "Resumo Detalhado"); });

// ================================================================
//  LISTENERS DE INTERAÇÃO COM O CAMPO DE PROMPT
// ================================================================

// AÇÃO DE LIMPAR O PROMPT AO CLICAR NA VASSOURA
addSafeEventListener(elements.clearPromptBtn, 'click', () => {
    elements.userInput.value = '';                 // 1. Limpa o texto do campo
    elements.clearPromptBtn.classList.add('hidden'); // 2. Esconde a vassourinha
    
    // 3. Desabilita os botões de envio, pois o campo está vazio
    elements.sendLevel1Btn.disabled = true;
    elements.sendLevel2Btn.disabled = true;
    elements.sendLevel3Btn.disabled = true;

    // 4. Reseta a altura do campo de texto
    elements.userInput.style.height = 'auto';

    // 5. Devolve o foco ao campo
    elements.userInput.focus();
});

// CONTROLA TUDO O QUE ACONTECE QUANDO O USUÁRIO DIGITA
addSafeEventListener(elements.userInput, 'input', () => {
    // Verifica se há texto no campo
    const hasText = elements.userInput.value.length > 0;
    
    // 1. Mostra ou esconde a vassourinha
    elements.clearPromptBtn.classList.toggle('hidden', !hasText);

    // 2. Habilita ou desabilita os botões de envio
    elements.sendLevel1Btn.disabled = !hasText;
    elements.sendLevel2Btn.disabled = !hasText;
    elements.sendLevel3Btn.disabled = !hasText;

    // 3. Controla o auto-crescimento do campo de texto
    const textarea = elements.userInput;
    textarea.style.height = 'auto'; // Reseta a altura para o mínimo
    textarea.style.height = `${textarea.scrollHeight}px`; // Ajusta para a altura do conteúdo
});
    // ================================================================
    // 9. EXECUÇÃO INICIAL
    // ================================================================
    setupSystemPrompt();
    setupSpeedControl();
    checkApiKey();
});
