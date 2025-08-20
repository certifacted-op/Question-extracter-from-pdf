# Worksheet Question Extractor

A powerful static web application that extracts questions and multiple choice options from worksheets using OCR and pattern recognition.

## Features

- **Multiple Input Formats**: Supports PDF and image files
- **Dual Processing Modes**: Text selection for digital PDFs, OCR for scanned documents/images  
- **Smart Pattern Recognition**: Uses sample analysis to detect question and MCQ patterns
- **Advanced Watermark Filtering**: Automatically removes watermarks and repeated text
- **Flexible Output**: Provides results as readable preview, question list, and Python dictionary

## Quick Setup for GitHub Pages

1. **Create a new repository on GitHub**
2. **Upload these 4 files to the repository root:**
   - `index.html`
   - `styles.css` 
   - `script.js`
   - `README.md` (this file)
3. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Select "Deploy from a branch" → "main" → "/ (root)"
   - Click Save
4. **Your app will be live at:** `https://yourusername.github.io/your-repo-name`

## How to Use

### Step 1: Upload Worksheet
- Drop your PDF or image file into the upload zone
- Supports PDF, PNG, JPG formats

### Step 2: Select Processing Mode
- **Text Selection Mode**: For PDFs with selectable text (faster)
- **OCR Mode**: For scanned documents and images (slower but works with any format)

### Step 3: Upload Sample Pattern
- Provide a sample screenshot showing:
  - How questions are formatted
  - Question numbering (1., Q1, etc.)
  - MCQ options format (A., B., C., D.)

### Step 4: Analyze Pattern
- Adjust detection sensitivity and watermark filter strength
- System will analyze your sample to understand the format

### Step 5: Extract Questions
- Processing will run automatically
- Progress bar shows current status
- Watermarks are filtered out during processing

### Step 6: Download Results
- View results in three formats:
  - **Preview**: Human-readable question list
  - **Question List**: Simple numbered list
  - **Python Dict**: Ready-to-use Python dictionary format

## Output Format

The tool generates a Python dictionary in this format:

```python
{
    "What is the capital of France?": [
        ("A", "London"),
        ("B", "Berlin"), 
        ("C", "Paris"),
        ("D", "Madrid")
    ],
    "Solve for x: 2x + 5 = 15": [
        ("A", "x = 5"),
        ("B", "x = 10"),
        ("C", "x = 7.5"),
        ("D", "x = 2.5")
    ],
    "Question without options": []
}
```

## Watermark Filtering

The system automatically detects and removes:
- Repeated text patterns across the document
- Low-contrast or faded text (typical of watermarks)
- Text containing watermark keywords (sample, preview, demo, etc.)
- Very short repetitive phrases
- All-caps text in unusual positions

## Technical Details

### Libraries Used
- **PDF.js**: For PDF processing and text extraction
- **Tesseract.js**: OCR engine for image text recognition
- **OpenCV.js**: Computer vision for pattern detection (optional)

### Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support  
- Safari: Full support (iOS 12+)
- All modern browsers with WebAssembly support

### Performance Notes
- Text selection mode: Very fast, works instantly
- OCR mode: Slower, depends on document size and device performance
- Large PDFs: Process one page at a time to avoid memory issues

## Troubleshooting

### Common Issues

**"Libraries not loading"**
- Check internet connection
- Try refreshing the page
- Ensure you're using a modern browser

**"OCR not working"**
- Make sure images are clear and readable
- Try increasing the detection sensitivity
- For scanned PDFs, use OCR mode instead of text selection

**"Too many watermarks detected"**
- Lower the watermark filter sensitivity
- Check if legitimate text is being filtered
- Try a different sample pattern

**"Questions not detected properly"**
- Upload a clearer sample showing question format
- Ensure question numbers are visible in sample
- Try adjusting detection sensitivity

### File Size Limits
- Images: Up to 10MB recommended
- PDFs: Up to 20MB recommended  
- Larger files may work but will be slower

## Development

### Local Development
1. Clone the repository
2. Open `index.html` in a modern browser
3. Or use a local server: `python -m http.server 8000`

### Customizing
- Modify `styles.css` for appearance changes
- Update `script.js` for functionality changes
- No build process required - pure client-side application

## Privacy & Security

- **No data leaves your device**: All processing happens in your browser
- **No uploads to servers**: Files are processed locally
- **No tracking**: No analytics or data collection
- **Open source**: All code is visible and auditable

## License

This project is open source. Feel free to use, modify, and distribute.

## Contributing

1. Fork the repository
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Create an issue in the GitHub repository
3. Include your browser, file type, and error details