import { compararVersoes } from './versao';

/** Uma versão do CHANGELOG.md (formato Keep a Changelog, cabeçalhos "## [1.2.0] - 2026-11-18 ..."). */
export interface NotaVersao {
  versao: string;
  /** AAAA-MM-DD, ou vazio. */
  data: string;
  /** Texto depois da data no cabeçalho, ex.: "(revisão 5)". */
  rotulo: string;
  secoes: Array<{ titulo: string; itens: string[] }>;
}

export function lerChangelog(texto: string): NotaVersao[] {
  const notas: NotaVersao[] = [];
  let atual: NotaVersao | null = null;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trimEnd();
    const cab = /^##\s+\[?v?(\d+\.\d+\.\d+)\]?\s*(?:-\s*(\d{4}-\d{2}-\d{2}))?\s*(.*)$/.exec(linha);
    if (cab) {
      atual = { versao: cab[1], data: cab[2] ?? '', rotulo: cab[3].trim(), secoes: [] };
      notas.push(atual);
      continue;
    }
    if (/^##\s/.test(linha)) {
      // Outro cabeçalho de nível 2 (ex.: "## [Não publicado]"): não pertence a nenhuma versão.
      atual = null;
      continue;
    }
    if (!atual) continue;
    const sec = /^###\s+(.+)$/.exec(linha);
    if (sec) {
      atual.secoes.push({ titulo: sec[1].trim(), itens: [] });
      continue;
    }
    const item = /^\s*[-*]\s+(.+)$/.exec(linha);
    if (item) {
      if (!atual.secoes.length) atual.secoes.push({ titulo: 'Alterações', itens: [] });
      atual.secoes[atual.secoes.length - 1].itens.push(item[1].trim());
    } else if (linha.trim() && atual.secoes.length && atual.secoes[atual.secoes.length - 1].itens.length) {
      // Continuação de item em mais de uma linha.
      const s = atual.secoes[atual.secoes.length - 1];
      s.itens[s.itens.length - 1] += ' ' + linha.trim();
    }
  }
  return notas.sort((a, b) => compararVersoes(b.versao, a.versao));
}

/** Versões depois de `de` (exclusive) até `ate` (inclusive), mais nova primeiro. */
export function notasEntre(notas: NotaVersao[], de: string, ate: string): NotaVersao[] {
  return notas.filter((n) => compararVersoes(n.versao, de) > 0 && compararVersoes(n.versao, ate) <= 0);
}
