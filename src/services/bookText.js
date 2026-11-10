// Browser-side reading of an uploaded book file. TXT/MD are read directly; PDFs are parsed with pdf.js.
import { splitSections } from './bookGenerator.js';

export const MAX_BYTES = 30 * 1024 * 1024;
export const MAX_PDF_PAGES = 600;

/** Resolves to { title, sections:[{index,label,text}] } or throws Error with a user-friendly message. */
export async function readBookFile(file) {
  const name = file.name || 'Book';
  const title = name.replace(/\.[^.]+$/, '');
  if (file.size > MAX_BYTES) throw new Error('That file is larger than 30 MB. Upload a smaller file or one chapter at a time.');
  if (/\.(txt|md)$/i.test(name)) {
    const text = await file.text();
    if (!text.trim()) throw new Error('That file is empty.');
    return { title, sections: splitSections(text) };
  }
  if (/\.pdf$/i.test(name)) {
    const pdfjs = await import('pdfjs-dist/build/pdf');
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.js?url')).default;
    let pdf;
    try { pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
    catch { throw new Error('This PDF couldn’t be opened. It may be damaged or password-protected.'); }
    const sections = [];
    for (let i = 1; i <= Math.min(pdf.numPages, MAX_PDF_PAGES); i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      sections.push({ index: i - 1, label: `Page ${i}`, text: content.items.map((it) => it.str).join(' ') });
    }
    if (sections.every((s) => s.text.trim().length < 20)) throw new Error('No readable text was found. This looks like a scanned PDF — it needs OCR before questions can be generated.');
    return { title, sections };
  }
  throw new Error('Unsupported file type. Upload a .pdf, .txt or .md file, or paste the text.');
}
