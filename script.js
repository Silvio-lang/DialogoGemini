document.addEventListener('DOMContentLoaded', () => {
    // ================================================================
    // 1. SELEÇÃO DE ELEMENTOS
    // ================================================================
    const elements = {
        sendButton: document.getElementById('send-btn'),
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
        exportConversationBtn: document.getElementById('export-conversation-btn')
    };

    // ================================================================
    // 2. VARIÁVEIS DE ESTADO
    // ================================================================
    
    // MUDANÇA 1: A estrutura de dados principal agora é um objeto
    let conversationHistory = { messages: [], systemPrompt: null };
    
    let cachedChunks = [], currentChunkIndex = 0;
    let isTyping = false, typingSpeed = 180;

    // ... (UI e outras funções auxiliares permanecem as mesmas)
    const ui = {
        showLoading: () => { if (elements.loadingIndicator) elements.loadingIndicator.classList.remove('hidden'); },
        hideLoading: () => { if (elements.loadingIndicator) elements.loadingIndicator.classList.add('hidden'); },
        showContinueBtn: () => { if (elements.continueContainer) elements.continueContainer.classList.remove('hidden'); },
        hideContinueBtn: () => { if (elements.continueContainer) elements.continueContainer.classList.add('hidden'); },
        lockInput: () => { if (elements.userInput) elements.userInput.disabled = true; if (elements.sendButton) elements.sendButton.disabled = true; },
        unlockInput: () => { if (elements.userInput) elements.userInput.disabled = false; if (elements.sendButton) elements.sendButton.disabled = false; if (elements.userInput) elements.userInput.focus(); }
    };
    function addSafeEventListener(element, event, handler) { if (element) { element.addEventListener(event, handler); } }

    // ================================================================
    // 3. LÓGICA PRINCIPAL DO CHAT
    // ================================================================

    // MUDANÇA 2: startNewChat agora reseta para o formato de objeto
    function startNewChat() {
        conversationHistory = { messages: [], systemPrompt: null };
        cachedChunks = []; currentChunkIndex = 0; isTyping = false;
        ui.hideContinueBtn();
        if (!localStorage.getItem('hasSeenTour')) {
            runWelcomeTour();
        } else {
            elements.chatWindow.innerHTML = '';
            displayStaticMessage('Olá! Como posso ajudar hoje?', 'model');
            ui.unlockInput();
        }
    }

    async function handleNewPrompt() {
        const userMessageText = elements.userInput.value.trim();
        if (!userMessageText || isTyping) return;
        ui.hideContinueBtn(); 
        displayStaticMessage(userMessageText, 'user'); 
        
        // MUDANÇA 3: Adiciona a mensagem do usuário no formato {role, content, timestamp}
        conversationHistory.messages.push({ 
            role: 'user', 
            content: userMessageText,
            timestamp: new Date().toISOString()
        });
        
        elements.userInput.value = ''; ui.lockInput(); ui.showLoading();

        // MUDANÇA 4: Transforma o nosso histórico para o formato que a API espera
        const apiFormattedHistory = conversationHistory.messages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }]
        }));

        try {
            const apiKey = localStorage.getItem('geminiApiKey');
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const requestBody = { contents: apiFormattedHistory }; // Envia o histórico formatado
            const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
            
            if (!response.ok) { const errorBody = await response.json(); throw new Error(`Erro da API: ${errorBody.error.message || response.statusText}`); }
            const data = await response.json();
            const fullResponseText = data.candidates[0].content.parts[0].text;
            
            // MUDANÇA 5: Adiciona a resposta da IA no nosso formato interno
            conversationHistory.messages.push({ 
                role: 'model', 
                content: fullResponseText,
                timestamp: new Date().toISOString()
            });

            cachedChunks = fullResponseText.split(/\n{2,}/g).filter(chunk => chunk.trim() !== '');
            currentChunkIndex = 0; ui.hideLoading();
            if (cachedChunks.length > 0) { displayChunks(); } else { ui.unlockInput(); }
        } catch (error) { console.error("Erro detalhado:", error); displayStaticMessage(`Ocorreu um erro: ${error.message}`, 'model'); ui.hideLoading(); ui.unlockInput(); }
    }
    
    // ================================================================
    // 4. FUNÇÕES DE DISPLAY E UI (Com pequenas adaptações)
    // ================================================================

    // MUDANÇA 6: rebuildChatFromHistory agora lê de conversationHistory.messages
    function rebuildChatFromHistory() {
        elements.chatWindow.innerHTML = '';
        conversationHistory.messages.forEach(message => {
            const role = message.role === 'model' ? 'gemini' : 'user';
            displayStaticMessage(message.content, role); // Usa message.content
        });
        elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
    }

    // O resto das funções de display (displayStaticMessage, typewriter, displayChunks, etc.) não precisam de mudanças
    // pois elas recebem o texto como um parâmetro simples.
    // ...
    function displayStaticMessage(text, role) { const messageElement = createMessageElement(role); messageElement.querySelector('p').innerHTML = marked.parse(text); elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; }
    function typewriter(element, text, onComplete) { isTyping = true; ui.lockInput(); const words = text.split(' '); let i = 0; element.innerHTML = ''; const interval = 300 - typingSpeed; const typingInterval = setInterval(() => { if (i < words.length) { element.innerHTML += words[i] + ' '; elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; i++; } else { clearInterval(typingInterval); isTyping = false; element.innerHTML = marked.parse(text); onComplete(); } }, interval); }
    function displayChunks() { if (currentChunkIndex >= cachedChunks.length) { ui.unlockInput(); return; } const chunk = cachedChunks[currentChunkIndex]; const messageElement = createMessageElement('model'); typewriter(messageElement.querySelector('p'), chunk, () => { const CHARACTER_THRESHOLD = 150; const hasMoreChunks = currentChunkIndex < cachedChunks.length - 1; if (chunk.length < CHARACTER_THRESHOLD && hasMoreChunks) { setTimeout(() => { currentChunkIndex++; displayChunks(); }, 500); } else if (hasMoreChunks) { ui.showContinueBtn(); ui.unlockInput(); } else { ui.unlockInput(); } }); }
    function createMessageElement(role) { const messageElement = document.createElement('div'); const senderClass = role === 'user' ? 'user-message' : 'gemini-message'; messageElement.classList.add('message', senderClass); const paragraph = document.createElement('p'); messageElement.appendChild(paragraph); elements.chatWindow.appendChild(messageElement); return messageElement; }
    function runWelcomeTour() { /* ... (sem mudanças) ... */ const tourSteps = [ "👋 Olá! Bem-vindo ao DiálogoGemini! Aqui, o mais importante é que você tenha uma experiência de leitura confortável e controlada.", "Note como esta resposta está sendo 'digitada'. Você tem o poder de controlar essa velocidade! Use o slider 'Velocidade' ali embaixo 🔽 para deixar a leitura mais rápida ou mais lenta.", "Perfeito! Para respostas mais longas como esta, eu sempre vou pausar e te mostrar este botão 'Continuar'. Assim, você nunca será interrompido por uma 'parede de texto' correndo na tela.", "Pronto! Agora você domina os controles. Para tornar nossa conversa única, que tal começar me dando um nome e um papel?", "Um bom primeiro prompt nos ajuda a ter uma ótima conversa. Tente algo como:\n\n*'Olá! A partir de agora, seu nome será **Bia**. Aja como uma experiente chef de cozinha. Quero ideias para um jantar especial. Se entendeu, me cumprimente usando seu novo nome.'*\n\nDar um nome e um papel me ajuda a manter o foco. Mais tarde, você poderá salvar nossa conversa e o nome que você me deu ajudará a identificá-la. Ou, se preferir, pode simplesmente fazer sua primeira pergunta. Estou pronto!" ]; ui.lockInput(); elements.chatWindow.innerHTML = ''; (async function(){ for (let i = 0; i < tourSteps.length; i++) { const messageElement = createMessageElement('model'); await new Promise(resolve => typewriter(messageElement.querySelector('p'), tourSteps[i], resolve)); if (i < tourSteps.length - 1) { ui.showContinueBtn(); await new Promise(resolve => { const continueClickHandler = () => { elements.continueBtn.removeEventListener('click', continueClickHandler); ui.hideContinueBtn(); resolve(); }; addSafeEventListener(elements.continueBtn, 'click', continueClickHandler); }); } } localStorage.setItem('hasSeenTour', 'true'); ui.unlockInput(); })(); }
    function handleContinue() { if (isTyping) return; ui.hideContinueBtn(); currentChunkIndex++; displayChunks(); }
    
    // ================================================================
    // 5. LÓGICA DE GERENCIAMENTO DE CONVERSAS (localStorage e Arquivos)
    // ================================================================
    // Nenhuma mudança é necessária nas funções de save/load/render, pois elas já
    // manipulam o conversationHistory como um todo, e agora ele já está no formato certo.
    // ...
    function saveConversation() { const name = elements.conversationNameInput.value.trim(); if (!name) { alert("Por favor, dê um nome para a conversa antes de salvar."); return; } if (conversationHistory.messages.length === 0) { alert("Não há nada para salvar. Inicie uma conversa primeiro."); return; } const savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || []; const newConversation = { name: name, history: conversationHistory, timestamp: new Date().toISOString() }; savedConversations.push(newConversation); localStorage.setItem('savedConversations', JSON.stringify(savedConversations)); alert(`Conversa "${name}" salva com sucesso!`); elements.conversationNameInput.value = ''; renderSavedConversations(); }
    function loadConversation(timestamp) { const savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || []; const conversationToLoad = savedConversations.find(c => c.timestamp === timestamp); if (conversationToLoad) { conversationHistory = conversationToLoad.history; rebuildChatFromHistory(); alert(`Conversa "${conversationToLoad.name}" carregada com sucesso!`); elements.toolsSidebar.classList.remove('open'); } }
    function deleteConversation(timestamp) { let savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || []; const conversationName = savedConversations.find(c => c.timestamp === timestamp)?.name || "esta conversa"; if (confirm(`Tem certeza que deseja excluir permanentemente "${conversationName}"?`)) { const updatedConversations = savedConversations.filter(c => c.timestamp !== timestamp); localStorage.setItem('savedConversations', JSON.stringify(updatedConversations)); renderSavedConversations(); } }
    function renderSavedConversations() { const savedConversations = JSON.parse(localStorage.getItem('savedConversations')) || []; elements.savedConversationsList.innerHTML = ''; if (savedConversations.length === 0) { elements.savedConversationsList.innerHTML = '<p style="padding: 10px; text-align: center; color: #6c757d;">Nenhuma conversa salva.</p>'; return; } savedConversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); savedConversations.forEach(conv => { const date = new Date(conv.timestamp); const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`; const item = document.createElement('div'); item.className = 'saved-conversation-item'; item.innerHTML = `<div class="conversation-info"><span class="name">${conv.name}</span><span class="timestamp">${formattedDate}</span></div><div class="conversation-actions"><button class="load-btn" data-timestamp="${conv.timestamp}">Carregar</button><button class="delete-btn" data-timestamp="${conv.timestamp}">Excluir</button></div>`; elements.savedConversationsList.appendChild(item); }); }

    // MUDANÇA 7: A função de exportar agora já lida com o formato correto nativamente.
    function exportConversationToFile() {
        if (conversationHistory.messages.length === 0) {
            alert("A conversa está vazia. Não há nada para exportar.");
            return;
        }
        const defaultName = `conversa_${new Date().toISOString().split('T')[0]}`;
        const filename = window.prompt("Digite o nome do arquivo para a exportação:", defaultName);
        if (filename === null || filename.trim() === "") { return; }
        const finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
        const jsonString = JSON.stringify(conversationHistory, null, 2); // Exporta o objeto inteiro
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // MUDANÇA 8: A validação na importação agora checa pela nova estrutura.
    function importConversationFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) { return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedObject = JSON.parse(e.target.result);
                    // Validação robusta para o formato { messages: [...] }
                    if (typeof importedObject !== 'object' || importedObject === null || !Array.isArray(importedObject.messages)) {
                        throw new Error("O arquivo não parece ser um histórico de conversa válido. Estrutura principal não encontrada.");
                    }
                    conversationHistory = importedObject;
                    rebuildChatFromHistory();
                    alert("Conversa importada com sucesso!");
                    elements.toolsSidebar.classList.remove('open');
                } catch (error) {
                    console.error("Erro ao importar o arquivo:", error);
                    alert(`Ocorreu um erro ao ler o arquivo: ${error.message}`);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    // ================================================================
    // 6. INICIALIZAÇÃO E EVENT LISTENERS (sem mudanças aqui)
    // ================================================================
    function saveApiKey() { const apiKey = elements.apiKeyInput.value.trim(); if (apiKey) { localStorage.setItem('geminiApiKey', apiKey); elements.apiKeyModal.classList.add('hidden'); startNewChat(); } else { alert("Por favor, insira uma chave de API válida."); } }
    function setupSpeedControl() { if (!elements.speedSlider) return; const savedSpeed = localStorage.getItem('typingSpeed'); if (savedSpeed) { typingSpeed = parseInt(savedSpeed, 10); elements.speedSlider.value = savedSpeed; } addSafeEventListener(elements.speedSlider, 'input', (e) => { typingSpeed = parseInt(e.target.value, 10); localStorage.setItem('typingSpeed', typingSpeed); }); }
    function checkApiKey() { if (localStorage.getItem('geminiApiKey')) { startNewChat(); } else { if (elements.apiKeyModal) elements.apiKeyModal.classList.remove('hidden'); } }

    addSafeEventListener(elements.sendButton, 'click', handleNewPrompt);
    addSafeEventListener(elements.userInput, 'keypress', (event) => { if (event.key === 'Enter') handleNewPrompt(); });
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
    addSafeEventListener(elements.exportConversationBtn, 'click', exportConversationToFile);

    setupSpeedControl();
    checkApiKey();
});