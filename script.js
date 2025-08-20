class WorksheetExtractor {
  constructor() {
    this.mainFile = null;
    this.sampleFile = null;
    this.processingMode = null;

    // Visual pattern learning
    this.sampleCanvas = null;
    this.sampleCtx = null;
    this.isDrawing = false;
    this.currentTool = 'question'; // question, option, block
    this.annotations = [];
    this.learnedPattern = null;

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
      if (typeof Tesseract !== 'undefined' && typeof pdfjsLib !== 'undefined') {
        clearInterval(checkInterval);
      }
    }, 300);
  }

  setupFileUploads() {
    const mainUpload = document.getElementById('main-upload');
    const mainFile = document.getElementById('main-file');

    mainUpload.addEventListener('click', () => mainFile.click());
    mainUpload.addEventListener('dragover', (e) => { e.preventDefault(); mainUpload.classList.add('dragover'); });
    mainUpload.addEventListener('dragleave', () => mainUpload.classList.remove('dragover'));
    mainUpload.addEventListener('drop', (e) => {
      e.preventDefault(); mainUpload.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) this.handleMainFile(e.dataTransfer.files[0]);
    });
    mainFile.addEventListener('change', (e) => { if (e.target.files.length > 0) this.handleMainFile(e.target.files); });

    const sampleUpload = document.getElementById('sample-upload');
    const sampleFile = document.getElementById('sample-file');

    sampleUpload.addEventListener('click', () => sampleFile.click());
    sampleUpload.addEventListener('dragover', (e) => { e.preventDefault(); sampleUpload.classList.add('dragover'); });
    sampleUpload.addEventListener('dragleave', () => sampleUpload.classList.remove('dragover'));
    sampleUpload.addEventListener('drop', (e) => {
      e.preventDefault(); sampleUpload.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) this.handleSampleFile(e.dataTransfer.files[0]);
    });
    sampleFile.addEventListener('change', (e) => { if (e.target.files.length > 0) this.handleSampleFile(e.target.files); });
  }

  setupEventListeners() {
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.processingMode = e.target.value;
        this.enableStep(3);
      });
    });

    const sensitivitySlider = document.getElementById('sensitivity-slider');
    const filterSlider = document.getElementById('filter-slider');
    sensitivitySlider.addEventListener('input', (e) => document.getElementById('sensitivity-value').textContent = e.target.value + '%');
    filterSlider.addEventListener('input', (e) => document.getElementById('filter-value').textContent = e.target.value + '%');

    document.getElementById('analyze-sample').addEventListener('click', () => this.analyzeSample());
    document.getElementById('extract-btn').addEventListener('click', () => this.extractQuestions());

    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab)));
    document.getElementById('copy-list').addEventListener('click', () => this.copyToClipboard('list'));
    document.getElementById('copy-dict').addEventListener('click', () => this.copyToClipboard('dict'));
    document.getElementById('download-json').addEventListener('click', () => this.downloadResults('json'));
    document.getElementById('download-py').addEventListener('click', () => this.downloadResults('py'));
  }

  enableStep(n) { document.getElementById(`step-${n}`).classList.remove('disabled'); }

  handleMainFile(file) {
    this.mainFile = file;
    this.showFilePreview('main-preview', file);
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
    this.setupSampleAnnotation(file);
    document.getElementById('analyze-sample').disabled = false;
  }

  setupSampleAnnotation(file) {
    const preview = document.getElementById('sample-preview');
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
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentTool = e.target.dataset.tool;
      });
    });

    document.querySelector('.clear-btn').addEventListener('click', () => {
      this.annotations = [];
      this.redrawCanvas();
    });

    // Load image onto canvas
    const img = new Image();
    img.onload = () => {
      this.sampleCanvas = document.getElementById('sample-canvas');
      this.sampleCtx = this.sampleCanvas.getContext('2d');
      
      // Set canvas size to fit image while maintaining aspect ratio
      const maxWidth = 600;
      const maxHeight = 400;
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
      
      this.sampleCanvas.width = img.width * ratio;
      this.sampleCanvas.height = img.height * ratio;
      this.sampleCanvas.style.maxWidth = '100%';
      
      // Store original image dimensions for scaling calculations
      this.originalImageWidth = img.width;
      this.originalImageHeight = img.height;
      this.scaleRatio = ratio;
      
      this.sampleCtx.drawImage(img, 0, 0, this.sampleCanvas.width, this.sampleCanvas.height);
      this.setupCanvasDrawing();
    };
    img.src = URL.createObjectURL(file);
  }

  setupCanvasDrawing() {
    let startX, startY, currentRect = null;

    this.sampleCanvas.addEventListener('mousedown', (e) => {
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
      this.drawRect(currentRect, true); // Draw as preview
    });

    this.sampleCanvas.addEventListener('mouseup', () => {
      if (this.isDrawing && currentRect && Math.abs(currentRect.width) > 5 && Math.abs(currentRect.height) > 5) {
        // Normalize rectangle (handle negative width/height)
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
    
    // Redraw the original image
    const img = new Image();
    img.onload = () => {
      this.sampleCtx.clearRect(0, 0, this.sampleCanvas.width, this.sampleCanvas.height);
      this.sampleCtx.drawImage(img, 0, 0, this.sampleCanvas.width, this.sampleCanvas.height);
      
      // Redraw all annotations
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
    
    const color = colors[rect.tool];
    
    this.sampleCtx.strokeStyle = color.stroke;
    this.sampleCtx.fillStyle = color.fill;
    this.sampleCtx.lineWidth = isPreview ? 1 : 2;
    this.sampleCtx.setLineDash(isPreview ? [5, 5] : []);
    
    this.sampleCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
    this.sampleCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    
    this.sampleCtx.setLineDash([]);
  }

  showFilePreview(id, file) {
    if (id === 'sample-preview') return; // Handled by setupSampleAnnotation
    
    const el = document.getElementById(id);
    el.innerHTML = `
      <div class="file-info">
        <div class="file-icon">${file.type.startsWith('image/') ? '🖼️' : '📄'}</div>
        <div><strong>${file.name}</strong><br><small>${this.formatFileSize(file.size)} • ${file.type}</small></div>
      </div>`;
    el.classList.add('show');
  }

  formatFileSize(b) { if (b===0) return '0 Bytes'; const k=1024,s=['Bytes','KB','MB','GB'];const i=Math.floor(Math.log(b)/Math.log(k));return (b/Math.pow(k,i)).toFixed(2)+' '+s[i]; }

  async analyzeSample() {
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

      // Analyze the spatial relationships
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
      document.getElementById('extract-btn').disabled = false;
      this.updateProgress(100, 'Pattern learned successfully');
      
    } catch(e) { 
      console.error(e); 
      this.showError('Failed to analyze pattern'); 
    }
  }

  analyzeLayout(questionBoxes, optionBoxes, blockBoxes) {
    if (questionBoxes.length === 0 || optionBoxes.length === 0) {
      return { type: 'simple', description: 'No clear question-option structure' };
    }

    const qBox = questionBoxes[0];
    const avgOptionY = optionBoxes.reduce((sum, opt) => sum + opt.y, 0) / optionBoxes.length;
    const avgOptionX = optionBoxes.reduce((sum, opt) => sum + opt.x, 0) / optionBoxes.length;

    // Determine if options are inline (same line) or multiline
    const isInline = Math.abs(qBox.y - avgOptionY) < qBox.height * 0.5;
    const isVertical = optionBoxes.every((opt, i, arr) => 
      i === 0 || opt.y > arr[i-1].y + arr[i-1].height * 0.3
    );

    return {
      type: isInline ? 'inline' : (isVertical ? 'vertical' : 'mixed'),
      questionToOptionsDistance: {
        x: avgOptionX - (qBox.x + qBox.width),
        y: avgOptionY - qBox.y
      },
      optionSpacing: this.calculateOptionSpacing(optionBoxes),
      description: isInline ? 'Options on same line as question' : 
                  (isVertical ? 'Options stacked vertically' : 'Mixed layout')
    };
  }

  calculateOptionSpacing(optionBoxes) {
    if (optionBoxes.length < 2) return { x: 0, y: 0 };
    
    const xSpacings = [];
    const ySpacings = [];
    
    for (let i = 1; i < optionBoxes.length; i++) {
      xSpacings.push(optionBoxes[i].x - optionBoxes[i-1].x);
      ySpacings.push(optionBoxes[i].y - optionBoxes[i-1].y);
    }
    
    return {
      x: xSpacings.reduce((a,b) => a+b, 0) / xSpacings.length,
      y: ySpacings.reduce((a,b) => a+b, 0) / ySpacings.length
    };
  }

  displayPatternResults(pattern) {
    document.getElementById('pattern-results').innerHTML = `
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
    if (!this.learnedPattern) {
      this.showError('Please analyze the sample pattern first');
      return;
    }

    this.enableStep(5);
    this.updateProgress(0, 'Starting extraction with pattern matching...');
    
    try {
      let results = '';
      
      if (this.processingMode === 'ocr') {
        results = await this.extractWithPatternOCR();
      } else {
        results = await this.extractWithPatternSelection();
      }

      this.updateProgress(60, 'Filtering with visual pattern...');
      const cleanText = this.filterByPattern(results);

      this.updateProgress(80, 'Parsing structured questions...');
      this.extractedQuestions = this.parseQuestions(cleanText);

      this.updateProgress(100, 'Extraction complete!');
      this.displayResults();
      this.enableStep(6);
      
    } catch(e){ 
      console.error(e); 
      this.showError('Extraction failed'); 
    }
  }

  async extractWithPatternOCR() {
    this.updateProgress(20, 'Running pattern-based OCR...');
    
    if (this.mainFile.type.startsWith('image/')) {
      // For images, apply pattern matching directly
      const result = await Tesseract.recognize(this.mainFile, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            this.updateProgress(20 + m.progress * 30, `OCR ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      return this.filterTextByPattern(result.data);
    } else {
      // For PDFs, OCR each page and apply pattern matching
      const pdf = await pdfjsLib.getDocument(URL.createObjectURL(this.mainFile)).promise;
      let results = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 2 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        const result = await Tesseract.recognize(canvas, 'eng');
        const filteredPageData = this.filterTextByPattern(result.data);
        results.push(filteredPageData.text);
        
        this.updateProgress(20 + (i / pdf.numPages) * 30, `OCR page ${i}/${pdf.numPages}`);
      }
      
      return results.join('\n');
    }
  }

  async extractWithPatternSelection() {
    this.updateProgress(30, 'Extracting with pattern matching...');
    
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(this.mainFile)).promise;
    let results = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Filter text items based on learned pattern
      const filteredItems = this.filterTextItemsByPattern(textContent.items);
      const pageText = filteredItems.map(item => item.str).join(' ');
      results.push(pageText);
      
      this.updateProgress(30 + (i / pdf.numPages) * 20, `Processing page ${i}/${pdf.numPages}`);
    }
    
    return results.join('\n');
  }

  filterTextByPattern(tesseractData) {
    // Use Tesseract's word-level data to match against learned pattern
    const words = tesseractData.words || [];
    const filteredWords = [];
    
    for (const word of words) {
      if (this.isWordInPatternRegion(word)) {
        filteredWords.push(word.text);
      } else {
        this.watermarksFiltered++;
      }
    }
    
    return filteredWords.join(' ');
  }

  filterTextItemsByPattern(textItems) {
    // For PDF text items, filter based on position matching learned pattern
    return textItems.filter(item => {
      const wordBox = {
        x: item.transform[4],
        y: item.transform[1],
        width: item.width,
        height: item.height
      };
      
      if (this.isWordInPatternRegion(wordBox)) {
        return true;
      } else {
        this.watermarksFiltered++;
        return false;
      }
    });
  }

  isWordInPatternRegion(wordOrBox) {
    // Check if word/box position matches any of the learned pattern regions
    const box = wordOrBox.bbox || wordOrBox;
    
    // Check against question regions
    for (const qBox of this.learnedPattern.questionBoxes) {
      if (this.isOverlapping(box, qBox, 0.1)) return true;
    }
    
    // Check against option regions  
    for (const oBox of this.learnedPattern.optionBoxes) {
      if (this.isOverlapping(box, oBox, 0.1)) return true;
    }
    
    // Check against block regions
    for (const bBox of this.learnedPattern.blockBoxes) {
      if (this.isOverlapping(box, bBox, 0.05)) return true;
    }
    
    return false;
  }

  isOverlapping(box1, box2, tolerance = 0) {
    const expandedBox2 = {
      x: box2.x - box2.width * tolerance,
      y: box2.y - box2.height * tolerance,
      width: box2.width * (1 + 2 * tolerance),
      height: box2.height * (1 + 2 * tolerance)
    };
    
    return !(box1.x > expandedBox2.x + expandedBox2.width ||
             box1.x + (box1.width || 0) < expandedBox2.x ||
             box1.y > expandedBox2.y + expandedBox2.height ||
             box1.y + (box1.height || 0) < expandedBox2.y);
  }

  filterByPattern(text) {
    // Additional text-based filtering using the learned pattern layout
    const lines = text.split('\n');
    const filtered = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 2) continue;
      
      // Basic watermark filtering (keeping existing logic)
      const keywords = ['watermark','sample','preview','demo','trial','confidential','copy'];
      if (keywords.some(k => trimmed.toLowerCase().includes(k))) {
        this.watermarksFiltered++;
        continue;
      }
      
      filtered.push(line);
    }
    
    return filtered.join('\n');
  }

  // Enhanced parser that uses pattern knowledge
  parseQuestions(text) {
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const questions = {};
    let curQ = '';
    let curOpts = [];
    let collecting = false;

    // Use pattern layout knowledge for better parsing
    const isInlineLayout = this.learnedPattern?.layout?.type === 'inline';
    
    const Q_START = /^(?:\s*(?:Q\s*|Question\s*)?\d+\s*[\.\):\-]|(?:\s*\d+\s*[\.\):\-]))/i;
    const OPT_TOKEN = /(?:^|\s)([a-dA-D])[\.:\)\]®]\s*/g;
    const STRICT_OPT_LINE = /^\s*([a-dA-D])[\.:\)\]®]\s*(.+?)\s*$/;

    const flush = () => {
      if (curQ) {
        const qClean = curQ.replace(/\s+/g, ' ').trim();
        if (qClean.length > 8) questions[qClean] = curOpts;
        curQ = ''; curOpts = [];
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
        indices.push({ idx: m.index, len: m.length, letter: m[2].toUpperCase() });
      }
      for (let i=0;i<indices.length;i++){
        const start = indices[i].idx + indices[i].len;
        const end = (i+1<indices.length) ? indices[i+1].idx : tail.length;
        const body = tail.slice(start, end).trim();
        const letter = indices[i].letter;
        if (body) opts.push([letter, body]);
      }
      return { rest, options: opts };
    };

    for (let i=0;i<lines.length;i++){
      const line = lines[i];

      const strict = line.match(STRICT_OPT_LINE);
      if (collecting && strict) { 
        curOpts.push([strict[1].toUpperCase(), strict[3].trim()]); 
        continue; 
      }

      if (Q_START.test(line)) {
        flush();
        collecting = true;
        const stripped = line.replace(Q_START, '').trim();
        
        if (isInlineLayout) {
          // For inline layouts, expect options on same line
          const { rest, options } = extractInlineOptions(stripped);
          curQ = rest || stripped;
          curOpts = options.length ? options : [];
        } else {
          // For vertical layouts, question is separate from options
          curQ = stripped;
          curOpts = [];
        }
        continue;
      }

      if (collecting) {
        const m1 = line.match(STRICT_OPT_LINE);
        if (m1) { 
          curOpts.push([m1[1].toUpperCase(), m1[3].trim()]); 
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
    return questions;
  }

  displayResults() {
    const qCount = Object.keys(this.extractedQuestions).length;
    const oCount = Object.values(this.extractedQuestions).reduce((s, o) => s + o.length, 0);

    document.getElementById('processing-stats').innerHTML = `
      <div class="stat-item"><div class="stat-value">${qCount}</div><div class="stat-label">Questions Found</div></div>
      <div class="stat-item"><div class="stat-value">${oCount}</div><div class="stat-label">Options Detected</div></div>
      <div class="stat-item"><div class="stat-value">${this.watermarksFiltered}</div><div class="stat-label">Content Filtered</div></div>`;

    this.displayQuestionsPreview();

    const list = Object.keys(this.extractedQuestions).map((q,i)=>`${i+1}. ${q}`).join('\n\n');
    document.getElementById('questions-list').textContent = list;

    const entries = Object.entries(this.extractedQuestions).map(([q,opts])=>{
      const body = opts.length ? `[${opts.map(([L,t]) => `("${L}", "${t.replace(/"/g,'\\"')}")`).join(', ')}]` : '[]';
      return `    "${q.replace(/"/g,'\\"')}": ${body}`;
    });
    const py = `{\n${entries.join(',\n')}\n}`;
    document.getElementById('questions-dict').textContent = py;
  }

  displayQuestionsPreview() {
    const preview = document.getElementById('questions-preview');
    preview.innerHTML = '';
    Object.entries(this.extractedQuestions).forEach(([q,opts],i)=>{
      const div = document.createElement('div'); div.className='question-item';
      const optHtml = opts.length ? `<div class="options-list">${opts.map(([L,t])=>`<div class="option-item">${L}. ${t}</div>`).join('')}</div>` : '<div class="options-list"><em>No options</em></div>';
      div.innerHTML = `<div class="question-text">${i+1}. ${q}</div>${optHtml}`;
      preview.appendChild(div);
    });
  }

  switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.toggle('active', c.id===`${tab}-tab`));
  }

  async copyToClipboard(type) {
    const text = type==='list' ? document.getElementById('questions-list').textContent : document.getElementById('questions-dict').textContent;
    try { await navigator.clipboard.writeText(text); this.showSuccess('Copied to clipboard!'); }
    catch { const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); this.showSuccess('Copied!'); }
  }

  downloadResults(fmt) {
    let content='', name='', mime='text/plain';
    if (fmt==='json'){ content = JSON.stringify(this.extractedQuestions, null, 2); name='extracted_questions.json'; mime='application/json'; }
    else { content = `# Extracted Questions\nquestions = ${document.getElementById('questions-dict').textContent}`; name='extracted_questions.py'; mime='text/x-python'; }
    const blob = new Blob([content],{type:mime}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  updateProgress(p, t) { 
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');
    if (fill) fill.style.width = p+'%'; 
    if (text) text.textContent = t; 
  }
  
  showSuccess(m){ 
    console.log('Success:', m);
    // You could add a toast notification here
  }
  
  showError(m){ 
    console.error('Error:', m);
    alert('Error: ' + m); // Simple error display
  }
}

document.addEventListener('DOMContentLoaded', () => new WorksheetExtractor());
