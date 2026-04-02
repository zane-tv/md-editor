import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
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
  ZoomIn,
  ZoomOut,
  Maximize,
  DownloadCloud,
  UploadCloud,
  Share2,
} from "lucide-react";
import { useTranslation } from 'react-i18next';
import { revokeToken } from "./utils/googleClient";
import { loadGooglePickerScript, downloadDriveFile, createDriveFile, updateDriveFile,   } from "./utils/googleDriveApi";
import { exportMarkdownToDocs } from "./utils/exportToDocs";
import { generateShareUrl, checkUrlForSharedContent, getShareIdFromUrl, getViewModeFromUrl } from "./utils/urlShare";
import { SHARE_TOO_LARGE_ERROR, createShare, loadShare, type ShareViewMode } from "./utils/shareStore";
import { isSupabaseConfigured } from "./utils/supabase";
import { TableOfContents } from "./components/TableOfContents";
import { getTextFromChildren, slugify } from "./utils/slugify";
import i18next from 'i18next';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
  fontFamily: "Inter, sans-serif",
});

const MermaidControls = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-2 right-2 flex gap-1 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm p-1 rounded-md shadow-sm border dark:border-neutral-700 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        type="button"
        onClick={() => zoomIn()}
        className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition"
        title="Zoom In"
      >
        <ZoomIn size={16} />
      </button>
      <button
        type="button"
        onClick={() => zoomOut()}
        className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition"
        title="Zoom Out"
      >
        <ZoomOut size={16} />
      </button>
      <button
        type="button"
        onClick={() => resetTransform()}
        className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition"
        title="Reset"
      >
        <Maximize size={16} />
      </button>
    </div>
  );
};

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
  }, [chart, chartWithTheme]);

  return (
    <div className="relative group mermaid-wrapper-container my-6 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 rounded-lg overflow-hidden transition-colors">
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={8}
        centerZoomedOut={true}
        wheel={{ step: 0.1 }}
      >
        <MermaidControls />
        <TransformComponent wrapperClass="!w-full !h-full bg-white dark:bg-neutral-900" contentClass="!w-full !h-full flex items-center justify-center min-h-[200px]">
          <div
            ref={containerRef}
            className="mermaid-wrapper flex justify-center w-full h-full p-4"
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
};

const CodeBlock = ({ children, className, ...rest }: any) => {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, "");

  // Detect block vs inline
  // Blocks from markdown usually end with a newline (thanks to react-markdown parser behavior for fenced blocks)
  // or they have a language class (className)
  const isBlock = className || String(children).endsWith("\n");
  const isInline = !isBlock;

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
      {/* Only show copy button if language is specified (className exists) */}
      {className && (
        <button
          type="button"
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
      )}
      <pre className="!mt-0 !mb-0 overflow-auto">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    </div>
  );
};

type ViewMode = ShareViewMode;
type SharedLinkState = 'idle' | 'loading' | 'ready' | 'expired' | 'notFound' | 'error';

const isViewMode = (value: string | null): value is ViewMode => {
  return value === 'split' || value === 'edit' || value === 'preview';
};

