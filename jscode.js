// PDF Query Assistant - Main Application Logic

class PDFQueryAssistant {
    constructor() {
        this.pdfDocument = null;
        this.extractedText = '';
        this.conversation = [];
        this.settings = {
            apiProvider: 'groq',
            apiKey: '',
            model: 'llama-3.3-70b-versatile',
            maxTokens: 1000,
            temperature: 0.7,
            theme: 'light'
        };
        
        this.apiProviders = {
            groq: {
                name: 'Groq',
                baseUrl: 'https://api.groq.com/openai/v1',
                models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
                keyPlaceholder: 'gsk_...'
            },
            openai: {
                name: 'OpenAI',
                baseUrl: 'https://api.openai.com/v1',
                models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
                keyPlaceholder: 'sk-...'
            },
            github: {
                name: 'GitHub Models',
                baseUrl: 'https://models.inference.ai.azure.com',
                models: ['gpt-4o', 'gpt-4o-mini', 'Phi-3.5-mini-instruct'],
                keyPlaceholder: 'ghp_...'
            }
        };

        this.sampleQuestions = [
            "What is the main topic of this document?",
            "Summarize the key points in 3-4 sentences",
            "What are the main conclusions or recommendations?",
            "Extract any important dates, numbers, or statistics",
            "What are the main sections or chapters?",
            "Who are the key people or organizations mentioned?",
            "What problems does this document address?",
            "Are there any action items or next steps mentioned?"
        ];

        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.updateTheme();
        this.updateModelOptions();
        this.initializeChatState();
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    initializeChatState() {
        // Ensure chat is disabled initially
        document.getElementById('questionInput').disabled = true;
        document.getElementById('sendBtn').disabled = true;
        document.getElementById('sampleQuestions').classList.add('hidden');
    }

    setupEventListeners() {
        // PDF Upload
        const uploadZone = document.getElementById('uploadZone');
        const pdfInput = document.getElementById('pdfInput');
        
        uploadZone.addEventListener('click', () => pdfInput.click());
        uploadZone.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadZone.addEventListener('drop', this.handleDrop.bind(this));
        pdfInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Remove PDF
        document.getElementById('removePdfBtn').addEventListener('click', this.removePDF.bind(this));

        // Chat
        document.getElementById('sendBtn').addEventListener('click', this.sendMessage.bind(this));
        document.getElementById('questionInput').addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.sendMessage();
            }
        });
        document.getElementById('clearChatBtn').addEventListener('click', this.clearChat.bind(this));

        // Sample questions
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('sample-question')) {
                const question = e.target.dataset.question;
                document.getElementById('questionInput').value = question;
            }
        });

        // Settings
        document.getElementById('settingsBtn').addEventListener('click', this.openSettings.bind(this));
        document.getElementById('closeSettingsBtn').addEventListener('click', this.closeSettings.bind(this));
        document.getElementById('modalBackdrop').addEventListener('click', this.closeSettings.bind(this));
        document.getElementById('saveSettingsBtn').addEventListener('click', this.saveSettings.bind(this));
        document.getElementById('exportChatBtn').addEventListener('click', this.exportChat.bind(this));

        // API Provider change
        document.getElementById('apiProvider').addEventListener('change', this.updateModelOptions.bind(this));

        // Range inputs
        document.getElementById('maxTokens').addEventListener('input', (e) => {
            document.getElementById('maxTokensValue').textContent = `${e.target.value} tokens`;
        });
        document.getElementById('temperature').addEventListener('input', (e) => {
            document.getElementById('temperatureValue').textContent = e.target.value;
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', this.toggleTheme.bind(this));
    }

    // File Upload Handlers
    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('uploadZone').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('uploadZone').classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('uploadZone').classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    processFile(file) {
        // Validate file
        if (!file.type.includes('pdf')) {
            this.showError('Please select a PDF file.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            this.showError('File size must be less than 10MB.');
            return;
        }

        this.showPDFInfo(file);
        this.extractTextFromPDF(file);
    }

    showPDFInfo(file) {
        document.getElementById('uploadZone').style.display = 'none';
        document.getElementById('pdfInfo').classList.remove('hidden');
        
        document.getElementById('pdfFileName').textContent = file.name;
        document.getElementById('pdfFileStats').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    }

    async extractTextFromPDF(file) {
        try {
            document.getElementById('extractionProgress').classList.remove('hidden');
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            document.getElementById('pdfFileStats').textContent = `${pdf.numPages} pages • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
            
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n\n';
                
                // Update progress
                const progress = (i / pdf.numPages) * 100;
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `Extracting text... Page ${i} of ${pdf.numPages}`;
            }

            this.extractedText = fullText.trim();
            this.showTextPreview();
            this.enableChat();
            
        } catch (error) {
            console.error('Error extracting PDF text:', error);
            this.showError('Failed to extract text from PDF. Please try a different file.');
        }
    }

    showTextPreview() {
        document.getElementById('extractionProgress').classList.add('hidden');
        document.getElementById('textPreview').classList.remove('hidden');
        document.getElementById('extractionStatus').textContent = 'Ready';
        
        const previewContent = document.getElementById('previewContent');
        const previewText = this.extractedText.length > 2000 
            ? this.extractedText.substring(0, 2000) + '...\n\n[Text truncated for preview]'
            : this.extractedText;
        previewContent.textContent = previewText;
    }

    enableChat() {
        document.getElementById('questionInput').disabled = false;
        document.getElementById('sendBtn').disabled = false;
        document.querySelector('.welcome-message').innerHTML = 
            '<p>PDF loaded successfully! Ask questions about the document content.</p>';
        document.getElementById('sampleQuestions').classList.remove('hidden');
    }

    removePDF() {
        // Reset file input
        document.getElementById('pdfInput').value = '';
        
        // Hide PDF info and preview
        document.getElementById('pdfInfo').classList.add('hidden');
        document.getElementById('textPreview').classList.add('hidden');
        document.getElementById('extractionProgress').classList.add('hidden');
        
        // Show upload zone
        document.getElementById('uploadZone').style.display = 'block';
        
        // Disable chat and clear input
        document.getElementById('questionInput').disabled = true;
        document.getElementById('questionInput').value = '';
        document.getElementById('sendBtn').disabled = true;
        
        // Reset data
        this.extractedText = '';
        this.pdfDocument = null;
        
        // Reset welcome message and hide sample questions
        document.querySelector('.welcome-message').innerHTML = 
            '<p>Upload a PDF document to start asking questions about its content.</p>';
        document.getElementById('sampleQuestions').classList.add('hidden');
    }

    // Chat Functions
    async sendMessage() {
        const input = document.getElementById('questionInput');
        const question = input.value.trim();
        
        if (!question || !this.extractedText) return;
        
        // Disable send button during processing
        const sendBtn = document.getElementById('sendBtn');
        const sendText = sendBtn.querySelector('.send-text');
        const sendLoading = sendBtn.querySelector('.send-loading');
        
        sendBtn.disabled = true;
        sendText.classList.add('hidden');
        sendLoading.classList.remove('hidden');
        
        // Add user message
        this.addMessage('user', question);
        input.value = '';
        
        // Show loading
        const loadingId = this.addLoadingMessage();
        
        try {
            const response = await this.queryLLM(question);
            this.removeLoadingMessage(loadingId);
            this.addMessage('assistant', response);
        } catch (error) {
            this.removeLoadingMessage(loadingId);
            this.addMessage('assistant', 'Sorry, I encountered an error while processing your question. Please check your API settings and try again.');
            console.error('LLM query error:', error);
        } finally {
            // Re-enable send button
            sendBtn.disabled = false;
            sendText.classList.remove('hidden');
            sendLoading.classList.add('hidden');
        }
    }

    addMessage(role, content) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message--${role}`;
        
        const timestamp = new Date().toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="message__bubble">${content}</div>
            <div class="message__timestamp">${timestamp}</div>
            ${role === 'assistant' ? '<div class="message__actions"><button class="message__copy" onclick="app.copyToClipboard(this)">Copy</button></div>' : ''}
        `;
        
        messagesContainer.appendChild(messageDiv);
        this.conversation.push({ role, content, timestamp });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Hide welcome message
        const welcomeMsg = messagesContainer.querySelector('.welcome-message');
        if (welcomeMsg) welcomeMsg.style.display = 'none';
    }

    addLoadingMessage() {
        const messagesContainer = document.getElementById('chatMessages');
        const loadingDiv = document.createElement('div');
        const loadingId = 'loading-' + Date.now();
        loadingDiv.id = loadingId;
        loadingDiv.className = 'message message--assistant';
        
        loadingDiv.innerHTML = `
            <div class="message__bubble message__loading">
                <span>Thinking</span>
                <div class="loading-dots">
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return loadingId;
    }

    removeLoadingMessage(loadingId) {
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    async queryLLM(question) {
        if (!this.settings.apiKey) {
            throw new Error('API key not configured. Please check settings.');
        }

        const provider = this.apiProviders[this.settings.apiProvider];
        const contextChunk = this.getRelevantContext(question);
        
        const prompt = `Based on the following PDF document content, please answer the user's question. If the answer is not directly available in the document, you can use your general knowledge but mention that you're supplementing with additional information.

Document Content:
${contextChunk}

User Question: ${question}

Please provide a clear, helpful answer based primarily on the document content.`;

        const requestBody = {
            model: this.settings.model,
            messages: [
                { role: 'system', content: 'You are a helpful AI assistant that analyzes PDF documents and answers questions about their content.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: parseInt(this.settings.maxTokens),
            temperature: parseFloat(this.settings.temperature)
        };

        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.settings.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API request failed: ${response.status} ${error}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    getRelevantContext(question) {
        // Simple context extraction - in a production app, you might use vector similarity
        const maxLength = 4000; // Leave room for prompt and response
        if (this.extractedText.length <= maxLength) {
            return this.extractedText;
        }
        
        // Try to find relevant sections based on question keywords
        const questionLower = question.toLowerCase();
        const chunks = this.chunkText(this.extractedText, 1000);
        
        // Score chunks based on keyword overlap
        const scoredChunks = chunks.map(chunk => {
            const chunkLower = chunk.toLowerCase();
            const score = questionLower.split(' ').reduce((acc, word) => {
                return acc + (chunkLower.includes(word) ? 1 : 0);
            }, 0);
            return { chunk, score };
        });
        
        // Sort by relevance and take top chunks
        scoredChunks.sort((a, b) => b.score - a.score);
        let context = '';
        let length = 0;
        
        for (const item of scoredChunks) {
            if (length + item.chunk.length > maxLength) break;
            context += item.chunk + '\n\n';
            length += item.chunk.length;
        }
        
        return context || this.extractedText.substring(0, maxLength);
    }

    chunkText(text, chunkSize) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.substring(i, i + chunkSize));
        }
        return chunks;
    }

    clearChat() {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = '<div class="welcome-message"><p>Chat cleared. Ask a new question about your PDF document.</p></div>';
        
        // Clear the input field as well
        document.getElementById('questionInput').value = '';
        
        // Clear conversation history
        this.conversation = [];
    }

    copyToClipboard(button) {
        const messageContent = button.closest('.message').querySelector('.message__bubble').textContent;
        navigator.clipboard.writeText(messageContent).then(() => {
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = 'Copy';
            }, 2000);
        });
    }

    // Settings Functions
    openSettings() {
        document.getElementById('settingsModal').classList.remove('hidden');
        this.populateSettingsForm();
    }

    closeSettings() {
        document.getElementById('settingsModal').classList.add('hidden');
    }

    populateSettingsForm() {
        document.getElementById('apiProvider').value = this.settings.apiProvider;
        document.getElementById('apiKey').value = this.settings.apiKey;
        document.getElementById('modelSelect').value = this.settings.model;
        document.getElementById('maxTokens').value = this.settings.maxTokens;
        document.getElementById('temperature').value = this.settings.temperature;
        
        document.getElementById('maxTokensValue').textContent = `${this.settings.maxTokens} tokens`;
        document.getElementById('temperatureValue').textContent = this.settings.temperature;
    }

    updateModelOptions() {
        const provider = document.getElementById('apiProvider').value;
        const modelSelect = document.getElementById('modelSelect');
        const apiKeyInput = document.getElementById('apiKey');
        
        // Update model options
        modelSelect.innerHTML = '';
        this.apiProviders[provider].models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
        
        // Update API key placeholder
        apiKeyInput.placeholder = this.apiProviders[provider].keyPlaceholder;
    }

    saveSettings() {
        this.settings.apiProvider = document.getElementById('apiProvider').value;
        this.settings.apiKey = document.getElementById('apiKey').value;
        this.settings.model = document.getElementById('modelSelect').value;
        this.settings.maxTokens = document.getElementById('maxTokens').value;
        this.settings.temperature = document.getElementById('temperature').value;
        
        // Save to localStorage (note: this is just for demo - localStorage isn't available in sandbox)
        try {
            localStorage.setItem('pdfQuerySettings', JSON.stringify(this.settings));
        } catch (e) {
            console.log('LocalStorage not available in sandbox environment');
        }
        
        this.closeSettings();
        this.showSuccess('Settings saved successfully!');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('pdfQuerySettings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.log('LocalStorage not available in sandbox environment');
        }
    }

    exportChat() {
        if (this.conversation.length === 0) {
            this.showError('No conversation to export.');
            return;
        }

        const exportText = this.conversation.map(msg => 
            `[${msg.timestamp}] ${msg.role.toUpperCase()}: ${msg.content}`
        ).join('\n\n');

        const blob = new Blob([exportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pdf-chat-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.closeSettings();
    }

    // Theme Functions
    toggleTheme() {
        this.settings.theme = this.settings.theme === 'light' ? 'dark' : 'light';
        this.updateTheme();
        try {
            localStorage.setItem('pdfQuerySettings', JSON.stringify(this.settings));
        } catch (e) {
            console.log('LocalStorage not available in sandbox environment');
        }
    }

    updateTheme() {
        document.documentElement.setAttribute('data-color-scheme', this.settings.theme);
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = this.settings.theme === 'light' ? '🌙' : '☀️';
    }

    // Utility Functions
    showError(message) {
        // Simple error display - in production, you might use a proper toast system
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        // Simple success display - in production, you might use a proper toast system
        alert(message);
    }
}

// Initialize the application
const app = new PDFQueryAssistant();

// Make app globally accessible for event handlers
window.app = app;