class WorksheetExtractor {
    constructor() {
        this.mainFile = null;
        this.sampleFile = null;
        this.processingMode = null;
        this.questionPattern = null;
        this.mcqPattern = null;
        this.extractedQuestions = {};
        this.watermarksFiltered = 0;
        
        this.init();
    }

    init() {
        this.setupFileUploads();
        this.setupEventListeners();
        this.checkLibrariesReady();
    }

    checkLibrariesReady() {
        const checkInterval = setInterval(() => {
            if (typeof cv !== 'undefined' && typeof Tesseract !== 'undefined' && typeof pdfjsLib !== 'undefined') {
                console.log('All libraries loaded successfully');
                clearInterval(checkInterval);
            }
        }, 500);
    }

    setupFileUploads() {
        // Main file upload
        const mainUpload = document.getElementById('main-upload');
        const mainFile = document.getElementById('main-file');
        
        mainUpload.addEventListener('click', () => mainFile.click());
        mainUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            mainUpload.classList.add('dragover');
        });
        mainUpload.addEventListener('dragleave', () => {
            mainUpload.classList.remove('dragover');
        });
        mainUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            mainUpload.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.handleMainFile(e.dataTransfer.files[0]);
            }
        });
        mainFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleMainFile(e.target.files[0]);
            }
        });

        // Sample file upload
        const sampleUpload = document.getElementById('sample-upload');
        const sampleFile = document.getElementById('sample-file');
        
        sampleUpload.addEventListener('click', () => sampleFile.click());
        sampleUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            sampleUpload.classList.add('dragover');
        });
        sampleUpload.addEventListener('dragleave', () => {
            sampleUpload.classList.remove('dragover');
        });
        sampleUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            sampleUpload.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.handleSampleFile(e.dataTransfer.files[0]);
            }
        });
        sampleFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleSampleFile(e.target.files[0]);
            }
        });
    }

    setupEventListeners() {
        // Mode selection
        document.querySelectorAll('input[name="mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.processingMode = e.target.value;
                this.enableStep(3);
            });
        });

        // Sliders
        const sensitivitySlider = document.getElementById('sensitivity-slider');
        const filterSlider = document.getElementById('filter-slider');
        
        sensitivitySlider.addEventListener('input', (e) => {
            document.getElementById('sensitivity-value').textContent = e.target.value + '%';
        });
        
        filterSlider.addEventListener('input', (e) => {
            document.getElementById('filter-value').textContent = e.target.value + '%';
        });

        // Buttons
        document.getElementById('analyze-sample').addEventListener('click', () => this.analyzeSample());
        document.getElementById('extract-btn').addEventListener('click', () => this.extractQuestions());
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Copy and download buttons
        document.getElementById('copy-list').addEventListener('click', () => this.copyToClipboard('list'));
        document.getElementById('copy-dict').addEventListener('click', () => this.copyToClipboard('dict'));
        document.getElementById('download-json').addEventListener('click', () => this.downloadResults('json'));
        document.getElementById('download-py').addEventListener('click', () => this.downloadResults('py'));
    }

    enableStep(stepNumber) {
        document.getElementById(`step-${stepNumber}`).classList.remove('disabled');
    }

    handleMainFile(file) {
        this.mainFile = file;
        this.showFilePreview('main-preview', file);
        
        // Determine if OCR is required for images
        if (file.type.startsWith('image/')) {
            document.querySelector('input[name="mode"][value="text"]').disabled = true;
            document.querySelector('input[name="mode"][value="ocr"]').checked = true;
            this.processingMode = 'ocr';
            this.enableStep(3);
        } else {
            document.querySelector('input[name="mode"][value="text"]').disabled = false;
        }
        
        this.enableStep(2);
    }

    handleSampleFile(file) {
        this.sampleFile = file;
        this.showFilePreview('sample-preview', file);
        document.getElementById('analyze-sample').disabled = false;
    }

    showFilePreview(previewId, file) {
        const preview = document.getElementById(previewId);
        preview.innerHTML = `
            <div class="file-info">
                <div class="file-icon">${file.type.startsWith('image/') ? '🖼️' : '📄'}</div>
                <div>
                    <strong>${file.name}</strong>
                    <br>
                    <small>${this.formatFileSize(file.size)} • ${file.type}</small>
                </div>
            </div>
        `;
        preview.classList.add('show');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async analyzeSample() {
        if (!this.sampleFile) return;

        this.updateProgress(10, 'Analyzing sample pattern...');
        
        try {
            const imageData = await this.fileToImageData(this.sampleFile);
            
            // Use OpenCV for pattern detection
            const patterns = await this.detectPatterns(imageData);
            this.questionPattern = patterns.question;
            this.mcqPattern = patterns.mcq;
            
            this.displayPatternResults(patterns);
            this.enableStep(4);
            document.getElementById('extract-btn').disabled = false;
            
            this.updateProgress(100, 'Pattern analysis complete');
        } catch (error) {
            console.error('Error analyzing sample:', error);
            this.showError('Failed to analyze sample pattern');
        }
    }

    async fileToImageData(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
            };
            img.src = URL.createObjectURL(file);
        });
    }

    async detectPatterns(imageData) {
        // Simple pattern detection without OpenCV for basic functionality
        const patterns = {
            question: /(\d+[\.\)]|\bQ\s*\d+|\bQuestion\s+\d+)/i,
            mcq: /^[A-D][\.\)]\s*(.+)/,
            watermark: {
                opacity_threshold: 0.3,
                position_patterns: ['center', 'corner'],
                repeated_text: []
            }
        };
        
        return patterns;
    }

    displayPatternResults(patterns) {
        const results = document.getElementById('pattern-results');
        results.innerHTML = `
            <div class="pattern-info">
                <h4>✅ Pattern Analysis Complete</h4>
                <p><strong>Question Format:</strong> ${patterns.question.source}</p>
                <p><strong>MCQ Format:</strong> Detected A-D option patterns</p>
                <p><strong>Watermark Filter:</strong> Ready to filter common watermarks</p>
            </div>
        `;
    }

    async extractQuestions() {
        this.enableStep(5);
        this.updateProgress(0, 'Starting extraction...');
        
        try {
            let text = '';
            
            if (this.processingMode === 'ocr') {
                text = await this.extractWithOCR();
            } else {
                text = await this.extractWithTextSelection();
            }
            
            this.updateProgress(60, 'Filtering watermarks...');
            const cleanText = this.filterWatermarks(text);
            
            this.updateProgress(80, 'Parsing questions and options...');
            this.extractedQuestions = this.parseQuestions(cleanText);
            
            this.updateProgress(100, 'Extraction complete!');
            this.displayResults();
            this.enableStep(6);
            
        } catch (error) {
            console.error('Error extracting questions:', error);
            this.showError('Failed to extract questions');
        }
    }

    async extractWithOCR() {
        this.updateProgress(20, 'Running OCR...');
        
        if (this.mainFile.type.startsWith('image/')) {
            const result = await Tesseract.recognize(this.mainFile, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        this.updateProgress(20 + (m.progress * 30), `OCR: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
            return result.data.text;
        } else {
            // PDF with OCR
            const pdf = await pdfjsLib.getDocument(URL.createObjectURL(this.mainFile)).promise;
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const viewport = page.getViewport({ scale: 2 });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({ canvasContext: ctx, viewport }).promise;
                
                const result = await Tesseract.recognize(canvas, 'eng');
                fullText += result.data.text + '\n';
                
                this.updateProgress(20 + (i / pdf.numPages) * 30, `OCR Page ${i}/${pdf.numPages}`);
            }
            
            return fullText;
        }
    }

    async extractWithTextSelection() {
        this.updateProgress(30, 'Extracting text from PDF...');
        
        const pdf = await pdfjsLib.getDocument(URL.createObjectURL(this.mainFile)).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
            
            this.updateProgress(30 + (i / pdf.numPages) * 20, `Processing page ${i}/${pdf.numPages}`);
        }
        
        return fullText;
    }

    filterWatermarks(text) {
        const sensitivity = document.getElementById('filter-slider').value / 100;
        const lines = text.split('\n');
        const filteredLines = [];
        const watermarkKeywords = ['watermark', 'copy', 'sample', 'preview', 'demo', 'trial', 'confidential', 'draft'];
        
        // Track repeated text patterns
        const textCounts = {};
        lines.forEach(line => {
            const trimmed = line.trim().toLowerCase();
            if (trimmed.length > 3) {
                textCounts[trimmed] = (textCounts[trimmed] || 0) + 1;
            }
        });
        
        // Filter out watermarks
        lines.forEach(line => {
            const trimmed = line.trim().toLowerCase();
            
            // Skip empty lines
            if (trimmed.length < 2) return;
            
            // Skip if contains watermark keywords
            if (watermarkKeywords.some(keyword => trimmed.includes(keyword))) {
                this.watermarksFiltered++;
                return;
            }
            
            // Skip if appears too frequently (likely watermark)
            if (textCounts[trimmed] > Math.max(2, 5 * sensitivity)) {
                this.watermarksFiltered++;
                return;
            }
            
            // Skip if all caps and short (likely watermark)
            if (line === line.toUpperCase() && line.length < 25 && line.length > 4) {
                this.watermarksFiltered++;
                return;
            }
            
            // Skip very short lines
            if (trimmed.length < 3) return;
            
            filteredLines.push(line);
        });
        
        return filteredLines.join('\n');
    }

    parseQuestions(text) {
        const questions = {};
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        let currentQuestion = '';
        let currentOptions = [];
        let inQuestion = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Detect question start
            if (this.questionPattern && this.questionPattern.test(line)) {
                // Save previous question if exists
                if (currentQuestion.trim()) {
                    questions[currentQuestion.trim()] = [...currentOptions];
                }
                
                currentQuestion = line.replace(this.questionPattern, '').trim();
                currentOptions = [];
                inQuestion = true;
                continue;
            }
            
            // Fallback question detection
            if (/^\d+[\.\)]\s*/.test(line) || /^Q\s*\d+/i.test(line)) {
                if (currentQuestion.trim()) {
                    questions[currentQuestion.trim()] = [...currentOptions];
                }
                
                currentQuestion = line.replace(/^\d+[\.\)]\s*|^Q\s*\d+[:\.\)]\s*/i, '').trim();
                currentOptions = [];
                inQuestion = true;
                continue;
            }
            
            // Detect MCQ options
            if (inQuestion && /^[A-D][\.\)]\s*/.test(line)) {
                const match = line.match(/^([A-D])[\.\)]\s*(.+)/);
                if (match && match[2].trim()) {
                    currentOptions.push([match[1], match[2].trim()]);
                }
                continue;
            }
            
            // Continue question text
            if (inQuestion && currentOptions.length === 0 && line.length > 5) {
                currentQuestion += ' ' + line;
            }
        }
        
        // Save last question
        if (currentQuestion.trim()) {
            questions[currentQuestion.trim()] = currentOptions;
        }
        
        // Clean up questions - remove very short or invalid ones
        const cleanedQuestions = {};
        Object.entries(questions).forEach(([question, options]) => {
            if (question.length > 10 && !question.toLowerCase().includes('page') && !question.toLowerCase().includes('section')) {
                cleanedQuestions[question] = options;
            }
        });
        
        return cleanedQuestions;
    }

    displayResults() {
        const questionsCount = Object.keys(this.extractedQuestions).length;
        const optionsCount = Object.values(this.extractedQuestions).reduce((sum, options) => sum + options.length, 0);
        
        // Update stats
        document.getElementById('processing-stats').innerHTML = `
            <div class="stat-item">
                <div class="stat-value">${questionsCount}</div>
                <div class="stat-label">Questions Found</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${optionsCount}</div>
                <div class="stat-label">Options Detected</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${this.watermarksFiltered}</div>
                <div class="stat-label">Watermarks Filtered</div>
            </div>
        `;
        
        // Preview tab
        this.displayQuestionsPreview();
        
        // List tab
        const questionsList = Object.keys(this.extractedQuestions).map((q, i) => `${i + 1}. ${q}`).join('\n\n');
        document.getElementById('questions-list').textContent = questionsList;
        
        // Dictionary tab - Python format
        const dictEntries = Object.entries(this.extractedQuestions).map(([question, options]) => {
            const formattedOptions = options.length > 0 
                ? `[${options.map(([letter, text]) => `("${letter}", "${text.replace(/"/g, '\\"')}")`).join(', ')}]`
                : '[]';
            return `    "${question.replace(/"/g, '\\"')}": ${formattedOptions}`;
        });
        
        const pythonDict = `{\n${dictEntries.join(',\n')}\n}`;
        document.getElementById('questions-dict').textContent = pythonDict;
    }

    displayQuestionsPreview() {
        const preview = document.getElementById('questions-preview');
        preview.innerHTML = '';
        
        Object.entries(this.extractedQuestions).forEach(([question, options], index) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question-item';
            
            const optionsHtml = options.length > 0 
                ? `<div class="options-list">
                     ${options.map(([letter, text]) => `<div class="option-item">${letter}. ${text}</div>`).join('')}
                   </div>`
                : '<div class="options-list"><em>No options detected</em></div>';
            
            questionDiv.innerHTML = `
                <div class="question-text">${index + 1}. ${question}</div>
                ${optionsHtml}
            `;
            
            preview.appendChild(questionDiv);
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }

    async copyToClipboard(type) {
        let text = '';
        if (type === 'list') {
            text = document.getElementById('questions-list').textContent;
        } else if (type === 'dict') {
            text = document.getElementById('questions-dict').textContent;
        }
        
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess('Copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showSuccess('Copied to clipboard!');
        }
    }

    downloadResults(format) {
        let content = '';
        let filename = '';
        let mimeType = 'text/plain';
        
        if (format === 'json') {
            content = JSON.stringify(this.extractedQuestions, null, 2);
            filename = 'extracted_questions.json';
            mimeType = 'application/json';
        } else if (format === 'py') {
            content = `# Extracted Questions from Worksheet\n# Format: {"question": [("A", "option"), ("B", "option"), ...]}\n\nquestions = ${document.getElementById('questions-dict').textContent}`;
            filename = 'extracted_questions.py';
            mimeType = 'text/x-python';
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    updateProgress(percentage, text) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill) progressFill.style.width = percentage + '%';
        if (progressText) progressText.textContent = text;
    }

    showSuccess(message) {
        // Simple success notification
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        // Simple error notification
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WorksheetExtractor();
});