/** Quantidades em milésimos e valores unitários em décimos de milésimo de real (design.md 3.1). */
export const ESCALA_QTD = 1000;
export const ESCALA_VALOR = 10000;

/**
 * Converte texto digitado no padrão brasileiro ("1.234,5") em inteiro escalado.
 * Retorna null se inválido ou se tiver mais casas decimais que o permitido.
 */
export function lerNumero(texto: string, casas: number): number | null {
  const t = texto.trim().replace(/\s/g, '').replace(/^R\$/, '');
  if (!t) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(t)) return null;
  const [inteira, decimal = ''] = t.replace(/\./g, '').split(',');
  if (decimal.length > casas) return null;
  const n = Number(inteira) * 10 ** casas + Number(decimal.padEnd(casas, '0') || '0');
  return Number.isSafeInteger(n) ? n : null;
}

export const lerQuantidade = (t: string) => lerNumero(t, 3);
export const lerValor = (t: string) => lerNumero(t, 4);

function formatar(escalado: number, casas: number, minimo: number): string {
  const neg = escalado < 0;
  const abs = Math.abs(escalado);
  const inteira = Math.floor(abs / 10 ** casas);
  let dec = String(abs % 10 ** casas).padStart(casas, '0');
  while (dec.length > minimo && dec.endsWith('0')) dec = dec.slice(0, -1);
  const milhar = String(inteira).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}${milhar}${dec ? ',' + dec : ''}`;
}

/** Para campos de edição (sem "R$"). */
export const textoQuantidade = (q: number) => formatar(q, 3, 0);
export const textoValor = (v: number) => formatar(v, 4, 2);

export const formatarQuantidade = (q: number) => formatar(q, 3, 0);
export const formatarValorUnitario = (v: number) => 'R$ ' + formatar(v, 4, 2);
export const formatarCentavos = (c: number) => 'R$ ' + formatar(c, 2, 2);

/** Quantidade (milésimos) x valor unitário (décimos de milésimo) -> centavos, arredondado. */
export function totalCentavos(qtd: number, valor: number): number {
  const produto = BigInt(qtd) * BigInt(valor); // escala 1e7 de real = 1e5 de centavo
  const base = 100000n;
  const q = produto / base;
  const r = produto % base;
  return Number(r * 2n >= base ? q + 1n : q);
}

/** Valor em reais (número) para exportação em planilha. */
export const centavosParaReais = (c: number) => c / 100;
export const valorParaReais = (v: number) => v / ESCALA_VALOR;
export const quantidadeParaNumero = (q: number) => q / ESCALA_QTD;

/**
 * Máscara de dinheiro (revisão 5): o texto digitado vira centavos preenchidos da direita.
 * "5" -> "0,05", "500" -> "5,00", "123456" -> "1.234,56". Sem dígitos -> "".
 */
export function mascaraMoeda(digitado: string): string {
  const d = digitado.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13);
  if (!d) return '';
  return formatar(Number(d), 2, 2);
}

/** Texto colado ("R$ 1.234,5", "1234,56", "10") convertido para o formato da máscara, ou null se não for valor. */
export function colarMoeda(texto: string): string | null {
  const c = lerNumero(texto, 2);
  return c === null ? null : formatar(c, 2, 2);
}
