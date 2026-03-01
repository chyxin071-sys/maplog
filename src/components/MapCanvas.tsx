import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Path, Group, Rect, Text } from 'react-konva';
import { Province } from './Province';
import { PROVINCE_CONFIGS, MAP_WIDTH, MAP_HEIGHT, MAP_OFFSET_X, MAP_OFFSET_Y, NINE_DASH_PATHS } from '../constants/mapData';
import { useMapState } from '../hooks/useMapState';
import { Toolbar } from './Toolbar';
import { ImageGallery } from './ImageGallery';

const EXPORT_WIDTH = 2400;
const EXPORT_HEIGHT = 1800;
const EXPORT_MAP_SCALE = 1.8;
const EXPORT_TITLE_FONT_SIZE = 72;
const EXPORT_SUBTITLE_FONT_SIZE = 28;
const EXPORT_TITLE_FONT_FAMILY = "'PingFang SC Thin', 'PingFang SC-Light', 'Helvetica Neue UltraLight', 'Helvetica Neue', 'Microsoft YaHei UI Light', 'Microsoft YaHei', sans-serif";

// Helper to calculate bounding box of SVG path
const calculatePathBounds = (path: string) => {
    // Extract all numbers from path string
    const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number);
    if (!numbers || numbers.length < 2) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // Most commands in the path string are pairs of coordinates.
    // We iterate by 2, assuming x, y pairs.
    for (let i = 0; i < numbers.length; i += 2) {
        const x = numbers[i];
        // Ensure y exists (if odd number of coordinates, skip last)
        if (i + 1 >= numbers.length) break;
        const y = numbers[i+1];
        
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }

    if (minX === Infinity || minY === Infinity) return null;

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
    };
};

const VIEW_CENTER_OFFSET_Y = 110;