function App() {
  const { t, i18n } = useTranslation();
  const initialLegacySharedContent = useMemo(() => checkUrlForSharedContent(), []);
  const sharedLinkId = useMemo(() => getShareIdFromUrl(), []);
  const initialViewModeFromUrl = useMemo(() => getViewModeFromUrl(), []);
  const hasExplicitViewMode = isViewMode(initialViewModeFromUrl);

  const [markdown, setMarkdown] = useState(() => {
    if (sharedLinkId) return "";
    if (initialLegacySharedContent) return initialLegacySharedContent;
    return i18next.t('defaultContent');
  });
  // Debounce markdown for preview to improve performance
  const [debouncedMarkdown, setDebouncedMarkdown] = useState(markdown);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMarkdown(markdown), 300);
    return () => clearTimeout(timer);
  }, [markdown]);

  const [view, setView] = useState<ViewMode>(() => {
    if (isViewMode(initialViewModeFromUrl)) {
      return initialViewModeFromUrl;
    }
    if (sharedLinkId || initialLegacySharedContent) return 'preview';
    return "split";
  });
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
  const [sharedLinkState, setSharedLinkState] = useState<SharedLinkState>(() =>
    sharedLinkId ? 'loading' : 'idle'
  );
  const [showNewFileConfirm, setShowNewFileConfirm] = useState(false);
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [driveFileName, setDriveFileName] = useState<string | null>(null);

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

  useEffect(() => {
    if (!sharedLinkId) {
      return;
    }

    let cancelled = false;

    setSharedLinkState('loading');

    loadShare(sharedLinkId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.status === 'ready') {
          setMarkdown(result.share.markdown);
          if (!hasExplicitViewMode) {
            setView(result.share.viewMode);
          }
          setSharedLinkState('ready');
          return;
        }

        setMarkdown('');
        setSharedLinkState(result.status === 'expired' ? 'expired' : 'notFound');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error('Failed to load shared link', error);
        setMarkdown('');
        setSharedLinkState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [hasExplicitViewMode, sharedLinkId]);

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
            setStatusMsg(t('app.status.initFailed'));
          }
        }
      );
    }
  }, [apiKey, clientId, isInitialized, t]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'vi' ? 'en' : 'vi';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

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
      setStatusMsg(t('app.status.loggedOut'));
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
    setStatusMsg(t('app.status.preparingExport'));
    setCreatedDocId(null);

    try {
      if (view === "edit") setView("preview");
      await new Promise((r) => setTimeout(r, 1000));
      setStatusMsg(t('app.status.processingExport'));
      const title =
        markdown.split("\n")[0].replace("#", "").trim() || "Markdown Export";
      const docId = await exportMarkdownToDocs(markdown, title);
      setStatusMsg(t('common.success'));
      setCreatedDocId(docId);
    } catch (error: any) {
      console.error(error);
      setStatusMsg(t('app.status.exportFailed', { error: error.message }));
      if (
        error.message &&
        (error.message.includes("401") || error.message.includes("403"))
      ) {
        setAccessToken(null);
        localStorage.removeItem("google_access_token");
        localStorage.removeItem("google_token_expiry");
        setStatusMsg(t('app.status.tokenExpired'));
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

  const handleShare = async () => {
    if (!isSupabaseConfigured()) {
      setStatusMsg(t('app.status.shareNotConfigured'));
      setTimeout(() => setStatusMsg(""), 3000);
      return;
    }

    try {
      setStatusMsg(t('app.status.generatingLink', 'Đang tạo link...'));
      const shareId = await createShare(markdown, view);
      const url = generateShareUrl(shareId, view);
      await navigator.clipboard.writeText(url);
      setStatusMsg(t('app.status.linkCopied'));
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === SHARE_TOO_LARGE_ERROR) {
        setStatusMsg(t('app.status.shareTooLarge'));
      } else {
        setStatusMsg(t('app.status.linkGeneratedError'));
      }
      setTimeout(() => setStatusMsg(""), 3000);
    }
  };

  const handleNewFile = () => {
    setShowNewFileConfirm(true);
  };

  const confirmNewFile = () => {
    setMarkdown("");
    setFileHandle(null);
    setDriveFileId(null);
    setDriveFileName(null);
    setShowNewFileConfirm(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleOpenFile = async () => {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: t('app.status.markdownFile', { defaultValue: 'Markdown Files' }), // Fallback just in case
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
      setDriveFileId(null);
      setDriveFileName(null);
      setStatusMsg(t('app.status.opened', { file: file.name }));
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
      setStatusMsg(t('app.status.saved'));
      setTimeout(() => setStatusMsg(""), 2000);
    } catch (err) {
      console.error(err);
      setStatusMsg(t('app.status.saveFailed'));
    }
  };

  const ensureGoogleAuth = async (): Promise<string | null> => {
    const savedExpiry = localStorage.getItem("google_token_expiry");
    const isExpired = savedExpiry ? Date.now() >= parseInt(savedExpiry) : true;

    if (!accessToken || isExpired) {
      return new Promise((resolve) => {
        if (tokenClient) {
          tokenClient.callback = (resp: any) => {
            if (resp.error) {
              resolve(null);
              return;
            }
            setAccessToken(resp.access_token);
            const expiry = Date.now() + resp.expires_in * 1000;
            localStorage.setItem("google_access_token", resp.access_token);
            localStorage.setItem("google_token_expiry", expiry.toString());
            resolve(resp.access_token);
          };
          tokenClient.requestAccessToken({ prompt: "consent" });
        } else {
          resolve(null);
        }
      });
    }
    return accessToken;
  };

  const handleOpenFromDrive = async () => {
    const token = await ensureGoogleAuth();
    if (!token) return;

    try {
      await loadGooglePickerScript();

      const picker = new (window as any).google.picker.PickerBuilder()
        .addView(new (window as any).google.picker.DocsView().setIncludeFolders(true).setMimeTypes('text/markdown,text/plain'))
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setCallback(async (data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            const file = data.docs[0];
            setStatusMsg(t('common.loading'));
            try {
              const content = await downloadDriveFile(file.id, token);
              setMarkdown(content);
              setDriveFileId(file.id);
              setDriveFileName(file.name);
              setFileHandle(null); // Clear local file handle
              setStatusMsg(t('app.status.opened', { file: file.name }));
              setTimeout(() => setStatusMsg(""), 3000);
            } catch (err) {
              console.error(err);
              setStatusMsg(t('common.failed'));
            }
          }
        })
        .build();

      picker.setVisible(true);
    } catch (err) {
      console.error('Error loading picker', err);
    }
  };

  const handleSaveToDrive = async () => {
    const token = await ensureGoogleAuth();
    if (!token) return;

    setStatusMsg(t('common.loading'));
    try {
      if (driveFileId) {
        await updateDriveFile(driveFileId, markdown, token);
        setStatusMsg(t('app.status.saved'));
      } else {
        const defaultName = prompt("Enter file name:", driveFileName || "Untitled.md");
        if (!defaultName) {
          setStatusMsg("");
          return;
        }

        const finalName = defaultName.endsWith('.md') ? defaultName : `${defaultName}.md`;
        const newId = await createDriveFile(finalName, markdown, token);
        setDriveFileId(newId);
        setDriveFileName(finalName);
        setStatusMsg(t('app.status.saved'));
      }
      setTimeout(() => setStatusMsg(""), 2000);
    } catch (err) {
      console.error('Error saving to drive', err);
      setStatusMsg(t('app.status.saveFailed'));
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
      setStatusMsg(t('app.status.saved'));
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
        case "o":
          if (e.shiftKey) {
            e.preventDefault();
            handleOpenFromDrive();
          }
          break;
        case "s":
          e.preventDefault();
          if (e.shiftKey) {
            handleSaveToDrive();
          } else {
            handleSaveFile();
          }
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
      type="button"
      onClick={onClick}
      className="p-1.5 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition"
      title={title}
    >
      <Icon size={16} />
    </button>
  );

  const markdownComponents = useMemo(
    () => ({
      pre: ({ children }: any) => <>{children}</>,
      h1: ({ children, ...props }: any) => {
        const id = slugify(getTextFromChildren(children));
        return (
          <h1 id={id} {...props}>
            {children}
          </h1>
        );
      },
      h2: ({ children, ...props }: any) => {
        const id = slugify(getTextFromChildren(children));
        return (
          <h2 id={id} {...props}>
            {children}
          </h2>
        );
      },
      h3: ({ children, ...props }: any) => {
        const id = slugify(getTextFromChildren(children));
        return (
          <h3 id={id} {...props}>
            {children}
          </h3>
        );
      },
      h4: ({ children, ...props }: any) => {
        const id = slugify(getTextFromChildren(children));
        return (
          <h4 id={id} {...props}>
            {children}
          </h4>
        );
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
    }),
    [darkMode]
  );

  const sharedLinkPlaceholder = (() => {
    switch (sharedLinkState) {
      case 'loading':
        return {
          title: t('app.share.loadingTitle'),
          message: t('app.share.loadingMessage'),
          tone: 'loading',
        };
      case 'expired':
        return {
          title: t('app.share.expiredTitle'),
          message: t('app.share.expiredMessage'),
          tone: 'danger',
        };
      case 'notFound':
        return {
          title: t('app.share.notFoundTitle'),
          message: t('app.share.notFoundMessage'),
          tone: 'danger',
        };
      case 'error':
        return {
          title: t('app.share.errorTitle'),
          message: t('app.share.errorMessage'),
          tone: 'danger',
        };
      default:
        return null;
    }
  })();

  const shouldShowSharedLinkPlaceholder = Boolean(sharedLinkId && sharedLinkState !== 'ready');

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col relative transition-colors duration-300">
      {/* Confirm New File Modal */}
      {showNewFileConfirm && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl p-6 w-full max-w-sm border dark:border-neutral-700">
            <h2 className="text-lg font-bold mb-2 dark:text-white">
              {t('app.newFile.title')}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 mb-6 text-sm">
              {t('app.newFile.message')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewFileConfirm(false)}
                className="px-4 py-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-sm font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmNewFile}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="h-14 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2 font-bold text-blue-600">
          <img src="/logo.png" alt="Markiva" className="w-6 h-6" />
          <span>{t('app.title')}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenFile}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title={t('app.actions.openFile')}
          >
            <FolderOpen size={20} />
          </button>
          <button
            type="button"
            onClick={handleSaveFile}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title={fileHandle ? t('app.actions.save') : t('app.actions.saveAs')}
          >
            <Save size={20} />
          </button>
          <div className="w-px h-5 bg-neutral-300 mx-1"></div>
          <button
            type="button"
            onClick={handleOpenFromDrive}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title={`${t('app.actions.openDrive')} (Ctrl+Shift+O)`}
          >
            <DownloadCloud size={20} />
          </button>
          <button
            type="button"
            onClick={handleSaveToDrive}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title={`${t('app.actions.saveDrive')} (Ctrl+Shift+S)`}
          >
            <UploadCloud size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setView("edit")}
            className={`px-3 py-1 rounded-md text-sm transition ${
              view === "edit"
                ? "bg-white shadow-sm font-medium"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <Code size={16} className="inline mr-1" /> {t('app.view.edit')}
          </button>
          <button
            type="button"
            onClick={() => setView("split")}
            className={`px-3 py-1 rounded-md text-sm transition ${
              view === "split"
                ? "bg-white shadow-sm font-medium"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t('app.view.split')}
          </button>
          <button
            type="button"
            onClick={() => setView("preview")}
            className={`px-3 py-1 rounded-md text-sm transition ${
              view === "preview"
                ? "bg-white shadow-sm font-medium"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <Eye size={16} className="inline mr-1" /> {t('app.view.preview')}
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
                {t('app.actions.openGoogleDoc')} <ExternalLink size={12} />
              </a>
            )}
            {createdDocId && (
              <button
                type="button"
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
            type="button"
            onClick={toggleLanguage}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition font-mono text-sm font-bold"
            title={i18n.language === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
          >
            {i18n.language === 'vi' ? 'EN' : 'VI'}
          </button>

          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title={darkMode ? t('app.theme.light') : t('app.theme.dark')}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            type="button"
            onClick={handleDownloadMD}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title={t('app.actions.downloadMarkdown')}
          >
            <Download size={20} />
          </button>
          <button
            type="button"
            onClick={handlePrintPDF}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title={t('app.actions.print')}
          >
            <Printer size={20} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            title={t('app.actions.share')}
          >
            <Share2 size={20} />
          </button>

          {isInitialized ? (
            !accessToken ? (
              <button
                type="button"
                onClick={handleAuth}
                className="flex items-center gap-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 px-4 py-2 rounded-lg font-medium transition text-sm shadow-sm"
              >
                <LogIn size={16} /> {t('app.actions.connectGoogle')}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                  {t('app.actions.connected')}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                  title={t('app.actions.logout')}
                >
                  <LogOut size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm disabled:opacity-50"
                >
                  {isExporting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <FileDown size={18} />
                  )}{" "}
                  <span>{t('app.actions.exportDocs')}</span>
                </button>
              </div>
            )
          ) : null}
        </div>
      </header>

      {shouldShowSharedLinkPlaceholder && sharedLinkPlaceholder ? (
        <main
          ref={mainRef}
          className="flex-1 flex items-center justify-center px-6 bg-neutral-50 dark:bg-neutral-900"
          style={{ userSelect: isResizing ? "none" : "auto" }}
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-8 text-center shadow-sm">
            {sharedLinkPlaceholder.tone === 'loading' ? (
              <Loader2 size={36} className="mx-auto mb-4 animate-spin text-blue-600" />
            ) : (
              <Share2 size={36} className="mx-auto mb-4 text-red-500" />
            )}
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
              {sharedLinkPlaceholder.title}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {sharedLinkPlaceholder.message}
            </p>
          </div>
        </main>
      ) : (
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
                  title={t('app.toolbar.newFile')}
                />
                <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>

                <ToolbarButton
                  icon={Bold}
                  onClick={() => insertText("**", "**")}
                  title={t('app.toolbar.bold')}
                />
                <ToolbarButton
                  icon={Italic}
                  onClick={() => insertText("*", "*")}
                  title={t('app.toolbar.italic')}
                />
                <ToolbarButton
                  icon={Strikethrough}
                  onClick={() => insertText("~~", "~~")}
                  title={t('app.toolbar.strikethrough')}
                />
                <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>

                <ToolbarButton
                  icon={Heading1}
                  onClick={() => insertText("# ")}
                  title={t('app.toolbar.h1')}
                />
                <ToolbarButton
                  icon={Heading2}
                  onClick={() => insertText("## ")}
                  title={t('app.toolbar.h2')}
                />
                <ToolbarButton
                  icon={Heading3}
                  onClick={() => insertText("### ")}
                  title={t('app.toolbar.h3')}
                />
                <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>

                <ToolbarButton
                  icon={List}
                  onClick={() => insertText("- ")}
                  title={t('app.toolbar.list')}
                />
                <ToolbarButton
                  icon={ListOrdered}
                  onClick={() => insertText("1. ")}
                  title={t('app.toolbar.orderedList')}
                />
                <ToolbarButton
                  icon={CheckSquare}
                  onClick={() => insertText("- [ ] ")}
                  title={t('app.toolbar.taskList')}
                />
                <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>

                <ToolbarButton
                  icon={Quote}
                  onClick={() => insertText("> ")}
                  title={t('app.toolbar.quote')}
                />
                <ToolbarButton
                  icon={Minus}
                  onClick={() => insertText("---\n")}
                  title={t('app.toolbar.horizontalRule')}
                />
                <ToolbarButton
                  icon={Table}
                  onClick={() =>
                    insertText(
                      "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |"
                    )
                  }
                  title={t('app.toolbar.table')}
                />
                <div className="w-px h-4 bg-neutral-200 mx-1 flex-shrink-0"></div>

                <ToolbarButton
                  icon={Link}
                  onClick={() => insertText("[", "](url)")}
                  title={t('app.toolbar.link')}
                />
                <ToolbarButton
                  icon={Image}
                  onClick={() => insertText("![Alt text]", "(url)")}
                  title={t('app.toolbar.image')}
                />
                <ToolbarButton
                  icon={Code2}
                  onClick={() => insertText("```\n", "\n```")}
                  title={t('app.toolbar.codeBlock')}
                />
                <ToolbarButton
                  icon={Network}
                  onClick={() =>
                    insertText(
                      "```mermaid\ngraph TD\n    A[Start] --> B[End]\n```"
                    )
                  }
                  title={t('app.toolbar.mermaid')}
                />
              </div>

              <textarea
                ref={textareaRef}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                onKeyDown={handleKeyDown}
                onScroll={handleEditorScroll}
                className="w-full h-full p-8 font-mono text-sm resize-none focus:outline-none leading-relaxed text-neutral-800 bg-white"
                placeholder={t('app.editor.placeholder')}
              />
            </div>
          )}

          {view === "split" && (
            <button
              type="button"
              aria-label={t('app.actions.resizePanels')}
              className="w-1 bg-neutral-200 hover:bg-blue-400 cursor-col-resize transition-colors z-10 flex-shrink-0"
              onMouseDown={startResizing}
            />
          )}

          {(view === "split" || view === "preview") && (
            <div className={`flex flex-1 overflow-hidden h-full relative ${view === "preview" ? "bg-neutral-100 dark:bg-neutral-900" : ""}`}>
              {/* TOC Sidebar - Only in Preview Mode */}
              {view === 'preview' && (
                <div className="w-72 bg-neutral-50 dark:bg-neutral-900 border-r dark:border-neutral-700 overflow-y-auto hidden lg:block flex-shrink-0 h-full">
                   <TableOfContents markdown={debouncedMarkdown} />
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
                    components={markdownComponents}
                  >
                    {debouncedMarkdown}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

export default App;
