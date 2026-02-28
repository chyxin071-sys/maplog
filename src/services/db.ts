import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'imprint-china-db';
const STORE_NAME = 'province-photos';
const GALLERY_STORE_NAME = 'image-gallery';

export interface ProvinceData {
  id: string;
  image: string; // base64 or blob url
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface GalleryImage {
  id: string;
  data: string; // base64
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase<any>>;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 1) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (oldVersion < 2) {
            db.createObjectStore(GALLERY_STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

// Gallery Operations
export const saveGalleryImage = async (image: GalleryImage) => {
    const db = await getDB();
    return db.put(GALLERY_STORE_NAME, image);
};

export const getAllGalleryImages = async (): Promise<GalleryImage[]> => {
    const db = await getDB();
    return db.getAll(GALLERY_STORE_NAME);
};

export const deleteGalleryImage = async (id: string) => {
    const db = await getDB();
    return db.delete(GALLERY_STORE_NAME, id);
};

export const clearGallery = async () => {
  const db = await getDB();
  return db.clear(GALLERY_STORE_NAME);
};

export const saveProvinceData = async (data: ProvinceData) => {
  const db = await getDB();
  return db.put(STORE_NAME, data);
};

export const getProvinceData = async (id: string): Promise<ProvinceData | undefined> => {
  const db = await getDB();
  return db.get(STORE_NAME, id);
};

export const getAllProvincesData = async (): Promise<ProvinceData[]> => {
  const db = await getDB();
  return db.getAll(STORE_NAME);
};

export const deleteProvinceData = async (id: string) => {
  const db = await getDB();
  return db.delete(STORE_NAME, id);
};

export const clearAllProvincesData = async () => {
  const db = await getDB();
  return db.clear(STORE_NAME);
};
