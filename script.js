document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        sendButton: document.getElementById('send-btn'), userInput: document.getElementById('user-input'),
        chatWindow: document.getElementById('chat-window'), apiKeyModal: document.getElementById('api-key-modal'),
        apiKeyInput: document.getElementById('api-key-input'), saveApiKeyBtn: document.getElementById('save-api-key-btn'),
        changeApiKeyLink: document.getElementById('change-api-key-link'), newChatLink: document.getElementById('new-chat-link'),
        loadingIndicator: document.getElementById('loading-indicator'), continueBtn: document.getElementById('continue-btn'),
        continueContainer: document.getElementById('continue-container'), speedSlider: document.getElementById('speed-slider'),
        showTourLink: document.getElementById('show-tour-link')
    };

    let conversationHistory = [], cachedChunks = [], currentChunkIndex = 0;
    let isTyping = false, typingSpeed = 180;

    const ui = {
        showLoading: () => { if (elements.loadingIndicator) elements.loadingIndicator.classList.remove('hidden'); },
        hideLoading: () => { if (elements.loadingIndicator) elements.loadingIndicator.classList.add('hidden'); },
        showContinueBtn: () => { if (elements.continueContainer) elements.continueContainer.classList.remove('hidden'); },
        hideContinueBtn: () => { if (elements.continueContainer) elements.continueContainer.classList.add('hidden'); },
        lockInput: () => { if (elements.userInput) elements.userInput.disabled = true; if (elements.sendButton) elements.sendButton.disabled = true; },
        unlockInput: () => { if (elements.userInput) elements.userInput.disabled = false; if (elements.sendButton) elements.sendButton.disabled = false; if (elements.userInput) elements.userInput.focus(); }
    };

    async function runWelcomeTour() {
        const tourSteps = [ "👋 Olá! Bem-vindo ao DiálogoGemini! Aqui, o mais importante é que você tenha uma experiência de leitura confortável e controlada.", "Note como esta resposta está sendo 'digitada'. Você tem o poder de controlar essa velocidade! Use o slider 'Velocidade' ali embaixo 🔽 para deixar a leitura mais rápida ou mais lenta.", "Perfeito! Para respostas mais longas como esta, eu sempre vou pausar e te mostrar este botão 'Continuar'. Assim, você nunca será interrompido por uma 'parede de texto' correndo na tela.", "Pronto! Agora você domina os controles. Para tornar nossa conversa única, que tal começar me dando um nome e um papel?", "Um bom primeiro prompt nos ajuda a ter uma ótima conversa. Tente algo como:\n\n*'Olá! A partir de agora, seu nome será **Bia**. Aja como uma experiente chef de cozinha. Quero ideias para um jantar especial. Se entendeu, me cumprimente usando seu novo nome.'*\n\nDar um nome e um papel me ajuda a manter o foco. Mais tarde, você poderá salvar nossa conversa e o nome que você me deu ajudará a identificá-la. Ou, se preferir, pode simplesmente fazer sua primeira pergunta. Estou pronto!" ];
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

    function startNewChat() {
        conversationHistory = []; cachedChunks = []; currentChunkIndex = 0; isTyping = false;
        ui.hideContinueBtn();
        if (!localStorage.getItem('hasSeenTour')) {
            runWelcomeTour();
        } else {
            elements.chatWindow.innerHTML = '';
            displayStaticMessage('Olá! Como posso ajudar hoje?', 'model');
            ui.unlockInput();
        }
    }

    function handleContinue() { if (isTyping) return; ui.hideContinueBtn(); currentChunkIndex++; displayChunks(); }
    async function handleNewPrompt() {
        const userMessageText = elements.userInput.value.trim();
        if (!userMessageText || isTyping) return;
        ui.hideContinueBtn(); displayStaticMessage(userMessageText, 'user'); conversationHistory.push({ role: 'user', parts: [{ text: userMessageText }] }); elements.userInput.value = ''; ui.lockInput(); ui.showLoading();
        try {
            const apiKey = localStorage.getItem('geminiApiKey'); const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${apiKey}`; const requestBody = { contents: conversationHistory, safetySettings: [ { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }] }; const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
            if (!response.ok) { const errorBody = await response.json(); throw new Error(`Erro da API: ${errorBody.error.message || response.statusText}`); }
            const data = await response.json(); const fullResponseText = data.candidates[0].content.parts[0].text; conversationHistory.push({ role: 'model', parts: [{ text: fullResponseText }] }); cachedChunks = fullResponseText.split(/\n{2,}/g).filter(chunk => chunk.trim() !== ''); currentChunkIndex = 0; ui.hideLoading();
            if (cachedChunks.length > 0) { displayChunks(); } else { ui.unlockInput(); }
        } catch (error) { console.error("Erro detalhado:", error); displayStaticMessage(`Ocorreu um erro: ${error.message}`, 'model'); ui.hideLoading(); ui.unlockInput(); }
    }

    function sanitizeMarkdown(text) { return text.replace(/\\\*\\\*/g, '**'); }
    function displayStaticMessage(text, role) { const messageElement = createMessageElement(role); const cleanText = sanitizeMarkdown(text); messageElement.querySelector('p').innerHTML = marked.parse(cleanText); elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; }
    function typewriter(element, text, onComplete) { isTyping = true; ui.lockInput(); const words = text.split(' '); let i = 0; element.innerHTML = ''; const interval = 300 - typingSpeed; const typingInterval = setInterval(() => { if (i < words.length) { element.innerHTML += words[i] + ' '; elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; i++; } else { clearInterval(typingInterval); isTyping = false; element.innerHTML = marked.parse(sanitizeMarkdown(text)); onComplete(); } }, interval); }
    function displayChunks() { if (currentChunkIndex >= cachedChunks.length) { ui.unlockInput(); return; } const chunk = cachedChunks[currentChunkIndex]; const messageElement = createMessageElement('model'); typewriter(messageElement.querySelector('p'), chunk, () => { const CHARACTER_THRESHOLD = 150; const hasMoreChunks = currentChunkIndex < cachedChunks.length - 1; if (chunk.length < CHARACTER_THRESHOLD && hasMoreChunks) { setTimeout(() => { currentChunkIndex++; displayChunks(); }, 500); } else if (hasMoreChunks) { ui.showContinueBtn(); ui.unlockInput(); } else { ui.unlockInput(); } }); }
    function createMessageElement(role) { const messageElement = document.createElement('div'); const senderClass = role === 'user' ? 'user-message' : 'gemini-message'; messageElement.classList.add('message', senderClass); const paragraph = document.createElement('p'); messageElement.appendChild(paragraph); elements.chatWindow.appendChild(messageElement); return messageElement; }
    function saveApiKey() { const apiKey = elements.apiKeyInput.value.trim(); if (apiKey) { localStorage.setItem('geminiApiKey', apiKey); elements.apiKeyModal.classList.add('hidden'); startNewChat(); } else { alert("Por favor, insira uma chave de API válida."); } }
    
    function setupSpeedControl() {
        if (!elements.speedSlider) return; // Verificação de segurança
        const savedSpeed = localStorage.getItem('typingSpeed');
        if (savedSpeed) {
            typingSpeed = parseInt(savedSpeed, 10);
            elements.speedSlider.value = savedSpeed;
        }
        addSafeEventListener(elements.speedSlider, 'input', (e) => { typingSpeed = parseInt(e.target.value, 10); localStorage.setItem('typingSpeed', typingSpeed); });
    }

    function checkApiKey() {
        if (localStorage.getItem('geminiApiKey')) {
            startNewChat();
        } else {
            if (elements.apiKeyModal) elements.apiKeyModal.classList.remove('hidden');
        }
    }

    function addSafeEventListener(element, event, handler) { if (element) { element.addEventListener(event, handler); } }
    
    addSafeEventListener(elements.sendButton, 'click', handleNewPrompt);
    addSafeEventListener(elements.userInput, 'keypress', (event) => { if (event.key === 'Enter') handleNewPrompt(); });
    addSafeEventListener(elements.saveApiKeyBtn, 'click', saveApiKey);
    addSafeEventListener(elements.changeApiKeyLink, 'click', (e) => { e.preventDefault(); if (elements.apiKeyModal) elements.apiKeyModal.classList.remove('hidden'); });
    addSafeEventListener(elements.newChatLink, 'click', (e) => { e.preventDefault(); startNewChat(); });
    addSafeEventListener(elements.showTourLink, 'click', (e) => { e.preventDefault(); runWelcomeTour(); });
    addSafeEventListener(elements.continueBtn, 'click', handleContinue);
    
    setupSpeedControl();
    checkApiKey();
});