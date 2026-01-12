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

// Exported for testing/reusability
export function generateGoogleDocsRequests(tree: any, nodeImageMap: Map<any, string>) {
  const requests: any[] = [];
  let currentIndex = 1;
  const tableNodes: any[] = [];
  const TABLE_PLACEHOLDER_PREFIX = '{{TABLE_PLACEHOLDER_';
  const TABLE_PLACEHOLDER_SUFFIX = '}}';

  function processNode(node: any) {
    if (node.type === 'root') {
      node.children.forEach(processNode);
    }
    // --- HEADINGS ---
    else if (node.type === 'heading') {
      const start = currentIndex;
      node.children.forEach(processNode);

      // Insert newline immediately
      requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
      currentIndex += 1;

      const end = currentIndex;

      // Apply Semantic Style (HEADING_X)
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end }, // Includes newline
          paragraphStyle: { namedStyleType: `HEADING_${Math.min(node.depth, 6)}` },
          fields: 'namedStyleType'
        }
      });

      // Apply Visual Style (Sync with Markdown Preview)
      // Defaults based on Tailwind Prose (approximate PT sizes)
      const fontSizeMap: Record<number, number> = { 1: 26, 2: 20, 3: 16, 4: 14, 5: 12, 6: 11 };

      requests.push({
         updateTextStyle: {
            range: { startIndex: start, endIndex: end }, // Includes newline
            textStyle: {
                fontSize: { magnitude: fontSizeMap[node.depth] || 11, unit: 'PT' },
                bold: true,
            },
            fields: 'fontSize,bold'
         }
      });
    }
    // --- PARAGRAPHS ---
    else if (node.type === 'paragraph') {
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
    }
    // --- IMAGES ---
    else if (node.type === 'image') {
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
    // --- CODE BLOCKS ---
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
    // --- TABLES ---
    else if (node.type === 'table') {
        const tableIndex = tableNodes.length;
        tableNodes.push(node);
        const placeholder = `${TABLE_PLACEHOLDER_PREFIX}${tableIndex}${TABLE_PLACEHOLDER_SUFFIX}`;
        requests.push({ insertText: { location: { index: currentIndex }, text: placeholder } });
        currentIndex += placeholder.length;
        requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
        currentIndex += 1;
    }
  }

  function insertImage(url: string) {
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

  processNode(tree);
  return { requests, tableNodes, TABLE_PLACEHOLDER_PREFIX, TABLE_PLACEHOLDER_SUFFIX };
}

