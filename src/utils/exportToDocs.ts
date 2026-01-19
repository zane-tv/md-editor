import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import html2canvas from 'html2canvas';
import { gapi } from 'gapi-script';
import { generateGoogleDocsRequests, FONT_FAMILY, BASE_FONT_SIZE } from './docsGenerator';

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
                                 populationRequests.push({
                                     updateTextStyle: {
                                         range: { startIndex: localCursor, endIndex: localCursor + text.length },
                                         textStyle: {
                                             weightedFontFamily: { fontFamily: FONT_FAMILY },
                                             fontSize: { magnitude: BASE_FONT_SIZE, unit: 'PT' }
                                         },
                                         fields: 'weightedFontFamily,fontSize'
                                     }
                                 });
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
