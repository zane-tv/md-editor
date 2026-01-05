import { unified } from 'unified';
import remarkParse from 'remark-parse';
import html2canvas from 'html2canvas';
import { gapi } from 'gapi-script';

async function uploadImageToDrive(blob: Blob): Promise<string> {
  const metadata = {
    name: `chart-${Date.now()}.png`,
    mimeType: 'image/png',
  };

  const accessToken = (gapi.auth as any).getToken().access_token;
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  });

  const data = await response.json();
  if (!data.id) throw new Error('Failed to upload image');

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

async function captureMermaidChart(index: number): Promise<Blob> {
  const elements = document.querySelectorAll('.mermaid-wrapper');
  if (!elements[index]) throw new Error(`Mermaid chart at index ${index} not found`);
  
  const canvas = await html2canvas(elements[index] as HTMLElement, {
    backgroundColor: '#ffffff',
    scale: 2
  });
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas to Blob failed'));
    }, 'image/png');
  });
}

export async function exportMarkdownToDocs(markdown: string, title: string) {
  const createResponse = await (gapi.client as any).docs.documents.create({ title });
  const documentId = createResponse.result.documentId;
  if (!documentId) throw new Error('Failed to create document');

  const processor = unified().use(remarkParse);
  const tree = processor.parse(markdown);

  const requests: any[] = [];
  let currentIndex = 1;

  const mermaidNodes: any[] = [];
  const findMermaid = (node: any) => {
    if (node.type === 'code' && node.lang === 'mermaid') mermaidNodes.push(node);
    if (node.children) node.children.forEach(findMermaid);
  };
  findMermaid(tree);

  const mermaidImages = new Map<any, string>();
  for (let i = 0; i < mermaidNodes.length; i++) {
    try {
      const blob = await captureMermaidChart(i);
      const url = await uploadImageToDrive(blob);
      mermaidImages.set(mermaidNodes[i], url);
    } catch (e) {
      console.error('Failed to process mermaid chart', e);
    }
  }

  function processNode(node: any) {
    if (node.type === 'root') {
      node.children.forEach(processNode);
    } else if (node.type === 'heading') {
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
    } else if (node.type === 'paragraph') {
      node.children.forEach(processNode);
      requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
      currentIndex += 1;
    } else if (node.type === 'text') {
      const text = node.value;
      requests.push({ insertText: { location: { index: currentIndex }, text } });
      currentIndex += text.length;
    } else if (node.type === 'strong') {
      const start = currentIndex;
      node.children.forEach(processNode);
      const end = currentIndex;
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end },
          textStyle: { bold: true },
          fields: 'bold'
        }
      });
    } else if (node.type === 'emphasis') {
      const start = currentIndex;
      node.children.forEach(processNode);
      const end = currentIndex;
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end },
          textStyle: { italic: true },
          fields: 'italic'
        }
      });
    } else if (node.type === 'link') {
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
    } else if (node.type === 'list') {
        node.children.forEach(processNode);
    } else if (node.type === 'listItem') {
        requests.push({ insertText: { location: { index: currentIndex }, text: '• ' } });
        currentIndex += 2;
        node.children.forEach(processNode);
        requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
        currentIndex += 1;
    } else if (node.type === 'code') {
      if (node.lang === 'mermaid') {
        const url = mermaidImages.get(node);
        if (url) {
            requests.push({
                insertInlineImage: {
                    location: { index: currentIndex },
                    uri: url,
                    objectSize: {
                        height: { magnitude: 300, unit: 'PT' },
                        width: { magnitude: 500, unit: 'PT' }
                    }
                }
            });
            currentIndex += 1;
            requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
            currentIndex += 1;
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