export async function exportMarkdownToDocs(markdown: string, title: string) {
  // 1. Create Doc
  const createResponse = await (gapi.client as any).docs.documents.create({ title });
  const documentId = createResponse.result.documentId;
  if (!documentId) throw new Error('Failed to create document');

  // 2. Parse AST
  const processor = unified().use(remarkParse).use(remarkGfm);
  const tree = processor.parse(markdown);

  // 3. Identify Nodes to Capture (Mermaid Only)
  const mermaidNodes: any[] = [];
  const findNodes = (node: any) => {
    if (node.type === 'code' && node.lang === 'mermaid') {
      mermaidNodes.push(node);
    }
    if (node.children) node.children.forEach(findNodes);
  };
  findNodes(tree);

  // 4. Capture & Upload Images
  const nodeImageMap = new Map<any, string>();
  for (let i = 0; i < mermaidNodes.length; i++) {
    try {
      const blob = await captureElement('.mermaid-wrapper', i);
      const url = await uploadImageToDrive(blob);
      nodeImageMap.set(mermaidNodes[i], url);
    } catch (e) {
      console.error('Mermaid capture failed:', e);
    }
  }

  // 5. Generate Requests
  const { requests, tableNodes, TABLE_PLACEHOLDER_PREFIX, TABLE_PLACEHOLDER_SUFFIX } = generateGoogleDocsRequests(tree, nodeImageMap);

  // EXECUTE FIRST BATCH
  if (requests.length > 0) {
    await (gapi.client as any).docs.documents.batchUpdate({
      documentId,
      resource: { requests }
    });
  }

  // 6. Second Pass - Create Tables
  if (tableNodes.length > 0) {
      // Logic for second pass (same as before)
      const docResponse = await (gapi.client as any).docs.documents.get({ documentId });
      const docContent = docResponse.result.body.content;
      const tableLocations: { index: number, startIndex: number }[] = [];

      const findPlaceholders = (elements: any[]) => {
          elements.forEach(el => {
              if (el.paragraph && el.paragraph.elements) {
                  el.paragraph.elements.forEach((textRun: any) => {
                      if (textRun.textRun && textRun.textRun.content) {
                          const content = textRun.textRun.content;
                          if (content.includes(TABLE_PLACEHOLDER_PREFIX)) {
                              const regex = new RegExp(`${TABLE_PLACEHOLDER_PREFIX}(\\d+)${TABLE_PLACEHOLDER_SUFFIX}`, 'g');
                              let match;
                              while ((match = regex.exec(content)) !== null) {
                                  const absoluteIndex = textRun.startIndex + match.index;
                                  tableLocations.push({
                                      index: parseInt(match[1]),
                                      startIndex: absoluteIndex
                                  });
                              }
                          }
                      }
                  });
              } else if (el.table && el.table.tableRows) {
                  el.table.tableRows.forEach((row: any) => {
                      row.tableCells.forEach((cell: any) => {
                          findPlaceholders(cell.content);
                      });
                  });
              }
          });
      };
      
      findPlaceholders(docContent);
      tableLocations.sort((a, b) => b.startIndex - a.startIndex);

      const createTableRequests: any[] = [];
      tableLocations.forEach(loc => {
          const tableNode = tableNodes[loc.index];
          const rows = tableNode.children.length;
          const cols = tableNode.children[0]?.children.length || 0;
          const placeholderLen = `${TABLE_PLACEHOLDER_PREFIX}${loc.index}${TABLE_PLACEHOLDER_SUFFIX}`.length;

          createTableRequests.push({
              deleteContentRange: { range: { startIndex: loc.startIndex, endIndex: loc.startIndex + placeholderLen } }
          });

          createTableRequests.push({
              insertTable: { location: { index: loc.startIndex }, rows: rows, columns: cols }
          });
      });

      if (createTableRequests.length > 0) {
        await (gapi.client as any).docs.documents.batchUpdate({
            documentId,
            resource: { requests: createTableRequests }
        });
      }

      // 7. Third Pass - Populate Tables
      const docResponse2 = await (gapi.client as any).docs.documents.get({ documentId });
      const docTables: any[] = [];
      const findTables = (elements: any[]) => {
          elements.forEach(el => { if (el.table) docTables.push(el.table); });
      };
      findTables(docResponse2.result.body.content);

      if (docTables.length === tableNodes.length) {
          const populationRequests: any[] = [];
          for (let i = docTables.length - 1; i >= 0; i--) {
              const docTable = docTables[i];
              const tableNode = tableNodes[i];
              const rows = tableNode.children.length;
              const cols = tableNode.children[0]?.children.length || 0;

              for (let r = rows - 1; r >= 0; r--) {
                  const rowNode = tableNode.children[r];
                  const docRow = docTable.tableRows[r];
                  for (let c = cols - 1; c >= 0; c--) {
                      const cellNode = rowNode.children[c];
                      const docCell = docRow.tableCells[c];
                      const firstContent = docCell.content[0];
                      if (firstContent && firstContent.paragraph) {
                          let localCursor = firstContent.startIndex;
                          const processCellNode = (n: any) => {
                             if (n.type === 'text') {
                                 const text = n.value;
                                 populationRequests.push({ insertText: { location: { index: localCursor }, text } });
                                 localCursor += text.length;
                             } else if (n.type === 'strong' || n.type === 'emphasis') {
                                 const s = localCursor;
                                 if (n.children) n.children.forEach(processCellNode);
                                 const e = localCursor;
                                 populationRequests.push({
                                    updateTextStyle: {
                                        range: { startIndex: s, endIndex: e },
                                        textStyle: n.type === 'strong' ? { bold: true } : { italic: true },
                                        fields: n.type === 'strong' ? 'bold' : 'italic'
                                    }
                                 });
                             } else {
                                 if (n.children) n.children.forEach(processCellNode);
                             }
                          };
                          if (cellNode.children) cellNode.children.forEach(processCellNode);
                      }
                  }
              }
          }
          if (populationRequests.length > 0) {
            await (gapi.client as any).docs.documents.batchUpdate({
                documentId,
                resource: { requests: populationRequests }
            });
          }
      }
  }

  return documentId;
}
