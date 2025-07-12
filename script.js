document.addEventListener('DOMContentLoaded', () => {
    // 1. SELEÇÃO (sem customHelpLink)
    const elements = {
        sendButton: document.getElementById('send-btn'), userInput: document.getElementById('user-input'),
        chatWindow: document.getElementById('chat-window'), apiKeyModal: document.getElementById('api-key-modal'),
        apiKeyInput: document.getElementById('api-key-input'), saveApiKeyBtn: document.getElementById('save-api-key-btn'),
        changeApiKeyLink: document.getElementById('change-api-key-link'), newChatLink: document.getElementById('new-chat-link'),
        loadingIndicator: document.getElementById('loading-indicator'), continueBtn: document.getElementById('continue-btn'),
        continueContainer: document.getElementById('continue-container'), speedSlider: document.getElementById('speed-slider')
    };

    // (O resto do código é exatamente o que já estava funcionando bem)
    let conversationHistory = [], cachedChunks = [], currentChunkIndex = 0;
    let isTyping = false, typingSpeed = 180;
    const ui = { showLoading: () => elements.loadingIndicator.classList.remove('hidden'), hideLoading: () => elements.loadingIndicator.classList.add('hidden'), showContinueBtn: () => elements.continueContainer.classList.remove('hidden'), hideContinueBtn: () => elements.continueContainer.classList.add('hidden'), lockInput: () => { elements.userInput.disabled = true; elements.sendButton.disabled = true; }, unlockInput: () => { elements.userInput.disabled = false; elements.sendButton.disabled = false; elements.userInput.focus(); } };
    function sanitizeMarkdown(text) { return text.replace(/\\\*\\\*/g, '**'); }
    function displayStaticMessage(text, role) { const messageElement = createMessageElement(role); const cleanText = sanitizeMarkdown(text); messageElement.querySelector('p').innerHTML = marked.parse(cleanText); elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; }
    function typewriter(element, text, onComplete) { isTyping = true; ui.lockInput(); const words = text.split(' '); let i = 0; element.innerHTML = ''; const interval = 300 - typingSpeed; const typingInterval = setInterval(() => { if (i < words.length) { element.innerHTML += words[i] + ' '; elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; i++; } else { clearInterval(typingInterval); isTyping = false; element.innerHTML = marked.parse(sanitizeMarkdown(text)); onComplete(); } }, interval); }
    function displayChunks() { if (currentChunkIndex >= cachedChunks.length) { ui.unlockInput(); return; } const chunk = cachedChunks[currentChunkIndex]; const messageElement = createMessageElement('model'); typewriter(messageElement.querySelector('p'), chunk, () => { const CHARACTER_THRESHOLD = 150; const hasMoreChunks = currentChunkIndex < cachedChunks.length - 1; if (chunk.length < CHARACTER_THRESHOLD && hasMoreChunks) { setTimeout(() => { currentChunkIndex++; displayChunks(); }, 500); } else if (hasMoreChunks) { ui.showContinueBtn(); ui.unlockInput(); } else { ui.unlockInput(); } }); }
    async function handleNewPrompt() { const userMessageText = elements.userInput.value.trim(); if (!userMessageText || isTyping) return; ui.hideContinueBtn(); displayStaticMessage(userMessageText, 'user'); conversationHistory.push({ role: 'user', parts: [{ text: userMessageText }] }); elements.userInput.value = ''; ui.lockInput(); ui.showLoading(); try { const apiKey = localStorage.getItem('geminiApiKey'); const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${apiKey}`; const requestBody = { contents: conversationHistory, safetySettings: [ { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }] }; const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }); if (!response.ok) { const errorBody = await response.json(); throw new Error(`Erro da API: ${errorBody.error.message || response.statusText}`); } const data = await response.json(); const fullResponseText = data.candidates[0].content.parts[0].text; conversationHistory.push({ role: 'model', parts: [{ text: fullResponseText }] }); cachedChunks = fullResponseText.split(/\n{2,}/g).filter(chunk => chunk.trim() !== ''); currentChunkIndex = 0; ui.hideLoading(); if (cachedChunks.length > 0) { displayChunks(); } else { ui.unlockInput(); } } catch (error) { console.error("Erro detalhado:", error); displayStaticMessage(`Ocorreu um erro: ${error.message}`, 'model'); ui.hideLoading(); ui.unlockInput(); } }
    function handleContinue() { if (isTyping) return; ui.hideContinueBtn(); currentChunkIndex++; displayChunks(); }
    function createMessageElement(role) { const messageElement = document.createElement('div'); const senderClass = role === 'user' ? 'user-message' : 'gemini-message'; messageElement.classList.add('message', senderClass); const paragraph = document.createElement('p'); messageElement.appendChild(paragraph); elements.chatWindow.appendChild(messageElement); return messageElement; }
    function startNewChat() { conversationHistory = []; cachedChunks = []; currentChunkIndex = 0; isTyping = false; elements.chatWindow.innerHTML = ''; displayStaticMessage('Olá! Como posso ajudar hoje?', 'model'); ui.hideContinueBtn(); ui.unlockInput(); }
    function saveApiKey() { const apiKey = elements.apiKeyInput.value.trim(); if (apiKey) { localStorage.setItem('geminiApiKey', apiKey); elements.apiKeyModal.classList.add('hidden'); ui.unlockInput(); startNewChat(); } else { alert("Por favor, insira uma chave de API válida."); } }
    function setupSpeedControl() { const savedSpeed = localStorage.getItem('typingSpeed'); if (savedSpeed) { typingSpeed = parseInt(savedSpeed, 10); elements.speedSlider.value = savedSpeed; } if (elements.speedSlider) { elements.speedSlider.addEventListener('input', (e) => { typingSpeed = parseInt(e.target.value, 10); localStorage.setItem('typingSpeed', typingSpeed); }); } }
    function checkApiKey() { if (localStorage.getItem('geminiApiKey')) { ui.unlockInput(); startNewChat(); } else { elements.apiKeyModal.classList.remove('hidden'); } }

    function addSafeEventListener(element, event, handler) { if (element) { element.addEventListener(event, handler); } else { console.warn(`Elemento não encontrado para o evento: ${event}. O ouvinte não foi anexado.`); } }
    addSafeEventListener(elements.sendButton, 'click', handleNewPrompt);
    addSafeEventListener(elements.userInput, 'keypress', (event) => { if (event.key === 'Enter') handleNewPrompt(); });
    addSafeEventListener(elements.continueBtn, 'click', handleContinue);
    addSafeEventListener(elements.saveApiKeyBtn, 'click', saveApiKey);
    addSafeEventListener(elements.changeApiKeyLink, 'click', (e) => { e.preventDefault(); elements.apiKeyModal.classList.remove('hidden'); });
    addSafeEventListener(elements.newChatLink, 'click', (e) => { e.preventDefault(); startNewChat(); });
    
    setupSpeedControl();
    checkApiKey();
});