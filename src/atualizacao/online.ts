import { z } from 'zod';
import { compararVersoes, VERSAO_APP } from './versao';
import type { NotaVersao } from './notas';

/**
 * Onde o sistema procura versões novas (revisão 6). O CI publica na branch `publicacao` do
 * repositório público ao criar uma tag v*. raw.githubusercontent.com responde com CORS liberado,
 * então o HTML aberto por file:// consegue ler sem senha.
 */
export const FONTE_ATUALIZACAO = 'https://raw.githubusercontent.com/codeNilson/CEGEA-vigencias/publicacao/';
export const PAGINA_VERSOES = 'https://github.com/codeNilson/CEGEA-vigencias/releases';

const NotaSchema = z.object({
  versao: z.string(),
  data: z.string(),
  rotulo: z.string(),
  secoes: z.array(z.object({ titulo: z.string(), itens: z.array(z.string()) })),
});

export const PublicacaoSchema = z.object({
  versao: z.string().regex(/^\d+\.\d+\.\d+$/),
  data: z.string(),
  /** Caminho relativo a FONTE_ATUALIZACAO, imutável por versão (ex.: versoes/Vigencias-1.5.0.html). */
  arquivo: z.string().regex(/^versoes\/[\w.-]+\.html$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  tamanho: z.number().int().positive(),
  notas: z.array(NotaSchema),
});
export type Publicacao = z.infer<typeof PublicacaoSchema> & { notas: NotaVersao[] };

const TEMPO_LIMITE_MS = 15_000;

async function buscar(url: string, ms = TEMPO_LIMITE_MS): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: c.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Consulta a última versão publicada. Devolve null sem internet ou com qualquer falha:
 * o sistema continua funcionando e tenta de novo mais tarde.
 */
export async function consultarPublicacao(): Promise<Publicacao | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    const r = await buscar(`${FONTE_ATUALIZACAO}versao.json?t=${Date.now()}`);
    const v = PublicacaoSchema.safeParse(await r.json());
    return v.success ? v.data : null;
  } catch {
    return null;
  }
}

export const haVersaoNova = (p: Publicacao | null, atual = VERSAO_APP) => !!p && compararVersoes(p.versao, atual) > 0;

export async function sha256Hex(dados: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Baixa o HTML da versão e confere tamanho e SHA-256. Lança erro com mensagem para o usuário. */
export async function baixarPublicacao(p: Publicacao): Promise<ArrayBuffer> {
  let dados: ArrayBuffer;
  try {
    dados = await (await buscar(`${FONTE_ATUALIZACAO}${p.arquivo}`, 120_000)).arrayBuffer();
  } catch {
    throw new Error('Não foi possível baixar a versão nova. Verifique a internet e tente de novo. Nada foi alterado.');
  }
  if (dados.byteLength !== p.tamanho || (await sha256Hex(dados)) !== p.sha256)
    throw new Error('O arquivo baixado não confere com a versão publicada (download incompleto ou alterado). Nada foi alterado. Tente de novo em alguns minutos.');
  const inicio = new TextDecoder().decode(dados.slice(0, 200)).trimStart().toLowerCase();
  if (!inicio.startsWith('<!doctype html')) throw new Error('O arquivo baixado não é o sistema. Nada foi alterado.');
  return dados;
}
