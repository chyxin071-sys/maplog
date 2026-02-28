import { useState, useEffect, useCallback } from 'react';
import { ProvinceState } from '../types';
import { getAllProvincesData, saveProvinceData, deleteProvinceData, clearAllProvincesData } from '../services/db';

export function useMapState() {
  const [states, setStates] = useState<Record<string, ProvinceState>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getAllProvincesData();
        const stateMap: Record<string, ProvinceState> = {};
        data.forEach((d) => {
          // Handle potential data mismatch from previous versions or DB format
          const scale = (d as any).scale || (d as any).scaleX || 1;
          stateMap[d.id] = {
            id: d.id,
            image: d.image,
            x: d.x,
            y: d.y,
            scale: scale,
            rotation: d.rotation,
          };
        });
        setStates(stateMap);
      } catch (err) {
        console.error("Failed to load map data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const updateProvince = useCallback(async (id: string, updates: Partial<ProvinceState>) => {
    setStates((prev) => {
      const currentState = prev[id] || {
        id,
        image: null,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
      };
      const newState = { ...currentState, ...updates };
      
      // Save to DB asynchronously
      // We explicitly map ProvinceState to the format expected by DB if strictly typed
      saveProvinceData({
        ...newState,
        scaleX: newState.scale,
        scaleY: newState.scale,
      } as any);

      return { ...prev, [id]: newState };
    });
  }, []);

  const resetProvince = useCallback(async (id: string) => {
    setStates((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    await deleteProvinceData(id);
  }, []);

  const resetAll = useCallback(async () => {
    setStates({});
    await clearAllProvincesData();
  }, []);

  const setAllStates = useCallback(async (newStates: Record<string, ProvinceState>) => {
    setStates(newStates);
    await clearAllProvincesData();
    for (const id in newStates) {
      const state = newStates[id];
      await saveProvinceData({
        ...state,
        scaleX: state.scale,
        scaleY: state.scale,
      } as any);
    }
  }, []);

  return {
    states,
    loading,
    updateProvince,
    resetProvince,
    resetAll,
    setAllStates
  };
}
