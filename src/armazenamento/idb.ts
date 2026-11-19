/**
 * IndexedDB local (design.md 5): guarda a referência à pasta de dados e o cache de leitura.
 * Nunca guarda dados oficiais. A fonte da verdade é a pasta de rede.
 */

const NOME = 'vigencias';
const LOJAS = ['config', 'cache'] as const;
type Loja = (typeof LOJAS)[number];

let aberto: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (!aberto) {
    aberto = new Promise((ok, falha) => {
      const req = indexedDB.open(NOME, 1);
      req.onupgradeneeded = () => {
        for (const l of LOJAS) if (!req.result.objectStoreNames.contains(l)) req.result.createObjectStore(l);
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => falha(req.error);
    });
  }
  return aberto;
}

function promessa<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((ok, falha) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

export async function lerLocal<T>(loja: Loja, chave: string): Promise<T | undefined> {
  try {
    const db = await abrir();
    return (await promessa(db.transaction(loja).objectStore(loja).get(chave))) as T | undefined;
  } catch {
    return undefined;
  }
}

export async function gravarLocal(loja: Loja, chave: string, valor: unknown): Promise<void> {
  try {
    const db = await abrir();
    await promessa(db.transaction(loja, 'readwrite').objectStore(loja).put(valor, chave));
  } catch {
    /* cache é opcional */
  }
}

export async function apagarLocal(loja: Loja, chave: string): Promise<void> {
  try {
    const db = await abrir();
    await promessa(db.transaction(loja, 'readwrite').objectStore(loja).delete(chave));
  } catch {
    /* cache é opcional */
  }
}
