class WorksheetExtractor {
  constructor() {
    this.mainFile = null;
    this.sampleFile = null;
    this.processingMode = null;

    this.questionPattern = null;
    this.mcqPattern = null;

    this.extractedQuestions = {};
    this.watermarksFiltered = 0;

    // Robust regexes
    this.Q_START = /^(?:\s*(?:Q\s*|Question\s*)?\d+\s*[\.\):\-]|(?:\s*\d+\s*[\.\):\-]))/i;
    this.OPT_TOKEN = /(?:^|\s)([a-dA-D])[\.:\)\]®]\s*/g;               // a. a) a: a®
    this.STRICT_OPT_LINE = /^\s*([a-dA-D])[\.:\)\]®]\s*(.+?)\s*$/;     // whole line option

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
    mainFile.addEventListener('change', (e) => { if (e.target.files.length > 0) this.handleMainFile(e.target.files[0]); });

    const sampleUpload = document.getElementById('sample-upload');
    const sampleFile = document.getElementById('sample-file');

    sampleUpload.addEventListener('click', () => sampleFile.click());
    sampleUpload.addEventListener('dragover', (e) => { e.preventDefault(); sampleUpload.classList.add('dragover'); });
    sampleUpload.addEventListener('dragleave', () => sampleUpload.classList.remove('dragover'));
    sampleUpload.addEventListener('drop', (e) => {
      e.preventDefault(); sampleUpload.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) this.handleSampleFile(e.dataTransfer.files[0]);
    });
    sampleFile.addEventListener('change', (e) => { if (e.target.files.length > 0) this.handleSampleFile(e.target.files[0]); });
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
    this.showFilePreview('sample-preview', file);
    document.getElementById('analyze-sample').disabled = false;
  }

  showFilePreview(id, file) {
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
    if (!this.sampleFile) return;
    this.updateProgress(10, 'Analyzing sample pattern...');
    try {
      // simple defaults; could be enhanced by OCRing sample
      this.questionPattern = /(\d+[\.:\)]\s*|Q\s*\d+[:\.)]\s*|Question\s+\d+[:\.)]\s*)/i;
      this.mcqPattern = /^[a-dA-D][\.:\)\]®]\s*/;
      this.displayPatternResults({question:this.questionPattern, mcq:this.mcqPattern});
      this.enableStep(4);
      document.getElementById('extract-btn').disabled = false;
      this.updateProgress(100, 'Pattern analysis complete');
    } catch(e) { console.error(e); this.showError('Failed to analyze sample'); }
  }

  displayPatternResults(p) {
    document.getElementById('pattern-results').innerHTML = `
      <div class="pattern-info">
        <h4>✅ Pattern Analysis Ready</h4>
        <p><strong>Question marker:</strong> ${p.question}</p>
        <p><strong>Option marker:</strong> a./b.)/c:/d® (lower/upper)</p>
        <p><strong>Watermark filtering:</strong> enabled</p>
      </div>`;
  }

  async extractQuestions() {
    this.enableStep(5);
    this.updateProgress(0, 'Starting extraction...');
    try {
      let text = '';
      if (this.processingMode === 'ocr') text = await this.extractWithOCR();
      else text = await this.extractWithTextSelection();

      this.updateProgress(60, 'Filtering watermarks...');
      const clean = this.filterWatermarks(text);

      this.updateProgress(80, 'Parsing questions and options...');
      this.extractedQuestions = this.parseQuestions(clean);

      this.updateProgress(100, 'Extraction complete!');
      this.displayResults();
      this.enableStep(6);
    } catch(e){ console.error(e); this.showError('Extraction failed'); }
  }

  async extractWithOCR() {
    this.updateProgress(20, 'Running OCR...');
    if (this.mainFile.type.startsWith('image/')) {
      const r = await Tesseract.recognize(this.mainFile, 'eng', { logger: m => { if (m.status==='recognizing text') this.updateProgress(20 + m.progress*30, `OCR ${Math.round(m.progress*100)}%`); } });
      return r.data.text;
    } else {
      const pdf = await pdfjsLib.getDocument(URL.createObjectURL(this.mainFile)).promise;
      let out = '';
      for (let i=1;i<=pdf.numPages;i++){
        const page = await pdf.getPage(i);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 2 });
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const r = await Tesseract.recognize(canvas, 'eng');
        out += r.data.text + '\n';
        this.updateProgress(20 + (i/pdf.numPages)*30, `OCR page ${i}/${pdf.numPages}`);
      }
      return out;
    }
  }

  async extractWithTextSelection() {
    this.updateProgress(30, 'Extracting text from PDF...');
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(this.mainFile)).promise;
    let out = '';
    for (let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      out += tc.items.map(it=>it.str).join(' ') + '\n';
      this.updateProgress(30 + (i/pdf.numPages)*20, `Processing page ${i}/${pdf.numPages}`);
    }
    return out;
  }

  filterWatermarks(text) {
    const sensitivity = document.getElementById('filter-slider').value / 100;
    const lines = text.split('\n');
    const filtered = [];
    const keywords = ['watermark','sample','preview','demo','trial','confidential','copy'];
    const counts = {};
    lines.forEach(l => { const t=l.trim().toLowerCase(); if (t.length>3) counts[t]=(counts[t]||0)+1; });

    for (const line of lines) {
      const t = line.trim().toLowerCase();
      if (t.length < 2) continue;
      if (keywords.some(k => t.includes(k))) { this.watermarksFiltered++; continue; }
      if (counts[t] > Math.max(2, 5*sensitivity)) { this.watermarksFiltered++; continue; }
      if (line === line.toUpperCase() && line.length < 25 && line.length > 4) { this.watermarksFiltered++; continue; }
      filtered.push(line);
    }
    return filtered.join('\n');
  }

  // -------- FIXED PARSER --------
  parseQuestions(text) {
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);

    const questions = {};
    let curQ = '';
    let curOpts = [];
    let collecting = false;

    const flush = () => {
      if (curQ) {
        const qClean = curQ.replace(/\s+/g, ' ').trim();
        if (qClean.length > 8) questions[qClean] = curOpts;
        curQ = ''; curOpts = [];
      }
    };

    const extractInlineOptions = (s) => {
      const opts = [];
      // Find index of first option token
      this.OPT_TOKEN.lastIndex = 0;
      let firstMatch = this.OPT_TOKEN.exec(s);
      if (!firstMatch) return { rest: s.trim(), options: [] };

      const tokenStart = firstMatch.index + (firstMatch[0].startsWith(' ') ? 1 : 0);
      const rest = s.slice(0, tokenStart).trim();
      const tail = s.slice(tokenStart);

      // Split tail into labeled options
      const indices = [];
      this.OPT_TOKEN.lastIndex = 0;
      let m;
      while ((m = this.OPT_TOKEN.exec(tail)) !== null) {
        indices.push({ idx: m.index, len: m[0].length, letter: m[1].toUpperCase() });
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

      // line is a single option (e.g., "a. the")
      const strict = line.match(this.STRICT_OPT_LINE);
      if (collecting && strict) { curOpts.push([strict[1].toUpperCase(), strict[2].trim()]); continue; }

      // new question start
      if (this.Q_START.test(line)) {
        flush();
        collecting = true;
        const stripped = line.replace(this.Q_START, '').trim();
        const { rest, options } = extractInlineOptions(stripped);
        curQ = rest || stripped;
        curOpts = options.length ? options : [];
        continue;
      }

      // continuation
      if (collecting) {
        const m1 = line.match(this.STRICT_OPT_LINE);
        if (m1) { curOpts.push([m1[1].toUpperCase(), m1[2].trim()]); continue; }

        const { rest, options } = extractInlineOptions(line);
        if (options.length) {
          if (rest && curOpts.length === 0) curQ = (curQ + ' ' + rest).trim();
          curOpts.push(...options);
          continue;
        }

        if (curOpts.length === 0 && line.length > 5 && !/^(page|section)\b/i.test(line)) {
          curQ = (curQ + ' ' + line).trim();
        }
        continue;
      }
    }

    flush();
    return questions;
  }
  // -------- END FIXED PARSER --------

  displayResults() {
    const qCount = Object.keys(this.extractedQuestions).length;
    const oCount = Object.values(this.extractedQuestions).reduce((s, o) => s + o.length, 0);

    document.getElementById('processing-stats').innerHTML = `
      <div class="stat-item"><div class="stat-value">${qCount}</div><div class="stat-label">Questions Found</div></div>
      <div class="stat-item"><div class="stat-value">${oCount}</div><div class="stat-label">Options Detected</div></div>
      <div class="stat-item"><div class="stat-value">${this.watermarksFiltered}</div><div class="stat-label">Watermarks Filtered</div></div>`;

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
    catch { const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); this.showSuccess('Copied to clipboard!'); }
  }

  downloadResults(fmt) {
    let content='', name='', mime='text/plain';
    if (fmt==='json'){ content = JSON.stringify(this.extractedQuestions, null, 2); name='extracted_questions.json'; mime='application/json'; }
    else { content = `# Extracted Questions\nquestions = ${document.getElementById('questions-dict').textContent}`; name='extracted_questions.py'; mime='text/x-python'; }
    const blob = new Blob([content],{type:mime}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  updateProgress(p, t) { document.getElementById('progress-fill').style.width = p+'%'; document.getElementById('progress-text').textContent = t; }
  showSuccess(m){ console.log('Success:', m); }
  showError(m){ console.error('Error:', m); }
}

document.addEventListener('DOMContentLoaded', () => new WorksheetExtractor());
