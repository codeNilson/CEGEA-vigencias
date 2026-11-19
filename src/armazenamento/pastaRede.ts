import { FORMATO_ATUAL, type Colecao } from '../dominio/tipos';
import { gravarLocal, lerLocal } from './idb';
import { COLECOES, ErroAcesso, type EntradaArquivo, type Lido, type Repositorio } from './repositorio';

const MARCADOR = '_vigencias.json';
const CHAVE_PASTA = 'pasta-dados';

function naoEncontrado(e: unknown) {
  return e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError');
}

/** Pasta de rede via File System Access API do Chrome (design.md 5). */
export class RepositorioPastaRede implements Repositorio {
  readonly nome: string;
  private subpastas = new Map<Colecao, FileSystemDirectoryHandle>();

  constructor(private raiz: FileSystemDirectoryHandle) {
    this.nome = raiz.name;
  }

  private async pasta(c: Colecao) {
    let p = this.subpastas.get(c);
    if (!p) {
      p = await this.raiz.getDirectoryHandle(c, { create: true });
      this.subpastas.set(c, p);
    }
    return p;
  }

  async listar(colecao: Colecao): Promise<EntradaArquivo[]> {
    try {
      const pasta = await this.pasta(colecao);
      const entradas: FileSystemFileHandle[] = [];
      for await (const h of pasta.values()) if (h.kind === 'file' && h.name.endsWith('.json')) entradas.push(h);
      return await emParalelo(entradas, 16, async (h) => ({
        id: h.name.slice(0, -5),
        modificadoEm: (await h.getFile()).lastModified,
      }));
    } catch (e) {
      throw new ErroAcesso(e instanceof Error ? `Falha ao listar ${colecao}: ${e.message}` : undefined);
    }
  }

  async ler(colecao: Colecao, id: string): Promise<Lido | null> {
    try {
      const h = await (await this.pasta(colecao)).getFileHandle(`${id}.json`);
      const f = await h.getFile();
      const texto = await f.text();
      return { dados: JSON.parse(texto), modificadoEm: f.lastModified };
    } catch (e) {
      if (naoEncontrado(e)) return null;
      if (e instanceof SyntaxError) return { dados: { __erro: 'JSON inválido' }, modificadoEm: 0 };
      throw new ErroAcesso();
    }
  }

  async gravar(colecao: Colecao, id: string, dados: unknown): Promise<void> {
    try {
      const h = await (await this.pasta(colecao)).getFileHandle(`${id}.json`, { create: true });
      // createWritable grava num arquivo temporário e só substitui o original no close().
      const w = await h.createWritable();
      await w.write(JSON.stringify(dados, null, 2));
      await w.close();
    } catch {
      throw new ErroAcesso();
    }
  }

  async excluir(colecao: Colecao, id: string): Promise<void> {
    try {
      await (await this.pasta(colecao)).removeEntry(`${id}.json`);
    } catch (e) {
      if (naoEncontrado(e)) return;
      throw new ErroAcesso();
    }
  }
}

async function emParalelo<T, R>(itens: T[], limite: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const r: R[] = new Array(itens.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, async () => {
      while (i < itens.length) {
        const k = i++;
        r[k] = await fn(itens[k]);
      }
    }),
  );
  return r;
}

// ---------- Conexão com a pasta (design.md 2.2) ----------

export const suportaPasta = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

async function temArquivo(p: FileSystemDirectoryHandle, nome: string) {
  try {
    await p.getFileHandle(nome);
    return true;
  } catch {
    return false;
  }
}

async function estaVazia(p: FileSystemDirectoryHandle) {
  for await (const _ of p.keys()) return false;
  return true;
}

/**
 * Confere se a pasta escolhida é a pasta de dados.
 * Aceita também a pasta "pai" que contém "dados". Inicializa uma pasta vazia.
 */
export async function prepararPasta(escolhida: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  if (await temArquivo(escolhida, MARCADOR)) return escolhida;
  try {
    const dados = await escolhida.getDirectoryHandle('dados');
    if (await temArquivo(dados, MARCADOR)) return dados;
  } catch {
    /* sem subpasta dados */
  }
  if (await estaVazia(escolhida)) {
    const h = await escolhida.getFileHandle(MARCADOR, { create: true });
    const w = await h.createWritable();
    await w.write(JSON.stringify({ sistema: 'Vigências', formato: FORMATO_ATUAL, criadoEm: new Date().toISOString() }, null, 2));
    await w.close();
    for (const c of COLECOES) await escolhida.getDirectoryHandle(c, { create: true });
    return escolhida;
  }
  throw new Error(
    `A pasta "${escolhida.name}" não é a pasta de dados do sistema (falta o arquivo ${MARCADOR}) e não está vazia. Escolha a pasta "dados" ou uma pasta vazia para começar.`,
  );
}

export async function escolherPasta(): Promise<RepositorioPastaRede> {
  const escolhida = await window.showDirectoryPicker({ id: 'vigencias-dados', mode: 'readwrite' });
  const pasta = await prepararPasta(escolhida);
  await gravarLocal('config', CHAVE_PASTA, pasta);
  return new RepositorioPastaRede(pasta);
}

export type EstadoPastaSalva =
  | { tipo: 'nenhuma' }
  | { tipo: 'pronta'; repo: RepositorioPastaRede }
  | { tipo: 'precisa-permissao'; nome: string; handle: FileSystemDirectoryHandle };

export async function recuperarPasta(): Promise<EstadoPastaSalva> {
  const handle = await lerLocal<FileSystemDirectoryHandle>('config', CHAVE_PASTA);
  if (!handle) return { tipo: 'nenhuma' };
  const p = await handle.queryPermission({ mode: 'readwrite' });
  if (p === 'granted') return { tipo: 'pronta', repo: new RepositorioPastaRede(handle) };
  return { tipo: 'precisa-permissao', nome: handle.name, handle };
}

/** Precisa ser chamado a partir de um clique do usuário. */
export async function concederPermissao(handle: FileSystemDirectoryHandle): Promise<RepositorioPastaRede | null> {
  const p = await handle.requestPermission({ mode: 'readwrite' });
  return p === 'granted' ? new RepositorioPastaRede(handle) : null;
}
