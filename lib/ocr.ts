import Tesseract from 'tesseract.js';

export async function extractTextFromImage(file: File): Promise<string> {
  try {
    const result = await Tesseract.recognize(
      file,
      'eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      }
    );
    
    // Post-process the text to fix common OCR errors
    let text = result.data.text;
    
    // Common OCR substitutions for workout screen text
    text = text.replace(/\bO\b/g, '0'); // Letter O -> Zero
    text = text.replace(/\bl\b/gi, '1'); // Letter l/I -> One (in number contexts)
    text = text.replace(/\bS\b/g, '5'); // Letter S -> Five (when isolated)
    text = text.replace(/hike/gi, 'bike'); // Common misread
    
    // Try to extract numbers more aggressively using word-level data
    // This helps when layout is complex (like treadmill overlays)
    const words = result.data.words || [];
    const extractedNumbers: string[] = [];
    
    for (const word of words) {
      const wordText = word.text;
      // Look for time patterns (XX:XX)
      const timeMatch = wordText.match(/(\d{1,3}):(\d{2})/);
      if (timeMatch) {
        extractedNumbers.push(wordText);
      }
      // Look for standalone numbers
      const numMatch = wordText.match(/^\d{2,4}$/);
      if (numMatch) {
        extractedNumbers.push(wordText);
      }
    }
    
    // Append extracted numbers to help parser
    if (extractedNumbers.length > 0) {
      text += '\n\nExtracted numbers: ' + extractedNumbers.join(', ');
    }
    
    console.log('Extracted text:', text);
    
    return text;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('Failed to extract text from image');
  }
}
