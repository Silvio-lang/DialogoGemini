document.addEventListener('DOMContentLoaded', () => {
    // --- SELEÇÃO DE ELEMENTOS ---
    const speedSlider = document.getElementById('speed-slider');
    // (O resto dos seletores permanece o mesmo)
    const sendButton = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const chatWindow = document.getElementById('chat-window');
    const apiKeyModal = document.getElementById('api-key-modal');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const changeApiKeyLink = document.getElementById('change-api-key-link');
    const newChatLink = document.getElementById('new-chat-link');
    const loadingIndicator = document.getElementById('loading-indicator');
    const continueBtn = document.getElementById('continue-btn');
    const continueContainer = document.getElementById('continue-container');

    // --- VARIÁVEIS DE ESTADO ---
    let conversationHistory = [];
    let cachedChunks = [];
    let currentChunkIndex = 0;
    let isTyping = false;
    let typingSpeed = 180; // Velocidade padrão

    const ui = {
        showLoading: () => loadingIndicator.classList.remove('hidden'),
        hideLoading: () => loadingIndicator.classList.add('hidden'),
        showContinueBtn: () => continueContainer.classList.remove('hidden'),
        hideContinueBtn: () => continueContainer.classList.add('hidden'),
        lockInput: () => { userInput.disabled = true; sendButton.disabled = true; },
        unlockInput: () => { userInput.disabled = false; sendButton.disabled = false; userInput.focus(); }
    };
    
    // --- LÓGICA DE VELOCIDADE ---
    function setupSpeedControl() {
        const savedSpeed = localStorage.getItem('typingSpeed');
        if (savedSpeed) {
            typingSpeed = parseInt(savedSpeed, 10);
            speedSlider.value = typingSpeed;
        }
        speedSlider.addEventListener('input', (e) => {
            // O valor do slider é invertido para a lógica do intervalo
            // Slider mais à direita (valor maior) = intervalo menor (mais rápido)
            typingSpeed = parseInt(e.target.value, 10);
            localStorage.setItem('typingSpeed', typingSpeed);
        });
    }

    // --- LÓGICA DE EXIBIÇÃO ---
    function typewriter(element, text, onComplete) {
        isTyping = true;
        ui.lockInput();
        const words = text.split(' ');
        let i = 0;
        element.innerHTML = '';

        // Calcula o intervalo real a partir do valor do slider
        // Invertemos a lógica: valor alto no slider = intervalo baixo = rápido
        const interval = 300 - typingSpeed; 

        const typingInterval = setInterval(() => {
            if (i < words.length) {
                element.innerHTML += words[i] + ' ';
                chatWindow.scrollTop = chatWindow.scrollHeight;
                i++;
            } else {
                clearInterval(typingInterval);
                isTyping = false;
                onComplete();
            }
        }, interval);
    }
    
    function displayChunks() {
        if (currentChunkIndex >= cachedChunks.length) { ui.unlockInput(); return; }
        const chunk = cachedChunks[currentChunkIndex];
        const messageElement = createMessageElement('model');
        typewriter(messageElement.querySelector('p'), chunk, () => {
            const CHARACTER_THRESHOLD = 150;
            const hasMoreChunks = currentChunkIndex < cachedChunks.length - 1;
            if (chunk.length < CHARACTER_THRESHOLD && hasMoreChunks) {
                setTimeout(() => { currentChunkIndex++; displayChunks(); }, 500);
            } else if (hasMoreChunks) {
                ui.showContinueBtn();
                ui.unlockInput();
            } else {
                ui.unlockInput();
            }
        });
    }

    // --- LÓGICA DO CHAT (handleNewPrompt, etc. - sem grandes alterações) ---
    async function handleNewPrompt() {
        const userMessageText = userInput.value.trim();
        if (!userMessageText || isTyping) return;
        ui.hideContinueBtn();
        displayMessage(userMessageText, 'user');
        conversationHistory.push({ role: 'user', parts: [{ text: userMessageText }] });
        userInput.value = '';
        ui.lockInput();
        ui.showLoading();
        try {
            const apiKey = localStorage.getItem('geminiApiKey');
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${apiKey}`;
            const requestBody = { contents: conversationHistory, safetySettings: [ { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }] };
            const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
            if (!response.ok) { const errorBody = await response.json(); throw new Error(`Erro da API: ${errorBody.error.message || response.statusText}`); }
            const data = await response.json();
            const fullResponseText = data.candidates[0].content.parts[0].text;
            conversationHistory.push({ role: 'model', parts: [{ text: fullResponseText }] });
            cachedChunks = fullResponseText.split(/\n{2,}/g).filter(chunk => chunk.trim() !== '');
            currentChunkIndex = 0;
            ui.hideLoading();
            if (cachedChunks.length > 0) { displayChunks(); } else { ui.unlockInput(); }
        } catch (error) {
            console.error("Erro detalhado:", error);
            displayMessage(`Ocorreu um erro: ${error.message}`, 'model');
            ui.hideLoading();
            ui.unlockInput();
        }
    }

    function handleContinue() {
        if (isTyping) return;
        ui.hideContinueBtn();
        currentChunkIndex++;
        displayChunks();
    }
    
    function createMessageElement(role) {
        const messageElement = document.createElement('div');
        const senderClass = role === 'user' ? 'user-message' : 'gemini-message';
        messageElement.classList.add('message', senderClass);
        const paragraph = document.createElement('p');
        messageElement.appendChild(paragraph);
        chatWindow.appendChild(messageElement);
        return messageElement;
    }
    
    function displayMessage(text, role) {
        const messageElement = createMessageElement(role);
        messageElement.querySelector('p').innerHTML = marked.parse(text);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
    
    function startNewChat() {
        conversationHistory = [];
        cachedChunks = [];
        currentChunkIndex = 0;
        isTyping = false;
        chatWindow.innerHTML = '';
        displayMessage('Olá! Como posso ajudar hoje?', 'model');
        ui.hideContinueBtn();
        ui.unlockInput();
    }
    
    function checkApiKey() { if (localStorage.getItem('geminiApiKey')) { ui.unlockInput(); startNewChat(); } else { apiKeyModal.classList.remove('hidden'); } }
    function saveApiKey() { const apiKey = apiKeyInput.value.trim(); if (apiKey) { localStorage.setItem('geminiApiKey', apiKey); apiKeyModal.classList.add('hidden'); ui.unlockInput(); startNewChat(); } else { alert("Por favor, insira uma chave de API válida."); } }
    
    // --- EVENT LISTENERS ---
    sendButton.addEventListener('click', handleNewPrompt);
    userInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') handleNewPrompt(); });
    continueBtn.addEventListener('click', handleContinue);
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    changeApiKeyLink.addEventListener('click', (e) => { e.preventDefault(); apiKeyModal.classList.remove('hidden'); });
    newChatLink.addEventListener('click', (e) => { e.preventDefault(); startNewChat(); });

    // --- INICIALIZAÇÃO ---
    setupSpeedControl(); // Configura o slider de velocidade
    checkApiKey();
});