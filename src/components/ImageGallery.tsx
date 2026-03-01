import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { saveGalleryImage, getAllGalleryImages, deleteGalleryImage, GalleryImage, clearGallery } from '../services/db';

interface ImageGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onDragStart: (e: React.DragEvent, image: string) => void;
  onFillWithImage: (image: string) => void;
  hasActiveProvince: boolean;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  isOpen, 
  onClose, 
  onDragStart, 
  onFillWithImage,
  hasActiveProvince,
}) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const loadedImages = await getAllGalleryImages();
      setImages(loadedImages.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Failed to load gallery images:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            const newImage: GalleryImage = {
              id: crypto.randomUUID(),
              data: base64,
              timestamp: Date.now(),
            };
            await saveGalleryImage(newImage);
            setImages(prev => [newImage, ...prev]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
    // Reset input
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这张图片吗？')) {
      await deleteGalleryImage(id);
      setImages(prev => prev.filter(img => img.id !== id));
    }
  };
  
  const handleClearAll = async () => {
      if (window.confirm('确定要清空图片库吗？')) {
          await clearGallery();
          setImages([]);
      }
  };

  const panelTransform = isOpen
    ? 'translate-y-0 md:translate-x-0 md:translate-y-0'
    : 'translate-y-full md:translate-x-full md:translate-y-0 pointer-events-none';

  return (
    <div
      className={`fixed z-[60] transform transition-transform duration-300 ease-in-out 
        inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto
        ${panelTransform}`}
    >
      <div className="mx-auto max-w-3xl bg-white/95 backdrop-blur-md shadow-2xl border border-gray-200 rounded-t-3xl flex flex-col h-[55vh] w-full
        md:h-full md:w-[360px] md:max-w-none md:rounded-t-none md:rounded-l-3xl">
        {/* Header */}
        <div className="relative p-4 border-b border-gray-200/50 flex justify-between items-center bg-white/70 rounded-t-3xl md:rounded-t-none">
          <h2 className="text-lg font-light tracking-widest text-gray-800 flex items-center gap-2">
            <ImageIcon size={18} />
            图库
          </h2>
          <div className="flex items-center gap-1">
             {images.length > 0 && (
                <button 
                    onClick={handleClearAll}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="清空图库"
                >
                    <Trash2 size={16} />
                </button>
             )}
          </div>
          <button 
            onClick={onClose}
            className="absolute left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 text-xs font-medium flex items-center gap-1 transition-colors md:hidden"
            title="收起图库"
          >
            <ChevronDown size={14} />
            收起
          </button>
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          <div className="grid grid-cols-3 gap-3">
            {/* Upload Tile */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative aspect-square rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-400 hover:bg-blue-50/40 transition-all group"
            >
              <Upload size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-[10px] text-gray-500 font-medium group-hover:text-blue-600">
                上传图片
              </span>
            </button>

            {images.map((img) => (
              <div 
                key={img.id} 
                className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-white cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
                draggable
                onDragStart={(e) => onDragStart(e, img.data)}
                onClick={() => setActiveImageId(prev => prev === img.id ? null : img.id)}
              >
                <img 
                  src={img.data} 
                  alt="Gallery item" 
                  className="w-full h-full object-cover"
                />
                {activeImageId === img.id && hasActiveProvince && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFillWithImage(img.data);
                      setActiveImageId(null);
                    }}
                    className="absolute inset-0 bg-black/45 text-white text-xs font-medium flex items-center justify-center"
                  >
                    填充到选中省份
                  </button>
                )}
                <button 
                  onClick={(e) => handleDelete(img.id, e)}
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                  title="删除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          {images.length === 0 && (
            <div className="mt-3 text-center text-gray-400 text-xs">
              暂无图片，先上传几张吧～
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept="image/*" 
            onChange={handleFileUpload} 
          />
        </div>
      </div>
    </div>
  );
};
