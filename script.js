class WorksheetExtractor {
  constructor() {
    this.mainFile = null;
    this.sampleFile = null;
    this.processingMode = null;

    // Visual pattern learning
    this.sampleCanvas = null;
    this.sampleCtx = null;
    this.isDrawing = false;
    this.currentTool = 'question';
    this.annotations = [];
    this.learnedPattern = null;

    this.extractedQuestions = {};
    this.watermarksFiltered = 0;

    console.log('WorksheetExtractor initializing...');
    this.init();
  }

  init() {
    console.log('Setting up event listeners...');
    this.setupFileUploads();
    this.setupEventListeners();
    this.checkLibrariesReady();
    console.log('Initialization complete');
  }

  checkLibrariesReady() {
    console.log('Checking libraries...');
    const checkInterval = setInterval(() => {
      if (typeof Tesseract !== 'undefined' && typeof pdfjsLib !== 'undefined') {
        console.log('All libraries loaded successfully');
        clearInterval(checkInterval);
      }
    }, 300);
  }

  setupFileUploads() {
    console.log('Setting up file uploads...');
    
    // Main file upload - FIXED
    const mainUpload = document.getElementById('main-upload');
    const mainFile = document.getElementById('main-file');

    if (!mainUpload || !mainFile) {
      console.error('Main upload elements not found!');
      return;
    }

    console.log('Main upload elements found:', mainUpload, mainFile);

    // Click handler
    mainUpload.addEventListener('click', (e) => {
      console.log('Main upload clicked');
      e.preventDefault();
      mainFile.click();
    });

    // File change handler - FIXED
    mainFile.addEventListener('change', (e) => {
      console.log('File input changed:', e.target.files);
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        console.log('Selected file:', file.name, file.type, file.size);
        this.handleMainFile(file);
      } else {
        console.log('No file selected');
      }
    });

    // Drag and drop
    mainUpload.addEventListener('dragover', (e) => {
      e.preventDefault();
      mainUpload.classList.add('dragover');
    });

    mainUpload.addEventListener('dragleave', (e) => {
      mainUpload.classList.remove('dragover');
    });

    mainUpload.addEventListener('drop', (e) => {
      e.preventDefault();
      mainUpload.classList.remove('dragover');
      console.log('File dropped:', e.dataTransfer.files);
      if (e.dataTransfer.files.length > 0) {
        this.handleMainFile(e.dataTransfer.files[0]);
      }
    });

    // Sample file upload - FIXED
    const sampleUpload = document.getElementById('sample-upload');
    const sampleFile = document.getElementById('sample-file');

    if (!sampleUpload || !sampleFile) {
      console.error('Sample upload elements not found!');
      return;
    }

    sampleUpload.addEventListener('click', (e) => {
      console.log('Sample upload clicked');
      e.preventDefault();
      sampleFile.click();
    });

    sampleFile.addEventListener('change', (e) => {
      console.log('Sample file changed:', e.target.files);
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        console.log('Selected sample file:', file.name);
        this.handleSampleFile(file);
      }
    });

    // Sample drag and drop
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

    console.log('File upload handlers set up successfully');
  }

  setupEventListeners() {
    console.log('Setting up other event listeners...');

    // Mode selection
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    console.log('Found mode radios:', modeRadios.length);
    
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        console.log('Mode changed to:', e.target.value);
        this.processingMode = e.target.value;
        this.enableStep(3);
      });
    });

    // Sliders
    const sensitivitySlider = document.getElementById('sensitivity-slider');
    const filterSlider = document.getElementById('filter-slider');
    
    if (sensitivitySlider) {
      sensitivitySlider.addEventListener('input', (e) => {
        const val = document.getElementById('sensitivity-value');
        if (val) val.textContent = e.target.value + '%';
      });
    }
    
    if (filterSlider) {
      filterSlider.addEventListener('input', (e) => {
        const val = document.getElementById('filter-value');
        if (val) val.textContent = e.target.value + '%';
      });
    }

    // Buttons
    const analyzeBtn = document.getElementById('analyze-sample');
    const extractBtn = document.getElementById('extract-btn');
    
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', () => {
        console.log('Analyze button clicked');
        this.analyzeSample();
      });
    }
    
    if (extractBtn) {
      extractBtn.addEventListener('click', () => {
        console.log('Extract button clicked');
        this.extractQuestions();
      });
    }

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        console.log('Tab clicked:', e.target.dataset.tab);
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Copy and download buttons
    const copyListBtn = document.getElementById('copy-list');
    const copyDictBtn = document.getElementById('copy-dict');
    const downloadJsonBtn = document.getElementById('download-json');
    const downloadPyBtn = document.getElementById('download-py');

    if (copyListBtn) copyListBtn.addEventListener('click', () => this.copyToClipboard('list'));
    if (copyDictBtn) copyDictBtn.addEventListener('click', () => this.copyToClipboard('dict'));
    if (downloadJsonBtn) downloadJsonBtn.addEventListener('click', () => this.downloadResults('json'));
    if (downloadPyBtn) downloadPyBtn.addEventListener('click', () => this.downloadResults('py'));

    console.log('Event listeners set up complete');
  }

  enableStep(n) {
    console.log('Enabling step:', n);
    const step = document.getElementById(`step-${n}`);
    if (step) {
      step.classList.remove('disabled');
    } else {
      console.error('Step element not found:', `step-${n}`);
    }
  }

  handleMainFile(file) {
    console.log('Handling main file:', file.name, file.type, file.size);
    
    if (!file) {
      console.error('No file provided');
      return;
    }

    try {
      this.mainFile = file;
      this.showFilePreview('main-preview', file);
      
      // Determine processing mode
      if (file.type.startsWith('image/')) {
        console.log('Image file detected, forcing OCR mode');
        const textRadio = document.querySelector('input[name="mode"][value="text"]');
        const ocrRadio = document.querySelector('input[name="mode"][value="ocr"]');
        
        if (textRadio) textRadio.disabled = true;
        if (ocrRadio) {
          ocrRadio.checked = true;
          this.processingMode = 'ocr';
        }
        this.enableStep(3); // Skip mode selection for images
      } else {
        console.log('PDF file detected');
        const textRadio = document.querySelector('input[name="mode"][value="text"]');
        if (textRadio) textRadio.disabled = false;
      }
      
      this.enableStep(2);
      console.log('Main file handled successfully');
      
    } catch (error) {
      console.error('Error handling main file:', error);
      this.showError('Failed to process file: ' + error.message);
    }
  }

  handleSampleFile(file) {
    console.log('Handling sample file:', file.name);
    
    if (!file) {
      console.error('No sample file provided');
      return;
    }

    try {
      this.sampleFile = file;
      this.setupSampleAnnotation(file);
      
      const analyzeBtn = document.getElementById('analyze-sample');
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
      }
      console.log('Sample file handled successfully');
      
    } catch (error) {
      console.error('Error handling sample file:', error);
      this.showError('Failed to process sample file: ' + error.message);
    }
  }

  setupSampleAnnotation(file) {
    console.log('Setting up sample annotation...');
    
    const preview = document.getElementById('sample-preview');
    if (!preview) {
      console.error('Sample preview element not found');
      return;
    }

    preview.innerHTML = `
      <div class="annotation-container">
        <div class="annotation-tools">
          <h4>📍 Annotate the Sample</h4>
          <div class="tool-buttons">
            <button class="tool-btn active" data-tool="question">🔴 Question Text</button>
            <button class="tool-btn" data-tool="option">⚫ MCQ Options</button>
            <button class="tool-btn" data-tool="block">🟢 Whole Block</button>
            <button class="clear-btn">🗑️ Clear All</button>
          </div>
          <p class="instruction">Draw rectangles around: <span class="highlight">Red = Question text</span>, <span class="highlight">Black = Each option</span>, <span class="highlight">Green = Entire question block</span></p>
        </div>
        <div class="canvas-container">
          <canvas id="sample-canvas"></canvas>
        </div>
      </div>`;
    
    preview.classList.add('show');

    // Setup annotation tools
    setTimeout(() => {
      this.setupAnnotationTools();
      this.loadImageToCanvas(file);
    }, 100);
  }

  setupAnnotationTools() {
    console.log('Setting up annotation tools...');
    
    // Tool selection
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        console.log('Tool selected:', e.target.dataset.tool);
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentTool = e.target.dataset.tool;
      });
    });

    // Clear button
    const clearBtn = document.querySelector('.clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        console.log('Clearing annotations');
        this.annotations = [];
        this.redrawCanvas();
      });
    }
  }

  loadImageToCanvas(file) {
    console.log('Loading image to canvas...');
    
    const img = new Image();
    img.onload = () => {
      console.log('Image loaded:', img.width, img.height);
      
      this.sampleCanvas = document.getElementById('sample-canvas');
      if (!this.sampleCanvas) {
        console.error('Canvas element not found');
        return;
      }
      
      this.sampleCtx = this.sampleCanvas.getContext('2d');
      
      // Set canvas size
      const maxWidth = 600;
      const maxHeight = 400;
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
      
      this.sampleCanvas.width = img.width * ratio;
      this.sampleCanvas.height = img.height * ratio;
      
      // Store for scaling
      this.originalImageWidth = img.width;
      this.originalImageHeight = img.height;
      this.scaleRatio = ratio;
      
      // Draw image
      this.sampleCtx.drawImage(img, 0, 0, this.sampleCanvas.width, this.sampleCanvas.height);
      
      // Setup drawing
      this.setupCanvasDrawing();
      console.log('Canvas setup complete');
    };
    
    img.onerror = (e) => {
      console.error('Failed to load image:', e);
      this.showError('Failed to load sample image');
    };
    
    img.src = URL.createObjectURL(file);
  }

  setupCanvasDrawing() {
    if (!this.sampleCanvas) return;
    
    console.log('Setting up canvas drawing...');
    let startX, startY, currentRect = null;

    this.sampleCanvas.addEventListener('mousedown', (e) => {
      console.log('Mouse down on canvas');
      this.isDrawing = true;
      const rect = this.sampleCanvas.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      currentRect = { x: startX, y: startY, width: 0, height: 0, tool: this.currentTool };
    });

    this.sampleCanvas.addEventListener('mousemove', (e) => {
      if (!this.isDrawing || !currentRect) return;
      
      const rect = this.sampleCanvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      currentRect.width = currentX - startX;
      currentRect.height = currentY - startY;
      
      this.redrawCanvas();
      this.drawRect(currentRect, true);
    });

    this.sampleCanvas.addEventListener('mouseup', () => {
      if (this.isDrawing && currentRect && Math.abs(currentRect.width) > 5 && Math.abs(currentRect.height) > 5) {
        console.log('Adding annotation:', currentRect);
        
        // Normalize rectangle
        if (currentRect.width < 0) {
          currentRect.x += currentRect.width;
          currentRect.width = Math.abs(currentRect.width);
        }
        if (currentRect.height < 0) {
          currentRect.y += currentRect.height;
          currentRect.height = Math.abs(currentRect.height);
        }
        
        this.annotations.push({ ...currentRect });
        this.redrawCanvas();
      }
      this.isDrawing = false;
      currentRect = null;
    });
  }

  redrawCanvas() {
    if (!this.sampleCanvas || !this.sampleFile) return;
    
    const img = new Image();
    img.onload = () => {
      this.sampleCtx.clearRect(0, 0, this.sampleCanvas.width, this.sampleCanvas.height);
      this.sampleCtx.drawImage(img, 0, 0, this.sampleCanvas.width, this.sampleCanvas.height);
      
      // Redraw annotations
      this.annotations.forEach(annotation => this.drawRect(annotation, false));
    };
    img.src = URL.createObjectURL(this.sampleFile);
  }

  drawRect(rect, isPreview) {
    const colors = {
      question: { stroke: '#ff0000', fill: 'rgba(255,0,0,0.1)' },
      option: { stroke: '#000000', fill: 'rgba(0,0,0,0.1)' },
      block: { stroke: '#00ff00', fill: 'rgba(0,255,0,0.1)' }
    };
    
    const color = colors[rect.tool] || colors.question;
    
    this.sampleCtx.strokeStyle = color.stroke;
    this.sampleCtx.fillStyle = color.fill;
    this.sampleCtx.lineWidth = isPreview ? 1 : 2;
    this.sampleCtx.setLineDash(isPreview ? [5, 5] : []);
    
    this.sampleCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
    this.sampleCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    
    this.sampleCtx.setLineDash([]);
  }

  showFilePreview(id, file) {
    console.log('Showing file preview for:', id, file.name);
    
    if (id === 'sample-preview') return; // Handled by setupSampleAnnotation
    
    const el = document.getElementById(id);
    if (!el) {
      console.error('Preview element not found:', id);
      return;
    }

    el.innerHTML = `
      <div class="file-info">
        <div class="file-icon">${file.type.startsWith('image/') ? '🖼️' : '📄'}</div>
        <div>
          <strong>${file.name}</strong><br>
          <small>${this.formatFileSize(file.size)} • ${file.type}</small>
        </div>
      </div>`;
    el.classList.add('show');
  }

  formatFileSize(b) { 
    if (b === 0) return '0 Bytes'; 
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return (b / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]; 
  }

  async analyzeSample() {
    console.log('Analyzing sample...');
    
    if (!this.sampleFile || this.annotations.length === 0) {
      this.showError('Please annotate the sample first by drawing rectangles');
      return;
    }
    
    this.updateProgress(10, 'Analyzing annotated pattern...');
    
    try {
      // Convert canvas coordinates to original image coordinates
      const scaledAnnotations = this.annotations.map(ann => ({
        ...ann,
        x: ann.x / this.scaleRatio,
        y: ann.y / this.scaleRatio,
        width: ann.width / this.scaleRatio,
        height: ann.height / this.scaleRatio
      }));

      const questionBoxes = scaledAnnotations.filter(a => a.tool === 'question');
      const optionBoxes = scaledAnnotations.filter(a => a.tool === 'option');
      const blockBoxes = scaledAnnotations.filter(a => a.tool === 'block');

      this.learnedPattern = {
        questionBoxes,
        optionBoxes,
        blockBoxes,
        layout: this.analyzeLayout(questionBoxes, optionBoxes, blockBoxes),
        imageWidth: this.originalImageWidth,
        imageHeight: this.originalImageHeight
      };

      this.displayPatternResults(this.learnedPattern);
      this.enableStep(4);
      
      const extractBtn = document.getElementById('extract-btn');
      if (extractBtn) extractBtn.disabled = false;
      
      this.updateProgress(100, 'Pattern learned successfully');
      console.log('Sample analysis complete');
      
    } catch (error) { 
      console.error('Error analyzing sample:', error); 
      this.showError('Failed to analyze pattern: ' + error.message); 
    }
  }

  analyzeLayout(questionBoxes, optionBoxes, blockBoxes) {
    console.log('Analyzing layout:', questionBoxes.length, optionBoxes.length, blockBoxes.length);
    
    if (questionBoxes.length === 0) {
      return { type: 'simple', description: 'No question regions marked' };
    }

    if (optionBoxes.length === 0) {
      return { type: 'simple', description: 'No option regions marked' };
    }

    const qBox = questionBoxes[0];
    const avgOptionY = optionBoxes.reduce((sum, opt) => sum + opt.y, 0) / optionBoxes.length;

    // Determine if options are inline or below question
    const isInline = Math.abs(qBox.y - avgOptionY) < qBox.height * 0.8;

    return {
      type: isInline ? 'inline' : 'vertical',
      description: isInline ? 'Options on same line as question' : 'Options below question',
      questionBox: qBox,
      optionBoxes: optionBoxes
    };
  }

  displayPatternResults(pattern) {
    console.log('Displaying pattern results:', pattern);
    
    const resultsEl = document.getElementById('pattern-results');
    if (!resultsEl) {
      console.error('Pattern results element not found');
      return;
    }

    resultsEl.innerHTML = `
      <div class="pattern-info">
        <h4>✅ Visual Pattern Learned</h4>
        <p><strong>Layout Type:</strong> ${pattern.layout.description}</p>
        <p><strong>Question regions:</strong> ${pattern.questionBoxes.length} marked</p>
        <p><strong>Option regions:</strong> ${pattern.optionBoxes.length} marked</p>
        <p><strong>Block regions:</strong> ${pattern.blockBoxes.length} marked</p>
        <p><strong>Pattern matching:</strong> Only content matching this visual layout will be extracted</p>
      </div>`;
  }

  async extractQuestions() {
    console.log('Starting question extraction...');
    
    if (!this.learnedPattern) {
      this.showError('Please analyze the sample pattern first');
      return;
    }

    this.enableStep(5);
    this.updateProgress(0, 'Starting extraction with pattern matching...');
    
    try {
      let text = '';
      
      if (this.processingMode === 'ocr') {
        console.log('Using OCR mode');
        text = await this.extractWithOCR();
      } else {
        console.log('Using text selection mode');
        text = await this.extractWithTextSelection();
      }

      console.log('Extracted text length:', text.length);

      this.updateProgress(60, 'Filtering with pattern matching...');
      const cleanText = this.filterByPattern(text);

      this.updateProgress(80, 'Parsing questions and options...');
      this.extractedQuestions = this.parseQuestions(cleanText);

      console.log('Extracted questions:', Object.keys(this.extractedQuestions).length);

      this.updateProgress(100, 'Extraction complete!');
      this.displayResults();
      this.enableStep(6);
      
    } catch (error) { 
      console.error('Error extracting questions:', error); 
      this.showError('Extraction failed: ' + error.message); 
    }
  }

  async extractWithOCR() {
    console.log('Starting OCR extraction...');
    this.updateProgress(20, 'Running OCR...');
    
    try {
      if (this.mainFile.type.startsWith('image/')) {
        console.log('OCR on image file');
        const result = await Tesseract.recognize(this.mainFile, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              this.updateProgress(20 + m.progress * 30, `OCR ${Math.round(m.progress * 100)}%`);
            }
          }
        });
        return result.data.text;
      } else {
        console.log('OCR on PDF file');
        const pdf = await pdfjsLib.getDocument(URL.createObjectURL(this.mainFile)).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          console.log(`Processing page ${i}/${pdf.numPages}`);
          const page = await pdf.getPage(i);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const viewport = page.getViewport({ scale: 2 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          await page.render({ canvasContext: ctx, viewport }).promise;
          
          const result = await Tesseract.recognize(canvas, 'eng');
          fullText += result.data.text + '\n';
          
          this.updateProgress(20 + (i / pdf.numPages) * 30, `OCR page ${i}/${pdf.numPages}`);
        }
        
        return fullText;
      }
    } catch (error) {
      console.error('OCR error:', error);
      throw error;
    }
  }

  async extractWithTextSelection() {
    console.log('Starting text selection extraction...');
    this.updateProgress(30, 'Extracting text from PDF...');
    
    try {
      const pdf = await pdfjsLib.getDocument(URL.createObjectURL(this.mainFile)).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`Processing page ${i}/${pdf.numPages}`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
        
        this.updateProgress(30 + (i / pdf.numPages) * 20, `Processing page ${i}/${pdf.numPages}`);
      }
      
      return fullText;
    } catch (error) {
      console.error('Text selection error:', error);
      throw error;
    }
  }

  filterByPattern(text) {
    console.log('Filtering text by pattern...');
    
    // Basic filtering for now - can be enhanced with visual pattern matching
    const lines = text.split('\n');
    const filtered = [];
    const keywords = ['watermark', 'sample', 'preview', 'demo', 'trial', 'confidential', 'copy'];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 2) continue;
      
      // Skip watermark-like content
      if (keywords.some(k => trimmed.toLowerCase().includes(k))) {
        this.watermarksFiltered++;
        continue;
      }
      
      filtered.push(line);
    }
    
    console.log(`Filtered ${this.watermarksFiltered} watermark lines`);
    return filtered.join('\n');
  }

  parseQuestions(text) {
    console.log('Parsing questions from text...');
    
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const questions = {};
    let curQ = '';
    let curOpts = [];
    let collecting = false;

    const Q_START = /^(?:\s*(?:Q\s*|Question\s*)?\d+\s*[\.\):\-]|(?:\s*\d+\s*[\.\):\-]))/i;
    const OPT_TOKEN = /(?:^|\s)([a-dA-D])[\.:\)\]®]\s*/g;
    const STRICT_OPT_LINE = /^\s*([a-dA-D])[\.:\)\]®]\s*(.+?)\s*$/;

    const flush = () => {
      if (curQ) {
        const qClean = curQ.replace(/\s+/g, ' ').trim();
        if (qClean.length > 8) {
          questions[qClean] = curOpts;
          console.log('Added question:', qClean.substring(0, 50) + '...');
        }
        curQ = ''; 
        curOpts = [];
      }
    };

    const extractInlineOptions = (s) => {
      const opts = [];
      OPT_TOKEN.lastIndex = 0;
      let firstMatch = OPT_TOKEN.exec(s);
      if (!firstMatch) return { rest: s.trim(), options: [] };

      const tokenStart = firstMatch.index + (firstMatch[0].startsWith(' ') ? 1 : 0);
      const rest = s.slice(0, tokenStart).trim();
      const tail = s.slice(tokenStart);

      const indices = [];
      OPT_TOKEN.lastIndex = 0;
      let m;
      while ((m = OPT_TOKEN.exec(tail)) !== null) {
        indices.push({ idx: m.index, len: m[0].length, letter: m[1].toUpperCase() });
      }
      
      for (let i = 0; i < indices.length; i++) {
        const start = indices[i].idx + indices[i].len;
        const end = (i + 1 < indices.length) ? indices[i + 1].idx : tail.length;
        const body = tail.slice(start, end).trim();
        const letter = indices[i].letter;
        if (body) opts.push([letter, body]);
      }
      return { rest, options: opts };
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if line is a single option
      const strict = line.match(STRICT_OPT_LINE);
      if (collecting && strict) { 
        curOpts.push([strict[1].toUpperCase(), strict[2].trim()]); 
        continue; 
      }

      // Check if line starts a new question
      if (Q_START.test(line)) {
        flush();
        collecting = true;
        const stripped = line.replace(Q_START, '').trim();
        const { rest, options } = extractInlineOptions(stripped);
        curQ = rest || stripped;
        curOpts = options.length ? options : [];
        continue;
      }

      // Handle continuation lines
      if (collecting) {
        const m1 = line.match(STRICT_OPT_LINE);
        if (m1) { 
          curOpts.push([m1[1].toUpperCase(), m1[1].trim()]); 
          continue; 
        }

        const { rest, options } = extractInlineOptions(line);
        if (options.length) {
          if (rest && curOpts.length === 0) curQ = (curQ + ' ' + rest).trim();
          curOpts.push(...options);
          continue;
        }

        if (curOpts.length === 0 && line.length > 5 && !/^(page|section)\b/i.test(line)) {
          curQ = (curQ + ' ' + line).trim();
        }
      }
    }

    flush();
    console.log(`Parsed ${Object.keys(questions).length} questions`);
    return questions;
  }

  displayResults() {
    console.log('Displaying results...');
    
    const qCount = Object.keys(this.extractedQuestions).length;
    const oCount = Object.values(this.extractedQuestions).reduce((s, o) => s + o.length, 0);

    const statsEl = document.getElementById('processing-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-item"><div class="stat-value">${qCount}</div><div class="stat-label">Questions Found</div></div>
        <div class="stat-item"><div class="stat-value">${oCount}</div><div class="stat-label">Options Detected</div></div>
        <div class="stat-item"><div class="stat-value">${this.watermarksFiltered}</div><div class="stat-label">Content Filtered</div></div>`;
    }

    this.displayQuestionsPreview();

    const list = Object.keys(this.extractedQuestions).map((q, i) => `${i + 1}. ${q}`).join('\n\n');
    const listEl = document.getElementById('questions-list');
    if (listEl) listEl.textContent = list;

    const entries = Object.entries(this.extractedQuestions).map(([q, opts]) => {
      const body = opts.length ? `[${opts.map(([L, t]) => `("${L}", "${t.replace(/"/g, '\\"')}")`).join(', ')}]` : '[]';
      return `    "${q.replace(/"/g, '\\"')}": ${body}`;
    });
    const py = `{\n${entries.join(',\n')}\n}`;
    const dictEl = document.getElementById('questions-dict');
    if (dictEl) dictEl.textContent = py;
  }

  displayQuestionsPreview() {
    const preview = document.getElementById('questions-preview');
    if (!preview) return;
    
    preview.innerHTML = '';
    Object.entries(this.extractedQuestions).forEach(([q, opts], i) => {
      const div = document.createElement('div'); 
      div.className = 'question-item';
      const optHtml = opts.length ? 
        `<div class="options-list">${opts.map(([L, t]) => `<div class="option-item">${L}. ${t}</div>`).join('')}</div>` : 
        '<div class="options-list"><em>No options</em></div>';
      div.innerHTML = `<div class="question-text">${i + 1}. ${q}</div>${optHtml}`;
      preview.appendChild(div);
    });
  }

  switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${tab}-tab`));
  }

  async copyToClipboard(type) {
    const text = type === 'list' ? 
      document.getElementById('questions-list').textContent : 
      document.getElementById('questions-dict').textContent;
    
    try { 
      await navigator.clipboard.writeText(text); 
      this.showSuccess('Copied to clipboard!'); 
    } catch { 
      const ta = document.createElement('textarea'); 
      ta.value = text; 
      document.body.appendChild(ta); 
      ta.select(); 
      document.execCommand('copy'); 
      document.body.removeChild(ta); 
      this.showSuccess('Copied!'); 
    }
  }

  downloadResults(fmt) {
    let content = '', name = '', mime = 'text/plain';
    if (fmt === 'json') { 
      content = JSON.stringify(this.extractedQuestions, null, 2); 
      name = 'extracted_questions.json'; 
      mime = 'application/json'; 
    } else { 
      content = `# Extracted Questions\nquestions = ${document.getElementById('questions-dict').textContent}`; 
      name = 'extracted_questions.py'; 
      mime = 'text/x-python'; 
    }
    const blob = new Blob([content], { type: mime }); 
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = name; 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);
  }

  updateProgress(p, t) { 
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');
    if (fill) fill.style.width = p + '%'; 
    if (text) text.textContent = t; 
  }
  
  showSuccess(m) { 
    console.log('Success:', m);
    this.showNotification(m, 'success');
  }
  
  showError(m) { 
    console.error('Error:', m);
    this.showNotification('Error: ' + m, 'error');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.background = type === 'error' ? '#dc3545' : '#28a745';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, type === 'error' ? 5000 : 3000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing WorksheetExtractor...');
  new WorksheetExtractor();
});
