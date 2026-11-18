export type GarageVersion = { id: string; label: string; blob: Blob };

export type GarageEntry = {
  id: string;
  bikeId?: string;
  bikeName: string;
  bikeType: string;
  createdAt: number;
  updatedAt: number;
  versions: GarageVersion[];
};

const DATABASE = "motomod-garage";
const STORE = "projects";

function openGarageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el garaje local."));
  });
}

async function useStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openGarageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo acceder al garaje local."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function listGarageEntries(): Promise<GarageEntry[]> {
  const entries = await useStore<GarageEntry[]>("readonly", store => store.getAll());
  return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveGarageEntry(entry: GarageEntry): Promise<IDBValidKey> {
  return useStore<IDBValidKey>("readwrite", store => store.put(entry));
}

export function deleteGarageEntry(id: string): Promise<undefined> {
  return useStore<undefined>("readwrite", store => store.delete(id));
}
