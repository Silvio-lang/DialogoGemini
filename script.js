document.addEventListener('DOMContentLoaded', () => {
    // (O início do script, com a seleção de elementos e variáveis de estado, permanece o mesmo)
    // ...
    const elements = { /* ... */ };
    let conversationHistory = [], cachedChunks = [], currentChunkIndex = 0;
    let isTyping = false, typingSpeed = 180;
    const ui = { /* ... */ };

    // --- FUNÇÕES DE LÓGICA PRINCIPAL (incluindo a CORREÇÃO) ---

    /**
     * NOVO: Limpa e corrige o texto Markdown antes de renderizar.
     * Garante que a formatação de negrito (**texto**) seja mais consistente.
     * @param {string} text - O texto vindo da API.
     * @returns {string} - O texto pronto para ser renderizado.
     */
    function sanitizeMarkdown(text) {
        // Garante que não haja escapes nos asteriscos de negrito
        let sanitizedText = text.replace(/\\\*\\\*/g, '**');
        // Adiciona espaços ao redor de **negrito** se não houver, para melhor renderização.
        // Ex: "texto**negrito**texto" -> "texto **negrito** texto"
        sanitizedText = sanitizedText.replace(/(\S)\*\*(\S)/g, '$1 **$2');
        sanitizedText = sanitizedText.replace(/(\S)\*\*(\S)/g, '$1** $2');
        return sanitizedText;
    }

    // Função de exibição de mensagem ATUALIZADA
    function displayMessage(text, role) {
        const messageElement = createMessageElement(role);
        // CHAMA A NOVA FUNÇÃO DE LIMPEZA ANTES DE RENDERIZAR
        const cleanText = sanitizeMarkdown(text);
        messageElement.querySelector('p').innerHTML = marked.parse(cleanText);
        elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
    }

    // (O resto das funções: typewriter, displayChunks, handleNewPrompt, etc. permanecem as mesmas)
    // ...
    function typewriter(element, text, onComplete) { isTyping = true; ui.lockInput(); const words = text.split(' '); let i = 0; element.innerHTML = ''; const interval = 300 - typingSpeed; const typingInterval = setInterval(() => { const cleanWord = sanitizeMarkdown(words[i] || ''); if (i < words.length) { element.innerHTML += cleanWord + ' '; elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight; i++; } else { clearInterval(typingInterval); isTyping = false; onComplete(); } }, interval); }
    function displayChunks() { if (currentChunkIndex >= cachedChunks.length) { ui.unlockInput(); return; } const chunk = cachedChunks[currentChunkIndex]; const messageElement = createMessageElement('model'); typewriter(messageElement.querySelector('p'), chunk, () => { const CHARACTER_THRESHOLD = 150; const hasMoreChunks = currentChunkIndex < cachedChunks.length - 1; if (chunk.length < CHARACTER_THRESHOLD && hasMoreChunks) { setTimeout(() => { currentChunkIndex++; displayChunks(); }, 500); } else if (hasMoreChunks) { ui.showContinueBtn(); ui.unlockInput(); } else { ui.unlockInput(); } }); }
    async function handleNewPrompt() { const userMessageText = elements.userInput.value.trim(); if (!userMessageText || isTyping) return; ui.hideContinueBtn(); displayMessage(userMessageText, 'user'); conversationHistory.push({ role: 'user', parts: [{ text: userMessageText }] }); elements.userInput.value = ''; ui.lockInput(); ui.showLoading(); try { const apiKey = localStorage.getItem('geminiApiKey'); const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${apiKey}`; const requestBody = { contents: conversationHistory, safetySettings: [ { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" }, { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }] }; const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }); if (!response.ok) { const errorBody = await response.json(); throw new Error(`Erro da API: ${errorBody.error.message || response.statusText}`); } const data = await response.json(); const fullResponseText = data.candidates[0].content.parts[0].text; conversationHistory.push({ role: 'model', parts: [{ text: fullResponseText }] }); cachedChunks = fullResponseText.split(/\n{2,}/g).filter(chunk => chunk.trim() !== ''); currentChunkIndex = 0; ui.hideLoading(); if (cachedChunks.length > 0) { displayChunks(); } else { ui.unlockInput(); } } catch (error) { console.error("Erro detalhado:", error); displayMessage(`Ocorreu um erro: ${error.message}`, 'model'); ui.hideLoading(); ui.unlockInput(); } }
    function handleContinue() { if (isTyping) return; ui.hideContinueBtn(); currentChunkIndex++; displayChunks(); }
    function createMessageElement(role) { const messageElement = document.createElement('div'); const senderClass = role === 'user' ? 'user-message' : 'gemini-message'; messageElement.classList.add('message', senderClass); const paragraph = document.createElement('p'); messageElement.appendChild(paragraph); elements.chatWindow.appendChild(messageElement); return messageElement; }
    function startNewChat() { conversationHistory = []; cachedChunks = []; currentChunkIndex = 0; isTyping = false; elements.chatWindow.innerHTML = ''; displayMessage('Olá! Como posso ajudar hoje?', 'model'); ui.hideContinueBtn(); ui.unlockInput(); }
    function saveApiKey() { const apiKey = elements.apiKeyInput.value.trim(); if (apiKey) { localStorage.setItem('geminiApiKey', apiKey); elements.apiKeyModal.classList.add('hidden'); ui.unlockInput(); startNewChat(); } else { alert("Por favor, insira uma chave de API válida."); } }
    function setupSpeedControl() { const savedSpeed = localStorage.getItem('typingSpeed'); if (savedSpeed) { typingSpeed = parseInt(savedSpeed, 10); elements.speedSlider.value = savedSpeed; } elements.speedSlider.addEventListener('input', (e) => { typingSpeed = parseInt(e.target.value, 10); localStorage.setItem('typingSpeed', typingSpeed); }); }
    function checkApiKey() { if (localStorage.getItem('geminiApiKey')) { ui.unlockInput(); startNewChat(); } else { elements.apiKeyModal.classList.remove('hidden'); } }

    // --- INICIALIZAÇÃO E EVENT LISTENERS ---
    elements.sendButton.addEventListener('click', handleNewPrompt);
    elements.userInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') handleNewPrompt(); });
    elements.continueBtn.addEventListener('click', handleContinue);
    elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
    elements.changeApiKeyLink.addEventListener('click', (e) => { e.preventDefault(); elements.apiKeyModal.classList.remove('hidden'); });
    elements.newChatLink.addEventListener('click', (e) => { e.preventDefault(); startNewChat(); });
    
    setupSpeedControl();
    checkApiKey();
});
