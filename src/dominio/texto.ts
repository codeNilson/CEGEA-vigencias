/** Utilitários de texto: busca sem acento, ordenação por número de documento, comparação de nomes. */

/** Minúsculas, sem acentos e com espaços simples. Para busca. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Todas as palavras da busca aparecem no texto (sem acento, sem maiúsculas). */
export function casaBusca(texto: string, busca: string): boolean {
  const t = normalizar(texto);
  return normalizar(busca)
    .split(' ')
    .filter(Boolean)
    .every((p) => t.includes(p));
}

/** Lê "NÚMERO/ANO", aceitando prefixos ("ARP", "Nº") e espaços. Ano com 2 dígitos vira 20xx. */
export function lerNumeroAno(numero: string): { n: number; ano: number } | null {
  const m = numero.match(/(\d+)\s*\/\s*(\d{2}|\d{4})\s*$/);
  if (!m) return null;
  const ano = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  return { n: Number(m[1]), ano };
}

/**
 * Ordem por número: NÚMERO/ANO primeiro, mais recentes no topo (ano decrescente, depois número
 * decrescente). Números fora do padrão vão para o fim, em ordem alfabética natural.
 */
export function compararNumeroDoc(a: string, b: string): number {
  const x = lerNumeroAno(a);
  const y = lerNumeroAno(b);
  if (x && y) return y.ano - x.ano || y.n - x.n || a.localeCompare(b, 'pt-BR', { numeric: true });
  if (x) return -1;
  if (y) return 1;
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

/** Nome de empresa reduzido ao essencial, para achar cadastros repetidos. */
const SUFIXOS = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 's a', 'mei', 'ss', 'cia', 'comercio', 'servicos', 'e', 'de', 'da', 'do', 'das', 'dos']);
export function nomeEssencial(nome: string): string {
  return normalizar(nome)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter((p) => p && !SUFIXOS.has(p))
    .join(' ');
}

/** Nomes que parecem a mesma empresa: iguais no essencial, ou um contém o outro (com pelo menos 5 letras). */
export function nomesParecidos(a: string, b: string): boolean {
  const x = nomeEssencial(a);
  const y = nomeEssencial(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [curto, longo] = x.length <= y.length ? [x, y] : [y, x];
  return curto.length >= 5 && ` ${longo} `.includes(` ${curto} `);
}

/** Confere os dígitos verificadores do CNPJ (só números). Vazio é aceito. */
export function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '');
  if (!d) return true;
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = base.split('').reduce((acc, c, i) => acc + Number(c) * pesos[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(d.slice(0, 12));
  const d2 = calc(d.slice(0, 12) + d1);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

/** Formata 14 dígitos como 00.000.000/0000-00; outros textos ficam como estão. */
export function formatarCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj.trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Objeto da ARP (campo `tema` nos arquivos): sempre em maiúsculas, sem espaços repetidos. Revisão 5. */
export function formatarObjetoAta(t: string): string {
  return t.replace(/\s+/g, ' ').trimStart().toLocaleUpperCase('pt-BR');
}
export const objetoAta = (a: { tema: string }) => formatarObjetoAta(a.tema).trim();
