import React, { useRef, useEffect, useState } from 'react';
import { Path, Group, Text, Tag, Label, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import { ProvinceConfig, ProvinceState } from '../types';
import { PROVINCE_NAMES } from '../utils/provinceMap';
import Konva from 'konva';

// Custom rotation cursor (two curved arrows)
const ROTATION_CURSOR = `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3' stroke='white' stroke-width='4' /%3E%3Cpath d='M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3' stroke='black' stroke-width='2' /%3E%3C/svg%3E") 12 12, auto`;

interface ProvinceProps {
  config: ProvinceConfig;
  state: ProvinceState | undefined;
  isSelected: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<ProvinceState>) => void;
  isEditing: boolean;
  isDragTarget?: boolean;
}

export const Province: React.FC<ProvinceProps> = ({
  config,
  state,
  isSelected,
  isHovered,
  isDimmed,
  onSelect,
  onHover,
  onUpdate,
  isEditing,
  isDragTarget
}) => {
  const [img, status] = useImage(state?.image || '');
  const shapeRef = useRef<Konva.Path>(null);
  const imageRef = useRef<Konva.Image>(null); // The Ghost/Master image
  const clippedImageRef = useRef<Konva.Image>(null); // The Clipped/Slave image
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [center, setCenter] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  
  // Memoize Path2D to avoid recreating it on every frame
  const path2D = React.useMemo(() => {
    return new Path2D(config.path);
  }, [config.path]);

  useEffect(() => {
    // Calculate center of the province path for correct scaling pivot
    if (shapeRef.current) {
      const box = shapeRef.current.getClientRect({ skipTransform: true, relativeTo: groupRef.current?.getParent() });
      setCenter({
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        width: box.width,
        height: box.height
      });
    }
  }, [config.path]);

  useEffect(() => {
    if ((isHovered || isSelected) && groupRef.current) {
        groupRef.current.moveToTop();
    }
  }, [isHovered, isSelected]);

  // Use useLayoutEffect to ensure nodes are attached before paint if possible, 
  // or at least before the next effect.
  React.useLayoutEffect(() => {
    if (isSelected && isEditing && imageRef.current && trRef.current) {
      // Force update transformer nodes
      trRef.current.nodes([imageRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, isEditing, img]);

  // Sync the clipped image with the ghost image during interactions
  const syncImages = () => {
    const master = imageRef.current;
    const slave = clippedImageRef.current;
    if (master && slave) {
      slave.setAttrs({
        x: master.x(),
        y: master.y(),
        scaleX: master.scaleX(),
        scaleY: master.scaleY(),
        rotation: master.rotation(),
      } as any);
    }
  };

  const handleDragMove = () => {
    syncImages();
  };

  const handleTransform = () => {
    syncImages();
  };

  const handleDragEnd = (e: any) => {
    onUpdate(config.id, {
      x: e.target.x(),
      y: e.target.y()
    });
  };

  const handleTransformEnd = (e: any) => {
    const node = imageRef.current;
    if (!node) return;
    onUpdate(config.id, {
      x: node.x(),
      y: node.y(),
      scale: node.scaleX(),
      rotation: node.rotation()
    });
  };

  const scale = isSelected ? 1.08 : (isHovered ? 1.04 : 1);

  return (
    <Group
      ref={groupRef}
      onMouseEnter={() => onHover(config.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(config.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(config.id);
      }}
      id={config.id}
      opacity={isDimmed ? 0.3 : 1}
      // Pivot scaling around the calculated center
      x={center ? center.x : 0}
      y={center ? center.y : 0}
      offsetX={center ? center.x : 0}
      offsetY={center ? center.y : 0}
      scaleX={scale}
      scaleY={scale}
      // Add a strong projection (shadow) effect on hover
      shadowBlur={isHovered ? 50 : 0}
      shadowColor={isHovered ? 'rgba(0,0,0,0.8)' : 'transparent'}
      shadowOffsetY={isHovered ? 25 : 0}
      shadowOffsetX={isHovered ? 12 : 0}
    >
      {/* 1. Ghost Image (The Master) - Visible only when editing */}
      {state?.image && img && status === 'loaded' && isSelected && isEditing && (
        <KonvaImage
          ref={imageRef}
          image={img}
          x={state.x}
          y={state.y}
          scaleX={state.scale}
          scaleY={state.scale}
          rotation={state.rotation}
          opacity={0.4} // Dimmed
          draggable={true}
          onDragMove={handleDragMove}
          onTransform={handleTransform}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
        />
      )}

      {/* 2. Clipped Image (The Slave) - Always visible if image exists */}
      {state?.image && img && status === 'loaded' && (
        <Group
          clipFunc={(ctx) => {
            // Apply the Path2D clip
            ctx.clip(path2D);
            // Add a large rectangle to the current path so Konva's subsequent clip() call
            // has something to intersect with. This prevents an empty path which would clip everything.
            ctx.rect(-10000, -10000, 20000, 20000);
          }}
          listening={false} // Pass events through to Ghost (if editing) or Background Path
        >
          <KonvaImage
            ref={clippedImageRef}
            image={img}
            x={state.x}
            y={state.y}
            scaleX={state.scale}
            scaleY={state.scale}
            rotation={state.rotation}
            listening={false}
          />
        </Group>
      )}

      {/* 3. Background Path (Border/Shape) */}
      <Path
        data={config.path}
        fill={
          state?.image
            ? 'transparent'
            : isSelected
            ? '#e0f2fe'
            : isDragTarget
            ? '#e0f2fe'
            : isHovered
            ? '#f8fafc'
            : '#ffffff'
        }
        stroke={
          isSelected
            ? '#0f172a'
            : isDragTarget
            ? '#3b82f6'
            : isHovered
            ? '#94a3b8'
            : '#cbd5e1'
        }
        strokeWidth={isSelected ? 2.5 : isDragTarget ? 2 : 1}
        ref={shapeRef}
        listening={!state?.image || !isEditing} // If editing image, let clicks pass to image? 
        // Actually, we want to be able to click the province to select it if not selected.
      />

      {/* 4. Transformer */}
      {isSelected && isEditing && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
          anchorFill="#ffffff"
          anchorStroke="#333333"
          borderStroke="#333333"
          anchorSize={10}
          anchorCornerRadius={5}
          borderDash={[4, 4]}
          rotateAnchorCursor={ROTATION_CURSOR}
        />
      )}

      {/* Province Name Label */}
      {(isHovered || isSelected) && center && !isEditing && (
        <Label
          x={center.x}
          y={center.y - 10} // Offset slightly up
          scaleX={1 / scale} // Counter-scale to keep text size constant
          scaleY={1 / scale}
        >
          <Tag
            fill="rgba(20, 20, 20, 0.9)"
            cornerRadius={8}
            pointerDirection="down"
            pointerWidth={12}
            pointerHeight={8}
            shadowColor="black"
            shadowBlur={15}
            shadowOpacity={0.4}
            shadowOffsetY={5}
          />
          <Text
            text={PROVINCE_NAMES[config.id] || config.name}
            fontFamily="sans-serif"
            fontSize={16}
            padding={10}
            fill="#ffffff"
            align="center"
            verticalAlign="middle"
            letterSpacing={2}
          />
        </Label>
      )}
    </Group>
  );
};
