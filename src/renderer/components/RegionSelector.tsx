import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check } from 'lucide-react';

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RegionSelectorProps {
  onConfirm: (region: Region) => void;
  onCancel: () => void;
  /** Thumbnail of the screen to select from (optional, for better UX) */
  screenThumbnail?: string;
}

/**
 * Full-screen overlay that lets the user draw a selection rectangle.
 * Used for "Capture de zone".
 */
export function RegionSelector({ onConfirm, onCancel, screenThumbnail }: RegionSelectorProps) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getRegion = useCallback((): Region | null => {
    if (!start || !current) return null;
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    if (width < 20 || height < 20) return null;
    return { x, y, width, height };
  }, [start, current]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = overlayRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStart({ x, y });
    setCurrent({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !start) return;
    const rect = overlayRef.current!.getBoundingClientRect();
    setCurrent({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleConfirm = () => {
    const region = getRegion();
    if (region) onConfirm(region);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') {
        const region = getRegion();
        if (region) onConfirm(region);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm, getRegion]);

  const region = getRegion();

  return (
    <div
      className="region-selector"
      ref={overlayRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {screenThumbnail && (
        <img src={screenThumbnail} className="region-bg" alt="" draggable={false} />
      )}

      {/* Dimmed areas outside selection */}
      {region && (
        <>
          <div className="dim top" style={{ height: region.y }} />
          <div
            className="dim left"
            style={{ top: region.y, height: region.height, width: region.x }}
          />
          <div
            className="dim right"
            style={{
              top: region.y,
              height: region.height,
              left: region.x + region.width,
              width: `calc(100% - ${region.x + region.width}px)`,
            }}
          />
          <div
            className="dim bottom"
            style={{ top: region.y + region.height, height: `calc(100% - ${region.y + region.height}px)` }}
          />
        </>
      )}

      {/* Selection rectangle */}
      {region && (
        <div
          className="selection-rect"
          style={{
            left: region.x,
            top: region.y,
            width: region.width,
            height: region.height,
          }}
        >
          <div className="selection-size">
            {Math.round(region.width)} × {Math.round(region.height)}
          </div>
        </div>
      )}

      {/* Instructions / actions */}
      <div className="region-toolbar">
        <span className="hint">
          {region
            ? 'Ajustez la zone puis validez'
            : 'Cliquez et glissez pour sélectionner une zone'}
        </span>
        <div className="region-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            <X size={16} /> Annuler (Échap)
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={!region}>
            <Check size={16} /> Valider (Entrée)
          </button>
        </div>
      </div>

      <style>{`
        .region-selector {
          position: fixed;
          inset: 0;
          z-index: 9999;
          cursor: crosshair;
          background: rgba(0, 0, 0, 0.55);
          user-select: none;
        }
        .region-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          opacity: 0.4;
          pointer-events: none;
        }
        .dim {
          position: absolute;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.5);
          pointer-events: none;
        }
        .dim.top { top: 0; }
        .dim.bottom { left: 0; right: 0; }
        .dim.left, .dim.right { }
        .selection-rect {
          position: absolute;
          border: 2px solid #58a6ff;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.3);
          background: transparent;
          pointer-events: none;
        }
        .selection-size {
          position: absolute;
          bottom: -28px;
          left: 50%;
          transform: translateX(-50%);
          background: #58a6ff;
          color: #0d1117;
          font-size: 12px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .region-toolbar {
          position: absolute;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 24px;
          box-shadow: var(--shadow);
          cursor: default;
          z-index: 10;
        }
        .hint {
          font-size: 13px;
          color: var(--text-secondary);
        }
        .region-actions {
          display: flex;
          gap: 10px;
        }
      `}</style>
    </div>
  );
}
