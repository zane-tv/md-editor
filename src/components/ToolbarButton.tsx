import { memo } from 'react';

export const ToolbarButton = memo(({
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
));

ToolbarButton.displayName = 'ToolbarButton';