export const MapCanvas: React.FC = () => {
  const { states, updateProvince, resetProvince, resetAll, setAllStates } = useMapState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportTitle, setExportTitle] = useState('旅行拼图');
  const [exportSubtitle, setExportSubtitle] = useState('Imprint China · 旅行照片拼图');
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportStep, setExportStep] = useState<'edit' | 'preview'>('edit');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [baseScale, setBaseScale] = useState(1);

  // Viewport state（相对于 baseScale 的缩放）
  const [viewState, setViewState] = useState({
    scale: 1,
    x: 0,
    y: 0,
  });

  // Calculate initial fit
  useEffect(() => {
    const fitMap = () => {
      const padding = 50;
      const availableWidth = window.innerWidth - padding * 2;
      const availableHeight = window.innerHeight - padding * 2;
      
      const scale = Math.min(
        availableWidth / MAP_WIDTH,
        availableHeight / MAP_HEIGHT
      );
      
      const x = (window.innerWidth - MAP_WIDTH * scale) / 2;
      const y = (window.innerHeight - MAP_HEIGHT * scale) / 2 + VIEW_CENTER_OFFSET_Y;

      setBaseScale(scale);
      setViewState({ scale: 1, x, y });
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    fitMap();
    window.addEventListener('resize', fitMap);
    return () => window.removeEventListener('resize', fitMap);
  }, []);

  const stageRef = useRef<any>(null);
  const mapContentRef = useRef<any>(null);
  const exportContentRef = useRef<any>(null);
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistRef = useRef<number | null>(null);

  const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  };

  const handleZoomIn = () => {
    setViewState(prev => ({
      ...prev,
      scale: prev.scale * 1.2
    }));
  };

  const handleZoomOut = () => {
    setViewState(prev => ({
      ...prev,
      scale: prev.scale / 1.2
    }));
  };

  const handleResetView = () => {
    const padding = 50;
    const availableWidth = window.innerWidth - padding * 2;
    const availableHeight = window.innerHeight - padding * 2;

    const scale = Math.min(
      availableWidth / MAP_WIDTH,
      availableHeight / MAP_HEIGHT
    );

    const x = (window.innerWidth - MAP_WIDTH * scale) / 2;
    const y = (window.innerHeight - MAP_HEIGHT * scale) / 2 + VIEW_CENTER_OFFSET_Y;

    setBaseScale(scale);
    setViewState({
      scale: 1,
      x,
      y,
    });
  };
  
  const handleToggleGallery = () => {
    setIsGalleryOpen(prev => !prev);
  };

  const fillProvinceWithImage = async (
    provinceId: string,
    image: string,
    boundsOverride?: { width: number; height: number; centerX: number; centerY: number }
  ) => {
    const provinceConfig = PROVINCE_CONFIGS.find(p => p.id === provinceId);
    const bounds = boundsOverride ?? (provinceConfig ? calculatePathBounds(provinceConfig.path) : null);

    const img = new Image();
    img.onload = async () => {
      let scale = 1;
      let x = 0;
      let y = 0;

      if (bounds) {
        const coverScale = Math.max(bounds.width / img.width, bounds.height / img.height);
        scale = coverScale * 1.05;
        x = bounds.centerX - (img.width * scale) / 2;
        y = bounds.centerY - (img.height * scale) / 2;
      } else {
        const targetSize = 300;
        scale = targetSize / Math.max(img.width, img.height);
        x = -(img.width * scale) / 2;
        y = -(img.height * scale) / 2;
      }

      setSelectedId(provinceId);
      setIsEditing(true);

      await updateProvince(provinceId, {
        image,
        x,
        y,
        scale,
        rotation: 0,
      });
    };
    img.src = image;
  };
  
  const handleExportClick = () => {
    setShowExportPreview(true);
    setExportStep('edit');
    setPreviewImage(null);
    setSelectedId(null);
    setIsEditing(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing || !selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        resetProvince(selectedId);
        setSelectedId(null);
        setIsEditing(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditing, selectedId, resetProvince]);

  const handleGeneratePreview = () => {
    if (!stageRef.current) return;

    setIsExporting(true);
    
    setTimeout(() => {
        const stage = stageRef.current;

        const oldScaleX = stage.scaleX();
        const oldScaleY = stage.scaleY();
        const oldX = stage.x();
        const oldY = stage.y();

        stage.scale({ x: 1, y: 1 });
        stage.position({ x: 0, y: 0 });
        stage.batchDraw();

        const uri = stage.toDataURL({ 
            pixelRatio: 3,
            x: 0,
            y: 0,
            width: EXPORT_WIDTH,
            height: EXPORT_HEIGHT,
            mimeType: 'image/jpeg',
            quality: 1
        });

        stage.scale({ x: oldScaleX, y: oldScaleY });
        stage.position({ x: oldX, y: oldY });
        stage.batchDraw();

        setPreviewImage(uri);
        setExportStep('preview');
        setIsExporting(false);
    }, 100);
  };

  const handleConfirmExport = () => {
    if (previewImage) {
        const link = document.createElement('a');
        link.download = 'imprint-china-map.jpg';
        link.href = previewImage;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setShowExportPreview(false);
        setExportStep('edit');
    }
  };

  const handleExportArchive = () => {
    const data = JSON.stringify(states);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'imprint-china-archive.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportArchive = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        await setAllStates(data);
      } catch (err) {
        alert('导入失败，请检查文件格式');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  // handleSmartFill 已移除

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);
    
    const stage = stageRef.current;
    if (!stage) return;
    
    stage.setPointersPositions(e);
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const hit = stage.getIntersection(pos);
    if (!hit) return;
    
    // Find the province group
    let node = hit;
    let provinceId: string | undefined;
    
    while (node && node !== stage) {
        const id = node.id();
        if (id && PROVINCE_CONFIGS.find(p => p.id === id)) {
            provinceId = id;
            break;
        }
        const parent = node.getParent();
        if (!parent) break;
        node = parent;
    }
    
    if (!provinceId) return;

    const provinceConfig = PROVINCE_CONFIGS.find(p => p.id === provinceId);
    const bounds = provinceConfig ? calculatePathBounds(provinceConfig.path) : null;

    // Handle drag from gallery
    const galleryImage = e.dataTransfer.getData('gallery-image');
    if (galleryImage) {
        fillProvinceWithImage(provinceId, galleryImage, bounds || undefined);
        return;
    }

    // Handle file drop
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        fillProvinceWithImage(provinceId, base64, bounds || undefined);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      
      stage.setPointersPositions(e);
      const pos = stage.getPointerPosition();
      if (!pos) {
          setDragOverId(null);
          return;
      }

      const hit = stage.getIntersection(pos);
      if (!hit) {
          setDragOverId(null);
          return;
      }

      // Find the province group
      let node = hit;
      let provinceId: string | undefined;
      
      while (node && node !== stage) {
          const id = node.id();
          if (id && PROVINCE_CONFIGS.find(p => p.id === id)) {
              provinceId = id;
              break;
          }
          const parent = node.getParent();
          if (!parent) break;
          node = parent;
      }

      if (provinceId) {
          setDragOverId(provinceId);
      } else {
          setDragOverId(null);
      }
  };

  const handleFillWithGalleryImage = (image: string) => {
    if (!selectedId) {
      alert('请先选择一个省份');
      return;
    }
    const provinceConfig = PROVINCE_CONFIGS.find(p => p.id === selectedId);
    const bounds = provinceConfig ? calculatePathBounds(provinceConfig.path) : null;
    fillProvinceWithImage(selectedId, image, bounds || undefined);
  };

  const MIN_RELATIVE_SCALE = 0.6;
  const MAX_RELATIVE_SCALE = 4;

  const handleTouchMove = (e: any) => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!e.evt.touches || e.evt.touches.length !== 2) return;

    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];
    if (!touch1 || !touch2) return;

    e.evt.preventDefault();

    const p1 = { x: touch1.clientX, y: touch1.clientY };
    const p2 = { x: touch2.clientX, y: touch2.clientY };

    e.evt.preventDefault();

    const newCenter = getCenter(p1, p2);
    const newDist = getDistance(p1, p2);

    if (!lastDistRef.current) {
      lastDistRef.current = newDist;
      lastCenterRef.current = newCenter;
      setIsPinching(true);
      return;
    }

    const oldScale = stage.scaleX();
    const rawScaleBy = newDist / lastDistRef.current;
    const adjustedScaleBy = Math.pow(rawScaleBy, 1.4);
    const tentativeStageScale = oldScale * adjustedScaleBy;
    let relativeScale = tentativeStageScale / baseScale;

    if (relativeScale < MIN_RELATIVE_SCALE) {
      relativeScale = MIN_RELATIVE_SCALE;
    } else if (relativeScale > MAX_RELATIVE_SCALE) {
      relativeScale = MAX_RELATIVE_SCALE;
    }

    const newStageScale = baseScale * relativeScale;

    const pointTo = {
      x: (newCenter.x - stage.x()) / oldScale,
      y: (newCenter.y - stage.y()) / oldScale,
    };

    const newPos = {
      x: newCenter.x - pointTo.x * newStageScale,
      y: newCenter.y - pointTo.y * newStageScale,
    };

    setViewState({
      scale: relativeScale,
      x: newPos.x,
      y: newPos.y,
    });

    lastDistRef.current = newDist;
    lastCenterRef.current = newCenter;
    setIsPinching(true);
  };

  const handleTouchEnd = () => {
    lastDistRef.current = null;
    lastCenterRef.current = null;
    setIsPinching(false);
  };

  const handleTouchStart = (e: any) => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!e.evt.touches) return;

    if (e.evt.touches.length === 2) {
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];
      if (!touch1 || !touch2) return;

      const p1 = { x: touch1.clientX, y: touch1.clientY };
      const p2 = { x: touch2.clientX, y: touch2.clientY };

      lastDistRef.current = getDistance(p1, p2);
      lastCenterRef.current = getCenter(p1, p2);
      setIsPinching(true);
      e.evt.preventDefault();
    } else {
      lastDistRef.current = null;
      lastCenterRef.current = null;
      setIsPinching(false);
    }
  };

  const handleStageClickOrTap = (e: any) => {
    const stage = e.target.getStage();
    if (!stage) return;

    let node: any = e.target;
    let provinceId: string | undefined;

    while (node && node !== stage) {
      const id = node.id && node.id();
      if (id && PROVINCE_CONFIGS.find(p => p.id === id)) {
        provinceId = id;
        break;
      }
      const parent = node.getParent && node.getParent();
      if (!parent) break;
      node = parent;
    }

    if (!isEditing) {
      if (!provinceId) {
        setSelectedId(null);
      }
      return;
    }

    if (provinceId !== selectedId) {
      setSelectedId(null);
      setIsEditing(false);
    }
  };

  return (
    <div 
      className="relative w-full h-screen bg-[#F5F5F7] flex flex-col items-center justify-center overflow-hidden font-sans"
      onDragOver={handleDragOver}
      onDrop={handleFileDrop}
    >
      <ImageGallery 
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        onDragStart={(e, image) => {
          e.dataTransfer.setData('gallery-image', image);
        }}
        onFillWithImage={handleFillWithGalleryImage}
        hasActiveProvince={!!selectedId}
      />

      {!showExportPreview && (
        <div className="absolute top-12 left-12 z-10 pointer-events-none select-none">
            <h1 className="text-4xl font-extralight tracking-[0.2em] text-gray-900">旅行拼图</h1>
            <div className="h-px w-24 bg-gray-400 my-4"></div>
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">Imprint China · 旅行照片拼图</p>
        </div>
      )}

      {/* Export Preview Panel - Centered */}
      {showExportPreview && (
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white/95 p-6 rounded-2xl shadow-2xl backdrop-blur-md border border-gray-200 transition-all duration-300 ease-in-out ${exportStep === 'preview' ? 'w-[80vw] max-w-4xl h-[80vh] flex flex-col' : 'w-96'}`}>
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${exportStep === 'preview' ? 'bg-blue-500' : 'bg-green-500'} animate-pulse`}></span>
                    {exportStep === 'preview' ? '确认导出' : '导出设置'}
                </h2>
                <button 
                    onClick={() => setShowExportPreview(false)}
                    className="text-gray-400 hover:text-gray-600"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            
            {exportStep === 'edit' ? (
                <>
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">主标题</label>
                            <input 
                                type="text" 
                                value={exportTitle}
                                onChange={(e) => setExportTitle(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-light tracking-widest transition-all"
                                placeholder="输入主标题..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">副标题</label>
                            <input 
                                type="text" 
                                value={exportSubtitle}
                                onChange={(e) => setExportSubtitle(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs tracking-widest uppercase transition-all"
                                placeholder="输入副标题..."
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowExportPreview(false)}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium"
                        >
                            取消
                        </button>
                        <button 
                            onClick={() => {
                                // Trigger preview generation
                                setIsExporting(true); // Temporarily show text on map
                                // Use timeout to ensure render cycle completes
                                setTimeout(handleGeneratePreview, 50);
                            }}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 active:scale-95 transition-all shadow-lg text-sm font-medium flex items-center justify-center gap-2"
                        >
                            <span>查看预览</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </button>
                    </div>
                    
                    <p className="text-center text-[10px] text-gray-400 mt-4">
                        预览模式下背景为白色，导出将包含当前视图内容
                    </p>
                </>
            ) : (
                <>
                    <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center mb-6 relative group">
                        {previewImage ? (
                            <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain shadow-lg" />
                        ) : (
                            <div className="animate-pulse flex flex-col items-center text-gray-400">
                                <div className="w-12 h-12 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4"></div>
                                <span className="text-sm">正在生成预览...</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-3 flex-shrink-0">
                         <button 
                            onClick={() => {
                                setExportStep('edit');
                                setPreviewImage(null);
                            }}
                            className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                            返回修改
                        </button>
                        <button 
                            onClick={handleConfirmExport}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 active:scale-95 transition-all shadow-lg text-sm font-medium flex items-center justify-center gap-2"
                        >
                            <span>确认导出图片</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </button>
                    </div>
                </>
            )}
        </div>
      )}

      <Toolbar 
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onExportImage={handleExportClick}
        onResetAll={resetAll}
        scale={viewState.scale}
        onToggleGallery={handleToggleGallery}
      />
      
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        draggable={!isEditing && !isPinching}
        onWheel={(e) => {
          if (isEditing) return;
          e.evt.preventDefault();
          const scaleBy = 1.1;
          const stage = e.target.getStage();
          const oldScale = stage!.scaleX();
          const mousePointTo = {
            x: stage!.getPointerPosition()!.x / oldScale - stage!.x() / oldScale,
            y: stage!.getPointerPosition()!.y / oldScale - stage!.y() / oldScale,
          };

          const newStageScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
          const relativeScale = newStageScale / baseScale;

          setViewState({
            scale: relativeScale,
            x: -(mousePointTo.x - stage!.getPointerPosition()!.x / newStageScale) * newStageScale,
            y: -(mousePointTo.y - stage!.getPointerPosition()!.y / newStageScale) * newStageScale,
          });
        }}
        scaleX={baseScale * viewState.scale}
        scaleY={baseScale * viewState.scale}
        x={viewState.x}
        y={viewState.y}
        onDragEnd={(e) => {
            if (e.target !== e.target.getStage()) return;
            setViewState(prev => ({
                ...prev,
                x: e.target.x(),
                y: e.target.y()
            }));
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={handleStageClickOrTap}
        onTap={handleStageClickOrTap}
      >
        <Layer>
            <Group ref={mapContentRef}>
                {/* Background for export */}
                <Rect 
                    x={0} 
                    y={0} 
                    width={EXPORT_WIDTH} 
                    height={EXPORT_HEIGHT} 
                    fill="white" 
                    visible={isExporting || showExportPreview} 
                />

                    {/* 导出内容：标题 + 中国地图 */}
                    <Group ref={exportContentRef}>
                        {/* Export Title & Subtitle - Visible during export OR preview */}
                        {(isExporting || showExportPreview) && (
                            <Group x={80} y={120}>
                                <Text
                                    text={exportTitle}
                                    fontSize={EXPORT_TITLE_FONT_SIZE}
                                    fontFamily={EXPORT_TITLE_FONT_FAMILY}
                                    fill="#111827"
                                    letterSpacing={0.2 * EXPORT_TITLE_FONT_SIZE}
                                />
                                <Rect
                                    x={0}
                                    y={EXPORT_TITLE_FONT_SIZE + 24}
                                    width={400}
                                    height={1}
                                    fill="#9CA3AF"
                                />
                                <Text
                                    text={exportSubtitle}
                                    y={EXPORT_TITLE_FONT_SIZE + 48}
                                    fontSize={EXPORT_SUBTITLE_FONT_SIZE}
                                    fontFamily="sans-serif"
                                    fill="#6B7280"
                                />
                            </Group>
                        )}  
                    
                    {/* Nine-Dash Line & Provinces - Offset Group */}
                    <Group 
                        x={(isExporting || showExportPreview) ? MAP_OFFSET_X : 0} 
                        y={(isExporting || showExportPreview) ? MAP_OFFSET_Y : 0}
                        scaleX={(isExporting || showExportPreview) ? EXPORT_MAP_SCALE : 1}
                        scaleY={(isExporting || showExportPreview) ? EXPORT_MAP_SCALE : 1}
                    >
                        {PROVINCE_CONFIGS.map((config) => (
                        <Province
                            key={config.id}
                            config={config}
                            state={states[config.id]}
                            isSelected={selectedId === config.id}
                            isHovered={hoveredId === config.id}
                            isDimmed={!!hoveredId && hoveredId !== config.id}
                            isDragTarget={dragOverId === config.id}
                            onSelect={(id) => {
                                if (isEditing && selectedId !== id) {
                                    return;
                                }
                                setSelectedId(id);
                                setIsEditing(true);
                            }}
                            onHover={(id) => {
                                if (isEditing) return;
                                setHoveredId(id);
                            }}
                            onUpdate={updateProvince}
                            isEditing={isEditing}
                        />
                        ))}
                        
                        {/* Nine-Dash Line */}
                        {NINE_DASH_PATHS.map((path, index) => (
                            <Path
                            key={index}
                            data={path}
                            stroke="#E2E8F0"
                            strokeWidth={1.5}
                            dash={[5, 5]}
                            listening={false}
                            />
                        ))}
                    </Group>
                </Group>
            </Group>
        </Layer>
      </Stage>
      
      <div className="absolute bottom-4 left-4 text-stone-400 text-sm pointer-events-none select-none">
        <p>拖拽或点击图片填充 • 滚轮/双指缩放 • 拖拽平移</p>
      </div>
    </div>
  );
};
