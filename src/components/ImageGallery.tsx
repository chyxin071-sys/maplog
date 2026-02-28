import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { saveGalleryImage, getAllGalleryImages, deleteGalleryImage, GalleryImage, clearGallery } from '../services/db';

interface ImageGalleryProps {
  onDragStart: (e: React.DragEvent, image: string) => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ onDragStart }) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadImages();
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

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

  return (
    <div 
      className={`fixed top-0 left-0 h-full z-[9999] transition-transform duration-300 ease-in-out bg-white/90 backdrop-blur-md shadow-2xl border-r border-white/50 flex flex-col w-64 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* Toggle Button Container */}
      <div className="absolute top-1/2 -right-12 flex items-center">
        <button
          onClick={handleToggle}
          className={`w-12 h-32 bg-white shadow-[2px_0_12px_rgba(0,0,0,0.15)] rounded-r-xl flex flex-col items-center justify-center text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all border-y border-r border-gray-100 cursor-pointer ${!isOpen ? 'animate-pulse' : ''}`}
          title={isOpen ? "收起图库" : "展开图库"}
        >
          <div className="flex flex-col items-center gap-2 transform group-hover:scale-110 transition-transform">
              {isOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
              <span className="text-sm font-medium writing-vertical-rl select-none tracking-widest">图库</span>
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col h-full w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200/50 flex justify-between items-center bg-white/50">
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
        </div>

        {/* Upload Area */}
        <div 
          className="p-4 bg-gray-50/50 border-b border-gray-100"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group">
            <Upload size={24} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
            <span className="text-xs text-gray-500 font-medium group-hover:text-blue-600">点击上传图片</span>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept="image/*" 
            onChange={handleFileUpload} 
          />
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            {images.map((img) => (
              <div 
                key={img.id} 
                className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-white cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
                draggable
                onDragStart={(e) => onDragStart(e, img.data)}
              >
                <img 
                  src={img.data} 
                  alt="Gallery item" 
                  className="w-full h-full object-cover"
                />
                <button 
                  onClick={(e) => handleDelete(img.id, e)}
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                  title="删除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {images.length === 0 && (
                <div className="col-span-2 py-10 text-center text-gray-400 text-xs">
                    暂无图片
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
