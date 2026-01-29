import { useState } from "react";
import { Check, Copy } from "lucide-react";

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

export default CodeBlock;
