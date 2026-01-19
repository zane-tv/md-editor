
// Pure logic for generating Google Docs API requests from Markdown AST

export const FONT_FAMILY = 'Times New Roman';
export const BASE_FONT_SIZE = 12;

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
      // H1: 36px (27pt), H2: 24px (18pt), H3: 20px (15pt), H4: 16px (12pt), H5: 14px (10.5pt -> 10pt), H6: 12px (9pt)
      const fontSizeMap: Record<number, number> = { 1: 27, 2: 18, 3: 15, 4: 12, 5: 10, 6: 9 };

      requests.push({
         updateTextStyle: {
            range: { startIndex: start, endIndex: end }, // Includes newline
            textStyle: {
                weightedFontFamily: { fontFamily: FONT_FAMILY },
                fontSize: { magnitude: fontSizeMap[node.depth] || 11, unit: 'PT' },
                bold: true,
            },
            fields: 'weightedFontFamily,fontSize,bold'
         }
      });
    }
    // --- PARAGRAPHS ---
    else if (node.type === 'paragraph') {
      const start = currentIndex;
      node.children.forEach(processNode);
      requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
      currentIndex += 1;
      const end = currentIndex;

      // Apply base font style to the entire paragraph
      requests.push({
        updateTextStyle: {
            range: { startIndex: start, endIndex: end },
            textStyle: {
                weightedFontFamily: { fontFamily: FONT_FAMILY },
                fontSize: { magnitude: BASE_FONT_SIZE, unit: 'PT' }
            },
            fields: 'weightedFontFamily,fontSize'
        }
      });
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
      const bulletStart = currentIndex;
      requests.push({ insertText: { location: { index: currentIndex }, text: '• ' } });
      currentIndex += 2;

      // Style the bullet
      requests.push({
          updateTextStyle: {
              range: { startIndex: bulletStart, endIndex: currentIndex },
              textStyle: {
                  weightedFontFamily: { fontFamily: FONT_FAMILY },
                  fontSize: { magnitude: BASE_FONT_SIZE, unit: 'PT' }
              },
              fields: 'weightedFontFamily,fontSize'
          }
      });

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
          const start = currentIndex;
          requests.push({ insertText: { location: { index: currentIndex }, text } });
          currentIndex += text.length;
           requests.push({
            updateTextStyle: {
                range: { startIndex: start, endIndex: currentIndex },
                textStyle: {
                    weightedFontFamily: { fontFamily: FONT_FAMILY },
                    fontSize: { magnitude: BASE_FONT_SIZE, unit: 'PT' }
                },
                fields: 'weightedFontFamily,fontSize'
            }
          });
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
                    weightedFontFamily: { fontFamily: FONT_FAMILY },
                    fontSize: { magnitude: BASE_FONT_SIZE, unit: 'PT' },
                    backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } } }
                },
                fields: 'weightedFontFamily,fontSize,backgroundColor'
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
