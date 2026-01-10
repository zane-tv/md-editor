import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import {
  FileDown,
  Eye,
  Code,
  LogIn,
  LogOut,
  Loader2,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Link,
  Code2,
  Network,
  Strikethrough,
  Quote,
  Minus,
  Table,
  Image,
  Printer,
  ExternalLink,
  X,
  FilePlus,
  Moon,
  Sun,
  Download,
  Copy,
  Check,
  FolderOpen,
  Save,
} from "lucide-react";
import { revokeToken } from "./utils/googleClient";
import { exportMarkdownToDocs } from "./utils/exportToDocs";
import { TableOfContents } from "./components/TableOfContents";
import { getTextFromChildren, slugify } from "./utils/slugify";

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
  fontFamily: "Inter, sans-serif",
});

const Mermaid = ({ chart, darkMode }: { chart: string; darkMode: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const themeDirective = `%%{init: {'theme': '${
    darkMode ? "dark" : "default"
  }'} }%%\n`;
  const chartWithTheme = themeDirective + chart;

  useEffect(() => {
    if (!chart || !containerRef.current) return;

    const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;

    const render = async () => {
      try {
        if (containerRef.current)
          containerRef.current.innerHTML =
            '<div class="animate-pulse text-xs text-neutral-400">Rendering...</div>';
        const { svg } = await mermaid.render(id, chartWithTheme);
        if (containerRef.current) containerRef.current.innerHTML = svg;
      } catch (error: any) {
        console.error("Mermaid Failed:", error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="p-4 bg-red-50 border border-red-200 rounded text-xs text-red-600 font-mono overflow-auto">
              <div class="font-bold">Mermaid Syntax Error:</div>
              <div class="mb-2">${error.message}</div>
              <div class="font-bold">Input:</div>
              <pre class="bg-white p-1 border">${chart}</pre>
            </div>
          `;
        }
      }
    };

    render();
  }, [chartWithTheme]);

  return (
    <div
      ref={containerRef}
      className="mermaid-wrapper flex justify-center my-6"
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

const CodeBlock = ({ children, className, ...rest }: any) => {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, "");
  const isInline = !className;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isInline) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-1.5 rounded-md bg-neutral-800/10 hover:bg-neutral-800/20 dark:bg-white/10 dark:hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy code"
      >
        {copied ? (
          <Check size={14} className="text-green-600" />
        ) : (
          <Copy size={14} className="text-neutral-500" />
        )}
      </button>
      <pre className="!mt-0 !mb-0 overflow-auto">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    </div>
  );
};

function App() {
  const [markdown, setMarkdown] = useState(DEFAULT_MD);
  const [view, setView] = useState<"split" | "edit" | "preview">("split");
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark"
  );
  const [editorWidth, setEditorWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);

  const apiKey =
    import.meta.env.VITE_GOOGLE_API_KEY ||
    localStorage.getItem("GOOGLE_API_KEY") ||
    "";
  const clientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    localStorage.getItem("GOOGLE_CLIENT_ID") ||
    "";

  const [tokenClient, setTokenClient] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);
  const [showNewFileConfirm, setShowNewFileConfirm] = useState(false);
  const [fileHandle, setFileHandle] = useState<any>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing && mainRef.current) {
        const mainRect = mainRef.current.getBoundingClientRect();
        const newWidth =
          ((mouseMoveEvent.clientX - mainRect.left) / mainRect.width) * 100;
        if (newWidth >= 20 && newWidth <= 80) {
          setEditorWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  useEffect(() => {
    if (apiKey && clientId && !isInitialized) {
      import("./utils/googleClient").then(
        async ({ initGoogleClient, initTokenClient, restoreToken }) => {
          try {
            await initGoogleClient(apiKey);
            console.log("GAPI Client Initialized");

            // Check for saved token
            const savedToken = localStorage.getItem("google_access_token");
            const savedExpiry = localStorage.getItem("google_token_expiry");

            if (savedToken && savedExpiry) {
              if (Date.now() < parseInt(savedExpiry)) {
                console.log("Restoring saved token");
                restoreToken({ access_token: savedToken });
                setAccessToken(savedToken);
              } else {
                console.log("Saved token expired");
                localStorage.removeItem("google_access_token");
                localStorage.removeItem("google_token_expiry");
              }
            }

            const client = initTokenClient(clientId, (tokenResponse) => {
              console.log("Token received");
              setAccessToken(tokenResponse.access_token);

              // Save token
              if (tokenResponse.expires_in) {
                const expiry = Date.now() + tokenResponse.expires_in * 1000;
                localStorage.setItem(
                  "google_access_token",
                  tokenResponse.access_token
                );
                localStorage.setItem("google_token_expiry", expiry.toString());
              }
            });
            setTokenClient(client);
            setIsInitialized(true);
          } catch (err) {
            console.error("Init failed", err);
            setStatusMsg("Khởi tạo thất bại. Kiểm tra API Key.");
          }
        }
      );
    }
  }, [apiKey, clientId, isInitialized]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const handleAuth = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    }
  };

  const handleLogout = () => {
    if (accessToken) {
      revokeToken(accessToken);
      setAccessToken(null);
      localStorage.removeItem("google_access_token");
      localStorage.removeItem("google_token_expiry");
      setStatusMsg("Đã đăng xuất");
      setTimeout(() => setStatusMsg(""), 3000);
    }
  };

  const handleDownloadMD = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (!accessToken) {
      handleAuth();
      return;
    }

    setIsExporting(true);
    setStatusMsg("Đang chuẩn bị xuất...");
    setCreatedDocId(null);

    try {
      if (view === "edit") setView("preview");
      await new Promise((r) => setTimeout(r, 1000));
      setStatusMsg("Đang chụp biểu đồ & Tạo Doc...");
      const title =
        markdown.split("\n")[0].replace("#", "").trim() || "Markdown Export";
      const docId = await exportMarkdownToDocs(markdown, title);
      setStatusMsg(`Thành công!`);
      setCreatedDocId(docId);
    } catch (error: any) {
      console.error(error);
      setStatusMsg(`Xuất thất bại: ${error.message}`);
      if (
        error.message &&
        (error.message.includes("401") || error.message.includes("403"))
      ) {
        setAccessToken(null);
        localStorage.removeItem("google_access_token");
        localStorage.removeItem("google_token_expiry");
        setStatusMsg("Token hết hạn. Vui lòng đăng nhập lại.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPDF = () => {
    if (view === "edit") setView("preview");
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleNewFile = () => {
    setShowNewFileConfirm(true);
  };

  const confirmNewFile = () => {
    setMarkdown("");
    setFileHandle(null);
    setShowNewFileConfirm(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleOpenFile = async () => {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: "Markdown Files",
            accept: {
              "text/markdown": [".md", ".markdown"],
              "text/plain": [".txt"],
            },
          },
        ],
        multiple: false,
      });
      const file = await handle.getFile();
      const contents = await file.text();
      setMarkdown(contents);
      setFileHandle(handle);
      setStatusMsg("Đã mở: " + file.name);
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveFile = async () => {
    if (!fileHandle) {
      handleSaveAs();
      return;
    }
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(markdown);
      await writable.close();
      setStatusMsg("Đã lưu!");
      setTimeout(() => setStatusMsg(""), 2000);
    } catch (err) {
      console.error(err);
      setStatusMsg("Lưu thất bại");
    }
  };

  const handleSaveAs = async () => {
    try {
      const handle = await (window as any).showSaveFilePicker({
        types: [
          {
            description: "Markdown File",
            accept: { "text/markdown": [".md"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(markdown);
      await writable.close();
      setFileHandle(handle);
      setStatusMsg("Đã lưu!");
      setTimeout(() => setStatusMsg(""), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditorScroll = () => {
    if (isScrollingRef.current) return;
    isScrollingRef.current = true;
    if (textareaRef.current && previewRef.current) {
      const percent =
        textareaRef.current.scrollTop /
        (textareaRef.current.scrollHeight - textareaRef.current.clientHeight);
      previewRef.current.scrollTop =
        percent *
        (previewRef.current.scrollHeight - previewRef.current.clientHeight);
    }
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 50);
  };

  const handlePreviewScroll = () => {
    if (isScrollingRef.current) return;
    isScrollingRef.current = true;
    if (textareaRef.current && previewRef.current) {
      const percent =
        previewRef.current.scrollTop /
        (previewRef.current.scrollHeight - previewRef.current.clientHeight);
      textareaRef.current.scrollTop =
        percent *
        (textareaRef.current.scrollHeight - textareaRef.current.clientHeight);
    }
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 50);
  };

  const insertText = (before: string, after: string = "") => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = markdown;
    const selectedText = text.substring(start, end);
    const newText =
      text.substring(0, start) +
      before +
      selectedText +
      after +
      text.substring(end);
    setMarkdown(newText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          start + before.length,
          end + before.length
        );
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          insertText("**", "**");
          break;
        case "i":
          e.preventDefault();
          insertText("*", "*");
          break;
        case "k":
          e.preventDefault();
          insertText("[", "](url)");
          break;
        case "s":
          e.preventDefault();
          handleSaveFile();
          break;
        case "p":
          e.preventDefault();
          handlePrintPDF();
          break;
        default:
          break;
      }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      insertText("  ");
    }
  };

  const ToolbarButton = ({
    icon: Icon,
    onClick,
    title,
  }: {
    icon: any;
    onClick: () => void;
    title: string;
  }) => (
    <button
      onClick={onClick}
      className="p-1.5 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition"
      title={title}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col relative transition-colors duration-300">
      {/* Confirm New File Modal */}
      {showNewFileConfirm && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl p-6 w-full max-w-sm border dark:border-neutral-700">
            <h2 className="text-lg font-bold mb-2 dark:text-white">
              Tạo file mới?
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 mb-6 text-sm">
              Bạn có chắc chắn không? Hành động này sẽ xóa nội dung hiện tại. Mọi thay đổi chưa lưu sẽ bị mất.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNewFileConfirm(false)}
                className="px-4 py-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-sm font-medium"
              >
                Hủy
              </button>
              <button
                onClick={confirmNewFile}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
              >
                Tạo mới
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="h-14 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2 font-bold text-blue-600">
          <img src="/logo.png" alt="Markiva" className="w-6 h-6" />
          <span>Markiva</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenFile}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title="Open File"
          >
            <FolderOpen size={20} />
          </button>
          <button
            onClick={handleSaveFile}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title={fileHandle ? "Save" : "Save As"}
          >
            <Save size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-lg">
          <button
            onClick={() => setView("edit")}
            className={`px-3 py-1 rounded-md text-sm transition ${
              view === "edit"
                ? "bg-white shadow-sm font-medium"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <Code size={16} className="inline mr-1" /> Soạn thảo
          </button>
          <button
            onClick={() => setView("split")}
            className={`px-3 py-1 rounded-md text-sm transition ${
              view === "split"
                ? "bg-white shadow-sm font-medium"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            Song song
          </button>
          <button
            onClick={() => setView("preview")}
            className={`px-3 py-1 rounded-md text-sm transition ${
              view === "preview"
                ? "bg-white shadow-sm font-medium"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <Eye size={16} className="inline mr-1" /> Xem trước
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {statusMsg && (
              <span className="text-xs text-neutral-500 animate-pulse">
                {statusMsg}
              </span>
            )}
            {createdDocId && (
              <a
                href={`https://docs.google.com/document/d/${createdDocId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition"
              >
                Mở Google Doc <ExternalLink size={12} />
              </a>
            )}
            {createdDocId && (
              <button
                onClick={() => {
                  setCreatedDocId(null);
                  setStatusMsg("");
                }}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="h-6 w-px bg-neutral-200 mx-1"></div>

          <button
            onClick={toggleDarkMode}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title={darkMode ? "Chế độ sáng" : "Chế độ tối"}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={handleDownloadMD}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title="Tải về Markdown"
          >
            <Download size={20} />
          </button>
          <button
            onClick={handlePrintPDF}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title="In / Lưu PDF"
          >
            <Printer size={20} />
          </button>

          {isInitialized ? (
            !accessToken ? (
              <button
                onClick={handleAuth}
                className="flex items-center gap-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 px-4 py-2 rounded-lg font-medium transition text-sm shadow-sm"
              >
                <LogIn size={16} /> Kết nối Google
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                  Đã kết nối
                </span>
                <button
                  onClick={handleLogout}
                  className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                  title="Đăng xuất"
                >
                  <LogOut size={18} />
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm disabled:opacity-50"
                >
                  {isExporting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <FileDown size={18} />
                  )}{" "}
                  <span>Xuất Docs</span>
                </button>
              </div>
            )
          ) : null}
        </div>
      </header>

      <main
        ref={mainRef}
        className="flex-1 flex overflow-hidden"
        style={{ userSelect: isResizing ? "none" : "auto" }}
      >
        {(view === "split" || view === "edit") && (
          <div
            className={`editor-pane border-r bg-white flex flex-col ${
              view !== "split" ? "flex-1" : ""
            } ${view === "edit" ? "max-w-5xl mx-auto border-x" : ""}`}
            style={
              view === "split" ? { width: `${editorWidth}%`, flex: "none" } : {}
            }
          >
            {/* Toolbar */}
            <div className="toolbar h-10 border-b flex items-center px-4 gap-1 bg-white sticky top-0 overflow-x-auto transition-colors duration-300">
              <ToolbarButton
                icon={FilePlus}
                onClick={handleNewFile}
                title="Tạo file mới"
              />
              <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>

              <ToolbarButton
                icon={Bold}
                onClick={() => insertText("**", "**")}
                title="In đậm"
              />
              <ToolbarButton
                icon={Italic}
                onClick={() => insertText("*", "*")}
                title="In nghiêng"
              />
              <ToolbarButton
                icon={Strikethrough}
                onClick={() => insertText("~~", "~~")}
                title="Gạch ngang"
              />
              <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>

              <ToolbarButton
                icon={Heading1}
                onClick={() => insertText("# ")}
                title="Tiêu đề 1"
              />
              <ToolbarButton
                icon={Heading2}
                onClick={() => insertText("## ")}
                title="Tiêu đề 2"
              />
              <ToolbarButton
                icon={Heading3}
                onClick={() => insertText("### ")}
                title="Tiêu đề 3"
              />
              <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>

              <ToolbarButton
                icon={List}
                onClick={() => insertText("- ")}
                title="Danh sách"
              />
              <ToolbarButton
                icon={ListOrdered}
                onClick={() => insertText("1. ")}
                title="Danh sách số"
              />
              <ToolbarButton
                icon={CheckSquare}
                onClick={() => insertText("- [ ] ")}
                title="Danh sách việc"
              />
              <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>

              <ToolbarButton
                icon={Quote}
                onClick={() => insertText("> ")}
                title="Trích dẫn"
              />
              <ToolbarButton
                icon={Minus}
                onClick={() => insertText("---\n")}
                title="Đường kẻ ngang"
              />
              <ToolbarButton
                icon={Table}
                onClick={() =>
                  insertText(
                    "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |"
                  )
                }
                title="Bảng"
              />
              <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>

              <ToolbarButton
                icon={Link}
                onClick={() => insertText("[", "](url)")}
                title="Liên kết"
              />
              <ToolbarButton
                icon={Image}
                onClick={() => insertText("![Alt text]", "(url)")}
                title="Hình ảnh"
              />
              <ToolbarButton
                icon={Code2}
                onClick={() => insertText("```\n", "\n```")}
                title="Khối mã (Code Block)"
              />
              <ToolbarButton
                icon={Network}
                onClick={() =>
                  insertText(
                    "```mermaid\ngraph TD\n    A[Start] --> B[End]\n```"
                  )
                }
                title="Biểu đồ Mermaid"
              />
            </div>

            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={handleEditorScroll}
              className="w-full h-full p-8 font-mono text-sm resize-none focus:outline-none leading-relaxed text-neutral-800 bg-white"
              placeholder="Nhập markdown của bạn ở đây..."
            />
          </div>
        )}

        {view === "split" && (
          <div
            className="w-1 bg-neutral-200 hover:bg-blue-400 cursor-col-resize transition-colors z-10 flex-shrink-0"
            onMouseDown={startResizing}
          />
        )}

        {(view === "split" || view === "preview") && (
          <div className={`flex flex-1 overflow-hidden h-full relative ${view === "preview" ? "bg-neutral-100 dark:bg-neutral-900" : ""}`}>
            {/* TOC Sidebar - Only in Preview Mode */}
            {view === 'preview' && (
              <div className="w-72 bg-neutral-50 dark:bg-neutral-900 border-r dark:border-neutral-700 overflow-y-auto hidden lg:block flex-shrink-0 h-full">
                 <TableOfContents markdown={markdown} />
              </div>
            )}

            {/* Preview Content */}
            <div
              ref={previewRef}
              onScroll={handlePreviewScroll}
              className={`preview-pane flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-900`}
            >
              <div className={`prose prose-neutral max-w-none bg-white dark:bg-neutral-800 min-h-full shadow-sm text-neutral-800 dark:text-neutral-100 ${
                 view === "preview" ? "max-w-4xl mx-auto my-8 p-10 rounded-lg border dark:border-neutral-700" : "p-10"
              }`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre: ({ children }) => <>{children}</>,
                    h1: ({ children, ...props }) => {
                       const id = slugify(getTextFromChildren(children));
                       return <h1 id={id} {...props}>{children}</h1>;
                    },
                    h2: ({ children, ...props }) => {
                       const id = slugify(getTextFromChildren(children));
                       return <h2 id={id} {...props}>{children}</h2>;
                    },
                    h3: ({ children, ...props }) => {
                       const id = slugify(getTextFromChildren(children));
                       return <h3 id={id} {...props}>{children}</h3>;
                    },
                    h4: ({ children, ...props }) => {
                       const id = slugify(getTextFromChildren(children));
                       return <h4 id={id} {...props}>{children}</h4>;
                    },
                    code(props: any) {
                      const { children, className, node, ...rest } = props;
                      const match = /mermaid/i.test(className || "");
                      if (match) {
                        return (
                          <Mermaid
                            chart={String(children).replace(/\n$/, "")}
                            darkMode={darkMode}
                          />
                        );
                      }
                      return (
                        <CodeBlock className={className} {...rest}>
                          {children}
                        </CodeBlock>
                      );
                    },
                    table(props: any) {
                      return (
                        <div className="table-wrapper my-4 inline-block border rounded overflow-hidden">
                          <table {...props} />
                        </div>
                      );
                    },
                  }}
                >
                  {markdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
