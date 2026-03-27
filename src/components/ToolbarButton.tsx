import React from "react";

interface ToolbarButtonProps {
  icon: any;
  onClick: () => void;
  title: string;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon: Icon,
  onClick,
  title,
}) => (
  <button
    onClick={onClick}
    className="p-1.5 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition"
    title={title}
  >
    <Icon size={16} />
  </button>
);
