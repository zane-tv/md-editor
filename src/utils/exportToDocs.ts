import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import html2canvas from 'html2canvas';
import { gapi } from 'gapi-script';

async function uploadImageToDrive(blob: Blob): Promise<string> {
  const accessToken = (gapi.auth as any).getToken().access_token;
  
  const metadata = {
    name: `asset-${Date.now()}.png`,
    mimeType: 'image/png',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  });

  if (!response.ok) {
    throw new Error('Failed to upload image to Drive');
  }

  const data = await response.json();
  
  // Make public so Docs can read it
  await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: 'POST',
    headers: new Headers({ 
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone'
    }),
  });

  return `https://drive.google.com/uc?export=view&id=${data.id}`;
}

// Generic capture function
async function captureElement(selector: string, index: number): Promise<Blob> {
  const elements = document.querySelectorAll(selector);
  if (!elements[index]) throw new Error(`Element ${selector} at index ${index} not found`);
  
  const canvas = await html2canvas(elements[index] as HTMLElement, {
    backgroundColor: '#ffffff',
    scale: 2, // High quality
    useCORS: true
  });
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas to Blob failed'));
    }, 'image/png');
  });
}

export async function exportMarkdownToDocs(markdown: string, title: string) {
  // 1. Create Doc
  const createResponse = await (gapi.client as any).docs.documents.create({ title });
  const documentId = createResponse.result.documentId;
  if (!documentId) throw new Error('Failed to create document');

  // 2. Parse AST
  const processor = unified().use(remarkParse).use(remarkGfm);
  const tree = processor.parse(markdown);

  // 3. Identify Nodes to Capture (Mermaid & Table)
  const mermaidNodes: any[] = [];
  const tableNodes: any[] = [];
  
  const findNodes = (node: any) => {
    if (node.type === 'code' && node.lang === 'mermaid') {
      mermaidNodes.push(node);
    } else if (node.type === 'table') {
      tableNodes.push(node);
    }
    if (node.children) node.children.forEach(findNodes);
  };
  findNodes(tree);

  // 4. Capture & Upload Images
  const nodeImageMap = new Map<any, string>();

  // Process Mermaids
  for (let i = 0; i < mermaidNodes.length; i++) {
    try {
      const blob = await captureElement('.mermaid-wrapper', i);
      const url = await uploadImageToDrive(blob);
      nodeImageMap.set(mermaidNodes[i], url);
    } catch (e) {
      console.error('Mermaid capture failed:', e);
    }
  }

  // Process Tables
  for (let i = 0; i < tableNodes.length; i++) {
    try {
      const blob = await captureElement('.table-wrapper', i);
      const url = await uploadImageToDrive(blob);
      nodeImageMap.set(tableNodes[i], url);
    } catch (e) {
      console.error('Table capture failed:', e);
    }
  }

  // 5. Generate Requests
  const requests: any[] = [];
  let currentIndex = 1;

  function processNode(node: any) {
    if (node.type === 'root') {
      node.children.forEach(processNode);
    } 
    // --- HEADINGS ---
    else if (node.type === 'heading') {
      const start = currentIndex;
      node.children.forEach(processNode);
      const end = currentIndex;
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: { namedStyleType: `HEADING_${Math.min(node.depth, 6)}` },
          fields: 'namedStyleType'
        }
      });
      requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
      currentIndex += 1;
    } 
    // --- PARAGRAPHS ---
    else if (node.type === 'paragraph') {
      // Avoid double newline if inside list
      node.children.forEach(processNode);
      requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
      currentIndex += 1;
    } 
    // --- TEXT ---
    else if (node.type === 'text') {
      const text = node.value;
      requests.push({ insertText: { location: { index: currentIndex }, text } });
      currentIndex += text.length;
    } 
    // --- FORMATTING ---
    else if (node.type === 'strong' || node.type === 'emphasis') {
      const start = currentIndex;
      node.children.forEach(processNode);
      const end = currentIndex;
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end },
          textStyle: node.type === 'strong' ? { bold: true } : { italic: true },
          fields: node.type === 'strong' ? 'bold' : 'italic'
        }
      });
    }
    // --- LINK ---
    else if (node.type === 'link') {
      const start = currentIndex;
      node.children.forEach(processNode);
      const end = currentIndex;
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end },
          textStyle: { link: { url: node.url } },
          fields: 'link'
        }
      });
    }
    // --- LISTS ---
    else if (node.type === 'list') {
      node.children.forEach(processNode);
    } else if (node.type === 'listItem') {
      requests.push({ insertText: { location: { index: currentIndex }, text: '• ' } });
      currentIndex += 2;
      node.children.forEach(processNode);
      // Ensure list item ends with newline if not already
      // Simplified list handling
    }
    // --- IMAGES (Standard MD Images) ---
    else if (node.type === 'image') {
        // Standard MD images are tricky if they are local. If external URL, we can try to insert.
        // For simplicity, we just insert the alt text for now or try to insert if it's a valid URL.
        if (node.url && node.url.startsWith('http')) {
             requests.push({
                insertInlineImage: {
                    location: { index: currentIndex },
                    uri: node.url,
                    objectSize: {
                        height: { magnitude: 300, unit: 'PT' },
                        width: { magnitude: 400, unit: 'PT' }
                    }
                }
            });
            currentIndex += 1;
        } else {
            const text = `[Image: ${node.alt}]`;
            requests.push({ insertText: { location: { index: currentIndex }, text } });
            currentIndex += text.length;
        }
    }
    // --- CODE BLOCKS (Mermaid or Regular) ---
    else if (node.type === 'code') {
      if (node.lang === 'mermaid') {
        const url = nodeImageMap.get(node);
        if (url) {
            insertImage(url);
        }
      } else {
        const text = node.value;
        const start = currentIndex;
        requests.push({ insertText: { location: { index: currentIndex }, text: text + '\n' } });
        currentIndex += text.length + 1;
        requests.push({
            updateTextStyle: {
                range: { startIndex: start, endIndex: currentIndex - 1 },
                textStyle: { 
                    weightedFontFamily: { fontFamily: 'Courier New' },
                    backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } } }
                },
                fields: 'weightedFontFamily,backgroundColor'
            }
        });
      }
    }
    // --- TABLES (Rendered as Image) ---
    else if (node.type === 'table') {
        const url = nodeImageMap.get(node);
        if (url) {
            insertImage(url);
        } else {
            // Fallback if capture failed
            requests.push({ insertText: { location: { index: currentIndex }, text: '[Table - Export Failed]\n' } });
            currentIndex += 24;
        }
    }
  }

  function insertImage(url: string) {
    requests.push({
        insertInlineImage: {
            location: { index: currentIndex },
            uri: url,
            objectSize: {
                height: { magnitude: 300, unit: 'PT' }, // Default size, user can resize in Docs
                width: { magnitude: 500, unit: 'PT' }
            }
        }
    });
    currentIndex += 1; // Image is 1 unit
    requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
    currentIndex += 1;
  }

  processNode(tree);

  if (requests.length > 0) {
    await (gapi.client as any).docs.documents.batchUpdate({
      documentId,
      resource: { requests }
    });
  }

  return documentId;
}