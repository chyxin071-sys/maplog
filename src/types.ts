export interface ProvinceConfig {
  id: string;
  name: string;
  path: string;
}

export interface ProvinceState {
  id: string;
  image: string | null;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface MapState {
  provinces: Record<string, ProvinceState>;
}
