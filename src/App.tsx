import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import {
  FileDown, Layout, Settings, Eye, Code, LogIn, LogOut, Loader2, Save,
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Link, Code2, Network,
  Strikethrough, Quote, Minus, Table, Image, Printer, ExternalLink, X
} from 'lucide-react';
import { initGoogleClient, initTokenClient, revokeToken } from './utils/googleClient';
import { exportMarkdownToDocs } from './utils/exportToDocs';
// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
});

const Mermaid = ({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const renderChart = async () => {
      if (!chart) return;
      
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        // Mermaid render returns an object with svg property in v10
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        
        if (mounted) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: any) {
        console.error("Mermaid render error:", err);
        if (mounted) {
          // Mermaid error messages can be verbose, take the first line or message
          setError(err.message || "Syntax error");
        }
      }
    };

    renderChart();

    return () => {
      mounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 text-xs font-mono rounded border border-red-200 my-4 overflow-auto">
        <div className="font-bold mb-2">Mermaid Error:</div>
        <div className="mb-2 whitespace-pre-wrap">{error}</div>
        <div className="font-bold mb-1">Source:</div>
        <pre className="bg-white p-2 rounded border text-neutral-600">{chart}</pre>
      </div>
    );
  }

  if (!svg) return <div className="p-4 text-center text-neutral-400 text-sm animate-pulse">Rendering chart...</div>;

  return (
    <div 
      className="mermaid-wrapper flex justify-center my-6 bg-white p-4 rounded-lg border border-neutral-100 shadow-sm overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

const DEFAULT_MD = `# Chuyển đổi Markdown sang Google Docs

Chào mừng bạn đến với công cụ chuyển đổi Markdown!

## Hỗ trợ Biểu đồ (Mermaid)


\`\`\`mermaid
graph TD
    A[Bắt đầu] --> B{Có Markdown?}
    B -- Có --> C[Preview & Chỉnh sửa]
    B -- Không --> D[Nhập nội dung]
    C --> E[Export sang Google Docs]
    E --> F[Hoàn thành]

\`\`\`

## Các tính năng:
- **Hỗ trợ GFM**: Bảng, checkbox, links...
- **Biểu đồ**: Mermaid.js
- **Preview trực tiếp**: Nhìn thấy kết quả ngay lập tức
`;

function App() {
  const [markdown, setMarkdown] = useState(DEFAULT_MD);
  const [view, setView] = useState<'split' | 'edit' | 'preview'>('split');
  
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GOOGLE_API_KEY || localStorage.getItem('GOOGLE_API_KEY') || '');
  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || localStorage.getItem('GOOGLE_CLIENT_ID') || '');
  
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [isExporting, setIsExporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (apiKey && clientId && !isInitialized) {
      // Initialize GAPI and GIS
      import('./utils/googleClient').then(async ({ initGoogleClient, initTokenClient }) => {
        try {
          await initGoogleClient(apiKey);
          console.log("GAPI Client Initialized");
          
          const client = initTokenClient(clientId, (tokenResponse) => {
             console.log("Token received");
             setAccessToken(tokenResponse.access_token);
          });
          
          setTokenClient(client);
          setIsInitialized(true);
        } catch (err) {
          console.error("Init failed", err);
          setStatusMsg("Failed to initialize. Check API Key.");
        }
      });
    }
  }, [apiKey, clientId, isInitialized]);

  const handleAuth = () => {
    if (tokenClient) {
      // Trigger the popup
      tokenClient.requestAccessToken();
    }
  };

  const handleLogout = () => {
    if (accessToken) {
      revokeToken(accessToken);
      setAccessToken(null);
      setStatusMsg("Logged out");
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  const handleExport = async () => {
    if (!accessToken) {
      handleAuth();
      return;
    }
    
    setIsExporting(true);
    setStatusMsg('Preparing export...');
    setCreatedDocId(null);
    
    try {
      // Only switch view if we are in edit only mode
      if (view === 'edit') setView('preview');
      
      // Allow render
      await new Promise(r => setTimeout(r, 1000));
      
      setStatusMsg('Capturing charts & Creating Doc...');
      const title = markdown.split('\n')[0].replace('#', '').trim() || 'Markdown Export';
      const docId = await exportMarkdownToDocs(markdown, title);
      
      setStatusMsg(`Success!`);
      setCreatedDocId(docId); // Store ID to show link instead of window.open
      
    } catch (error: any) {
      console.error(error);
      setStatusMsg(`Export failed: ${error.message}`);
      if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
         setAccessToken(null);
         setStatusMsg("Token expired. Please Sign In again.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPDF = () => {
    // Ensure we are in a mode that renders the preview
    if (view === 'edit') setView('preview');
    // Allow React to render
    setTimeout(() => {
        window.print();
    }, 500);
  };

  const insertText = (before: string, after: string = '') => {
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = markdown;
    const selectedText = text.substring(start, end);
    
    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
    setMarkdown(newText);
    
    // Restore focus and selection
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + before.length, end + before.length);
      }
    }, 0);
  };

  const ToolbarButton = ({ icon: Icon, onClick, title }: { icon: any, onClick: () => void, title: string }) => (
    <button 
      onClick={onClick}
      className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded transition"
      title={title}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col relative">
      <header className="h-14 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-blue-600">
          <Layout size={20} />
          <span>MD to Google Docs</span>
        </div>
        
        <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-lg">
          <button 
            onClick={() => setView('edit')}
            className={`px-3 py-1 rounded-md text-sm transition ${view === 'edit' ? 'bg-white shadow-sm font-medium' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            <Code size={16} className="inline mr-1" /> Edit
          </button>
          <button 
            onClick={() => setView('split')}
            className={`px-3 py-1 rounded-md text-sm transition ${view === 'split' ? 'bg-white shadow-sm font-medium' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            Split
          </button>
          <button 
            onClick={() => setView('preview')}
            className={`px-3 py-1 rounded-md text-sm transition ${view === 'preview' ? 'bg-white shadow-sm font-medium' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            <Eye size={16} className="inline mr-1" /> Preview
          </button>
        </div>

        <div className="flex items-center gap-3">
           {/* Status & Export Link */}
           <div className="flex items-center gap-2">
               {statusMsg && <span className="text-xs text-neutral-500 animate-pulse">{statusMsg}</span>}
               {createdDocId && (
                   <a 
                     href={`https://docs.google.com/document/d/${createdDocId}/edit`} 
                     target="_blank" 
                     rel="noreferrer"
                     className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition"
                   >
                       Open Doc <ExternalLink size={12} />
                   </a>
               )}
               {createdDocId && (
                   <button onClick={() => { setCreatedDocId(null); setStatusMsg(''); }} className="text-neutral-400 hover:text-neutral-600">
                       <X size={14} />
                   </button>
               )}
           </div>
           
           <div className="h-6 w-px bg-neutral-200 mx-1"></div>

            <button 
                onClick={handlePrintPDF}
                className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
                title="Print / Save as PDF"
            >
                <Printer size={20} />
            </button>
           
          {isInitialized ? (
            !accessToken ? (
               <button 
                onClick={handleAuth}
                className="flex items-center gap-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 px-4 py-2 rounded-lg font-medium transition text-sm shadow-sm"
               >
                 <LogIn size={16} /> Connect Google
               </button>
            ) : (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">Connected</span>
                    <button 
                        onClick={handleLogout}
                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                    <button 
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
                        <span>Export</span>
                    </button>
                </div>
            )
          ) : null}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {(view === 'split' || view === 'edit') && (
          <div className={`editor-pane flex-1 border-r bg-white flex flex-col ${view === 'edit' ? 'max-w-5xl mx-auto border-x' : ''}`}>
             {/* Toolbar */}
             <div className="toolbar h-10 border-b flex items-center px-4 gap-1 bg-white sticky top-0 overflow-x-auto">
               <ToolbarButton icon={Bold} onClick={() => insertText('**', '**')} title="Bold" />
               <ToolbarButton icon={Italic} onClick={() => insertText('*', '*')} title="Italic" />
               <ToolbarButton icon={Strikethrough} onClick={() => insertText('~~', '~~')} title="Strikethrough" />
               <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>
               
               <ToolbarButton icon={Heading1} onClick={() => insertText('# ')} title="Heading 1" />
               <ToolbarButton icon={Heading2} onClick={() => insertText('## ')} title="Heading 2" />
               <ToolbarButton icon={Heading3} onClick={() => insertText('### ')} title="Heading 3" />
               <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>
               
               <ToolbarButton icon={List} onClick={() => insertText('- ')} title="Unordered List" />
               <ToolbarButton icon={ListOrdered} onClick={() => insertText('1. ')} title="Ordered List" />
               <ToolbarButton icon={CheckSquare} onClick={() => insertText('- [ ] ')} title="Checklist" />
               <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>
               
               <ToolbarButton icon={Quote} onClick={() => insertText('> ')} title="Blockquote" />
               <ToolbarButton icon={Minus} onClick={() => insertText('---\n')} title="Horizontal Rule" />
               <ToolbarButton icon={Table} onClick={() => insertText('| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |')} title="Table" />
               <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>
               
               <ToolbarButton icon={Link} onClick={() => insertText('[', '](url)')} title="Link" />
               <ToolbarButton icon={Image} onClick={() => insertText('![Alt text]', '(url)')} title="Image" />
               <ToolbarButton icon={Code2} onClick={() => insertText('```\n', '\n```')} title="Code Block" />
               <ToolbarButton icon={Network} onClick={() => insertText('```mermaid\ngraph TD\n    A[Start] --> B[End]\n```')} title="Mermaid Chart" />
             </div>

            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="w-full h-full p-8 font-mono text-sm resize-none focus:outline-none leading-relaxed text-neutral-800 bg-white"
              placeholder="Nhập markdown của bạn ở đây..."
            />
          </div>
        )}

        {(view === 'split' || view === 'preview') && (
          <div className={`preview-pane flex-1 overflow-y-auto bg-neutral-50 ${view === 'preview' ? 'max-w-5xl mx-auto' : ''}`}>
            <div className="p-10 prose prose-neutral max-w-none bg-white min-h-full shadow-sm text-neutral-800">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code(props: any) {
                    const { children, className, node, ...rest } = props;
                    const match = /mermaid/i.test(className || '');
                    return match ? (
                      <Mermaid chart={String(children).replace(/\n$/, '')} />
                    ) : (
                      <code className={className} {...rest}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;