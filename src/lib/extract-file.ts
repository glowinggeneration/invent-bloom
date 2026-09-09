export type ExtractedFile = {
  name: string;
  kind: "image" | "document";
  /** Data URL - only for images. */
  dataUrl?: string;
  /** Plain-text excerpt - only for documents. */
  excerpt?: string;
};

const MAX_CHARS = 12000;

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await readAsArrayBuffer(file) }).promise;
  const pages: string[] = [];
  const limit = Math.min(doc.numPages, 30);
  for (let i = 1; i <= limit; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " "),
    );
  }
  return pages.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const result = await mammoth.extractRawText({ arrayBuffer: await readAsArrayBuffer(file) });
  return result.value;
}

async function extractSheet(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(await readAsArrayBuffer(file), { type: "array" });
  return book.SheetNames.map((name) => {
    const sheet = book.Sheets[name];
    if (!sheet) return "";
    return `# ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`;
  }).join("\n\n");
}

export async function extractFile(file: File): Promise<ExtractedFile> {
  const lower = file.name.toLowerCase();

  if (file.type.startsWith("image/")) {
    return { name: file.name, kind: "image", dataUrl: await readAsDataUrl(file) };
  }

  let text = "";
  if (lower.endsWith(".pdf")) text = await extractPdf(file);
  else if (lower.endsWith(".docx")) text = await extractDocx(file);
  else if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv"))
    text = await extractSheet(file);
  else text = await file.text();

  const trimmed = text.replace(/\n{3,}/g, "\n\n").trim();
  if (!trimmed) throw new Error(`No readable text found in ${file.name}`);
  return { name: file.name, kind: "document", excerpt: trimmed.slice(0, MAX_CHARS) };
}
