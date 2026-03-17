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
    
    console.log('Extracted text:', text);
    
    return text;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('Failed to extract text from image');
  }
}
