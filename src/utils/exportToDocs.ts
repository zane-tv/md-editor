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
  
        // 5. Generate Requests (First Pass - Structure with Placeholders)
  
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
  
          // --- TABLES (Native - Placeholder Strategy) ---
  
          else if (node.type === 'table') {
  
              const tableIndex = tableNodes.length;
  
              tableNodes.push(node);
  
              const placeholder = `${TABLE_PLACEHOLDER_PREFIX}${tableIndex}${TABLE_PLACEHOLDER_SUFFIX}`;
  
              
  
              requests.push({ insertText: { location: { index: currentIndex }, text: placeholder } });
  
              currentIndex += placeholder.length;
  
              
  
              // Add a newline after table placeholder for spacing/parsing
  
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
  
      
  
        // EXECUTE FIRST BATCH (Structure & Content)
  
        if (requests.length > 0) {
  
          await (gapi.client as any).docs.documents.batchUpdate({
  
            documentId,
  
            resource: { requests }
  
          });
  
        }
  
      
  
        // 6. Second Pass - Create Tables (Swap Placeholders)
  
        if (tableNodes.length > 0) {
  
            // A. Read Document to find Placeholders
  
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
  
            
  
            // Sort Descending to ensure indices remain valid during batch operations
  
            tableLocations.sort((a, b) => b.startIndex - a.startIndex);
  
      
  
            const createTableRequests: any[] = [];
  
            tableLocations.forEach(loc => {
  
                const tableNode = tableNodes[loc.index];
  
                const rows = tableNode.children.length;
  
                const cols = tableNode.children[0]?.children.length || 0;
  
                const placeholderLen = `${TABLE_PLACEHOLDER_PREFIX}${loc.index}${TABLE_PLACEHOLDER_SUFFIX}`.length;
  
      
  
                // 1. Delete Placeholder
  
                createTableRequests.push({
  
                    deleteContentRange: {
  
                        range: {
  
                            startIndex: loc.startIndex,
  
                            endIndex: loc.startIndex + placeholderLen
  
                        }
  
                    }
  
                });
  
      
  
                // 2. Insert Table
  
                createTableRequests.push({
  
                    insertTable: {
  
                        location: { index: loc.startIndex },
  
                        rows: rows,
  
                        columns: cols
  
                    }
  
                });
  
            });
  
      
  
            if (createTableRequests.length > 0) {
  
              await (gapi.client as any).docs.documents.batchUpdate({
  
                  documentId,
  
                  resource: { requests: createTableRequests }
  
              });
  
            }
  
      
  
            // 7. Third Pass - Populate Tables (Reverse Order Strategy)
  
            // Read Document AGAIN to get exact Table indices
  
            const docResponse2 = await (gapi.client as any).docs.documents.get({ documentId });
  
            const bodyContent = docResponse2.result.body.content;
  
            
  
            // Find all tables in the document
  
            const docTables: any[] = [];
  
            const findTables = (elements: any[]) => {
  
                elements.forEach(el => {
  
                    if (el.table) {
  
                        docTables.push(el.table);
  
                    }
  
                    // Nested tables? Unlikely in this flow, but good practice to traverse?
  
                    // The API returns top-level tables in body.content.
  
                    // If we put tables inside tables, we'd need recursion.
  
                    // For now, assume top-level tables.
  
                });
  
            };
  
            findTables(bodyContent);
  
      
  
            // Verify we found the expected number of tables
  
            if (docTables.length === tableNodes.length) {
  
                const populationRequests: any[] = [];
  
                
  
                // Iterate BACKWARDS through tables
  
                for (let i = docTables.length - 1; i >= 0; i--) {
  
                    const docTable = docTables[i];
  
                    const tableNode = tableNodes[i]; // Assuming order is preserved (it should be)
  
                    
  
                    const rows = tableNode.children.length;
  
                    const cols = tableNode.children[0]?.children.length || 0;
  
      
  
                    // Iterate BACKWARDS through Rows
  
                    for (let r = rows - 1; r >= 0; r--) {
  
                        const rowNode = tableNode.children[r];
  
                        const docRow = docTable.tableRows[r];
  
      
  
                        // Iterate BACKWARDS through Cells
  
                        for (let c = cols - 1; c >= 0; c--) {
  
                            const cellNode = rowNode.children[c];
  
                            const docCell = docRow.tableCells[c];
  
                            
  
                            // Find the paragraph in the cell to insert text
  
                            // Usually the first element is a Paragraph
  
                            const firstContent = docCell.content[0];
  
                            if (firstContent && firstContent.paragraph) {
  
                                // The paragraph exists. It is empty (contains just a newline).
  
                                // We insert text at the START of this paragraph.
  
                                let insertIndex = firstContent.startIndex;
  
                                
  
                                // Helper to generate requests for this cell
  
                                // Since we process in reverse, insertions here won't affect indices of previous cells/tables.
  
                                // But WITHIN this cell, we must be careful.
  
                                // If we have "Hello" and "World", and we insert "Hello" then "World" at same index? No.
  
                                // We should append? Or insert in order?
  
                                // If we process cell content forwards, we just increment a local cursor relative to the insertion.
  
                                // BUT, since we are generating a BATCH, and the batch is processed in order...
  
                                // Wait. If we are processing everything in reverse order (Tables, Rows, Cells),
  
                                // then for a SPECIFIC cell, should we process its content in reverse too?
  
                                // OR, can we process content normally?
  
                                // "All indexes in the request are relative to the state of the document before the batch update starts."
  
                                // NO. "The index of a structural element... is updated to reflect the changes of preceding requests."
  
                                // So if we are in a batch:
  
                                // Request 1: Insert at 1000. (Last cell)
  
                                // Request 2: Insert at 500. (First cell)
  
                                // This is perfectly fine. Request 1 shifts indices > 1000. It does NOT affect 500.
  
                                
  
                                // So, for a SINGLE cell, we can generate multiple requests (text, bold, etc.) in forward order?
  
                                // Yes, as long as we update our local cursor.
  
                                // AND provided that this cell is "after" any other cells we process later in the batch (which are earlier in doc).
  
                                
  
                                let localCursor = insertIndex;
  
                                
  
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
  
                                
  
                                // Process cell children
  
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