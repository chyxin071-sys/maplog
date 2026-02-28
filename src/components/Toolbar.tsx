import React, { useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, Download, Trash2, FolderUp, FolderDown } from 'lucide-react';

interface ToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onExportImage: () => void;
  onResetAll: () => void;
  scale: number;
}

const TooltipButton: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  className?: string;
  variant?: 'default' | 'danger' | 'primary';
}> = ({ onClick, icon, label, className = '', variant = 'default' }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const baseStyles = "relative p-3 rounded-xl transition-all duration-300 ease-out flex items-center justify-center group";
  const variants = {
    default: "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900",
    primary: "text-gray-600 hover:bg-blue-50 hover:text-blue-600",
    danger: "text-gray-600 hover:bg-red-50 hover:text-red-600",
  };

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="transform transition-transform duration-200 group-hover:scale-110">
        {icon}
      </div>
      
      {/* High-end Tooltip */}
      <div 
        className={`
          absolute bottom-full mb-3 px-3 py-1.5 
          bg-gray-900/90 text-white text-xs font-medium tracking-wide
          rounded-lg shadow-xl backdrop-blur-sm whitespace-nowrap
          transform transition-all duration-200 origin-bottom
          pointer-events-none z-50
          ${showTooltip ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'}
        `}
      >
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900/90"></div>
      </div>
    </button>
  );
};

export const Toolbar: React.FC<ToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  onExportImage,
  onResetAll,
  scale,
}) => {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <div className="
        flex items-center gap-1 p-2 
        bg-white/80 backdrop-blur-xl 
        border border-white/40 shadow-2xl shadow-black/5
        rounded-2xl transition-all duration-300 hover:shadow-black/10 hover:bg-white/90
      ">
        {/* View Controls Group */}
        <div className="flex items-center gap-1 pr-2 border-r border-gray-200/50">
          <TooltipButton onClick={onZoomOut} icon={<ZoomOut size={20} strokeWidth={1.5} />} label="缩小" />
          <div className="w-12 text-center text-xs font-medium text-gray-400 font-mono select-none">
            {Math.round(scale * 100)}%
          </div>
          <TooltipButton onClick={onZoomIn} icon={<ZoomIn size={20} strokeWidth={1.5} />} label="放大" />
          <TooltipButton onClick={onResetView} icon={<Maximize size={20} strokeWidth={1.5} />} label="重置视图" />
        </div>

        {/* Action Controls Group */}
        <div className="flex items-center gap-1 pl-2">
          <TooltipButton 
            onClick={onExportImage} 
            icon={<Download size={20} strokeWidth={1.5} />} 
            label="保存图片" 
            variant="primary"
          />
          <TooltipButton 
            onClick={onResetAll} 
            icon={<Trash2 size={20} strokeWidth={1.5} />} 
            label="清空地图" 
            variant="danger"
          />
        </div>
      </div>
    </div>
  );
};
