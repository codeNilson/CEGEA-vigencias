/**
 * Mesclagem em três vias (design.md 4.2).
 * - Campos simples: se só um lado mudou, vale esse lado. Se os dois mudaram diferente, conflito.
 * - Listas de objetos com `id`: comparadas elemento a elemento pelo id.
 *   Adicionado em um lado entra; removido em um lado e intocado no outro sai;
 *   alterado nos dois lados (ou alterado em um e removido no outro) vira conflito.
 */

export type Segmento = string | { id: string };
export type Caminho = Segmento[];
export type Lado = 'minha' | 'deles';
export type Escolhas = Record<string, Lado>;

export interface Conflito {
  chave: string;
  caminho: Caminho;
  base: unknown;
  minha: unknown;
  deles: unknown;
}

/** Campos de controle: nunca geram conflito, são definidos na gravação. */
const CONTROLE = new Set(['versao', 'atualizadoEm']);

type Obj = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const ehListaComId = (v: unknown): v is Array<Obj & { id: string }> =>
  Array.isArray(v) && v.every((e) => ehObjeto(e) && typeof e.id === 'string');

export function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => igual(x, b[i]));
  if (ehObjeto(a) && ehObjeto(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => igual(a[k], b[k]));
  }
  return false;
}

export const chaveDoCaminho = (c: Caminho) =>
  c.map((s) => (typeof s === 'string' ? s : `#${s.id}`)).join('.');

export function mesclar<T>(base: T | undefined, minha: T, deles: T, escolhas: Escolhas = {}) {
  const conflitos: Conflito[] = [];

  function m(b: unknown, x: unknown, y: unknown, caminho: Caminho): unknown {
    if (igual(x, y)) return x;
    if (igual(b, x)) return y;
    if (igual(b, y)) return x;

    if (ehObjeto(x) && ehObjeto(y) && (b === undefined || ehObjeto(b))) {
      const r: Obj = {};
      for (const k of new Set([...Object.keys(y), ...Object.keys(x)])) {
        if (CONTROLE.has(k) && caminho.length === 0) {
          r[k] = y[k];
          continue;
        }
        const v = m(b?.[k], x[k], y[k], [...caminho, k]);
        if (v !== undefined) r[k] = v;
      }
      return r;
    }

    if (ehListaComId(x) && ehListaComId(y) && (b === undefined || ehListaComId(b))) {
      const ids = [...y.map((e) => e.id), ...x.map((e) => e.id).filter((id) => !y.some((e) => e.id === id))];
      const r: unknown[] = [];
      for (const id of ids) {
        const v = m(
          b?.find((e) => e.id === id),
          x.find((e) => e.id === id),
          y.find((e) => e.id === id),
          [...caminho, { id }],
        );
        if (v !== undefined) r.push(v);
      }
      return r;
    }

    const chave = chaveDoCaminho(caminho);
    const escolha = escolhas[chave];
    if (escolha) return escolha === 'minha' ? x : y;
    conflitos.push({ chave, caminho, base: b, minha: x, deles: y });
    return x;
  }

  const resultado = m(base, minha, deles, []) as T;
  return { resultado, conflitos };
}
