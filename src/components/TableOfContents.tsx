import { useEffect, useState } from 'react';
import { slugify } from '../utils/slugify';
import { useTranslation } from 'react-i18next';

interface TocItem {
  level: number;
  text: string;
  id: string;
}

export const TableOfContents = ({ markdown }: { markdown: string }) => {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    const lines = markdown.split('\n');
    const extracted: TocItem[] = [];
    let inCodeBlock = false;

    lines.forEach(line => {
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            return;
        }
        if (inCodeBlock) return;

        const match = line.match(/^(#{1,6})\s+(.+)$/);
        if (match) {
            const level = match[1].length;
            const text = match[2].trim();
            const id = slugify(text);
            // Only add if text is not empty
            if (text) {
                extracted.push({ level, text, id });
            }
        }
    });
    setHeadings(extracted);
  }, [markdown]);

  if (headings.length === 0) return null;

  return (
    <div className="toc p-4 text-sm w-full">
      <h3 className="font-bold mb-4 text-neutral-500 uppercase text-xs dark:text-neutral-400">{t('toc.title')}</h3>
      <ul className="space-y-2">
        {headings.map((h, i) => (
          <li key={i} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
            <a
               href={`#${h.id}`}
               className="text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 block truncate transition-colors"
               onClick={(e) => {
                   e.preventDefault();
                   document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
               }}
               title={h.text}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
