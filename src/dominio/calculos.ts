import { diferencaDias } from './datas';
import { totalCentavos } from './numeros';
import { ehSoRegistro, type AditivoAta, type AditivoContrato, type Ata, type Contrato, type FaixaPrazo, type Ordem, type Parcela, type Situacao } from './tipos';

/** Antecedência do alerta de ata e contrato (RF12). */
export const ALERTA_VIGENCIA_DIAS = 90;
/** Dentro do alerta, destaque mais forte (RF12, revisão 2). */
export const ALERTA_CRITICO_DIAS = 30;

// ---------- Vigência e situação (RF12) ----------

export function dataFimVigenteAta(ata: Ata): string {
  let fim = ata.dataFim;
  let ref = '';
  ata.aditivos.forEach((a) => {
    if (a.novaDataFim && (a.tipo === 'prazo' || a.tipo === 'prazo_quantidade') && a.data >= ref) {
      ref = a.data;
      fim = a.novaDataFim;
    }
  });
  return fim;
}

function aditivosPrazoOrdenados(c: Contrato): AditivoContrato[] {
  return c.aditivos
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.tipo === 'prazo' && a.novaDataFim)
    .sort((x, y) => x.a.inicioEfeitos.localeCompare(y.a.inicioEfeitos) || x.a.dataAssinatura.localeCompare(y.a.dataAssinatura) || x.i - y.i)
    .map(({ a }) => a);
}

export function dataFimVigenteContrato(c: Contrato): string {
  const prazos = aditivosPrazoOrdenados(c);
  return prazos.length ? prazos[prazos.length - 1].novaDataFim! : c.dataFim;
}

export function diasRestantes(dataFim: string, hoje: string): number {
  return diferencaDias(hoje, dataFim);
}

export function situacaoPorData(dataFim: string, hoje: string, encerrado = false): Situacao {
  if (encerrado) return 'encerrado';
  return diasRestantes(dataFim, hoje) < 0 ? 'vencido' : 'vigente';
}

/** Alerta de prazo de um documento vigente. Vencidos e encerrados são 'normal' (não alertam). */
export function faixaPrazo(dias: number, situacao: Situacao): FaixaPrazo {
  if (situacao !== 'vigente') return 'normal';
  if (dias <= ALERTA_CRITICO_DIAS) return 'critico';
  if (dias <= ALERTA_VIGENCIA_DIAS) return 'atencao';
  return 'normal';
}

export const situacaoAta = (ata: Ata, hoje: string) => situacaoPorData(dataFimVigenteAta(ata), hoje);
export const situacaoContrato = (c: Contrato, hoje: string) =>
  situacaoPorData(dataFimVigenteContrato(c), hoje, c.encerramento !== null);

// ---------- Saldo da ata (RF03, RF04) ----------

export function quantidadeVigenteParcela(ata: Ata, parcela: Parcela): number {
  let q = parcela.quantidade;
  let ref = '';
  ata.aditivos.forEach((a) => {
    if (a.tipo === 'prazo' || a.tipo === 'reequilibrio' || ehSoRegistro(a.tipo) || a.data < ref) return;
    const alt = a.quantidades.find((x) => x.parcelaId === parcela.id);
    if (alt) {
      q = alt.novaQuantidade;
      ref = a.data;
    }
  });
  return q;
}

/** D02: só a quantidade original dos itens do contrato consome saldo da ata. */
export function contratadoParcela(parcelaId: string, contratos: Iterable<Contrato>, ignorarContratoId?: string): number {
  let soma = 0;
  for (const c of contratos) {
    if (c.id === ignorarContratoId) continue;
    for (const it of c.itens) if (it.parcelaId === parcelaId) soma += it.quantidade;
  }
  return soma;
}

export function saldoParcela(ata: Ata, parcela: Parcela, contratos: Iterable<Contrato>, ignorarContratoId?: string): number {
  return quantidadeVigenteParcela(ata, parcela) - contratadoParcela(parcela.id, contratos, ignorarContratoId);
}

export function acharParcela(ata: Ata, parcelaId: string) {
  for (const item of ata.itens) {
    const parcela = item.parcelas.find((p) => p.id === parcelaId);
    if (parcela) return { item, parcela };
  }
  return null;
}

// ---------- Contrato: períodos, quantidades, valores, saldos (RF07, RF08) ----------

/** Inícios de período: dataInicio e o início dos efeitos de cada aditivo de prazo. */
export function iniciosDePeriodo(c: Contrato): string[] {
  const inicios = [c.dataInicio, ...aditivosPrazoOrdenados(c).map((a) => a.inicioEfeitos)];
  return [...new Set(inicios)].sort();
}

/** Início do período ao qual a data pertence. */
export function periodoDaData(c: Contrato, data: string): string {
  const inicios = iniciosDePeriodo(c);
  let atual = inicios[0];
  for (const i of inicios) if (i <= data) atual = i;
  return atual;
}

type Campo = 'novaQuantidade' | 'novoValorUnitario';

function valorEmData(c: Contrato, itemId: string, data: string, campo: Campo, original: number): number {
  let v = original;
  c.aditivos
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => (a.tipo === 'valor' || a.tipo === 'reequilibrio') && a.inicioEfeitos <= data)
    .sort((x, y) => x.a.inicioEfeitos.localeCompare(y.a.inicioEfeitos) || x.i - y.i)
    .forEach(({ a }) => {
      const alt = a.alteracoes.find((x) => x.itemId === itemId);
      const novo = alt?.[campo];
      if (novo != null && (campo === 'novoValorUnitario' || a.tipo === 'valor')) v = novo;
    });
  return v;
}

export function quantidadeItemEm(c: Contrato, itemId: string, data: string): number {
  const item = c.itens.find((i) => i.id === itemId);
  if (!item) return 0;
  return valorEmData(c, itemId, data, 'novaQuantidade', item.quantidade);
}

export function valorUnitarioEm(c: Contrato, itemId: string, data: string): number {
  const item = c.itens.find((i) => i.id === itemId);
  if (!item) return 0;
  return valorEmData(c, itemId, data, 'novoValorUnitario', item.valorUnitario);
}

/** CA08.4: valores unitários com a data a partir da qual valem. */
export function historicoValores(c: Contrato, itemId: string): Array<{ desde: string; valor: number; origem: string }> {
  const item = c.itens.find((i) => i.id === itemId);
  if (!item) return [];
  const linhas = [{ desde: c.dataInicio, valor: item.valorUnitario, origem: 'Original' }];
  c.aditivos
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.tipo === 'valor' || a.tipo === 'reequilibrio')
    .sort((x, y) => x.a.inicioEfeitos.localeCompare(y.a.inicioEfeitos) || x.i - y.i)
    .forEach(({ a }) => {
      const alt = a.alteracoes.find((x) => x.itemId === itemId);
      if (alt?.novoValorUnitario != null) {
        linhas.push({
          desde: a.inicioEfeitos,
          valor: alt.novoValorUnitario,
          origem: `${a.tipo === 'reequilibrio' ? 'Reequilíbrio' : 'Aditivo de valor'} ${a.identificacao}`.trim(),
        });
      }
    });
  return linhas;
}

/** Quantidade emitida em OF/OS para o item no período que contém a data. */
export function emitidoNoPeriodo(c: Contrato, itemId: string, data: string, ignorarOrdemId?: string): number {
  const periodo = periodoDaData(c, data);
  let soma = 0;
  for (const o of c.ordens) {
    if (o.id === ignorarOrdemId || periodoDaData(c, o.dataEmissao) !== periodo) continue;
    for (const it of o.itens) if (it.itemId === itemId) soma += it.quantidade;
  }
  return soma;
}

/** CA07.1 / CA08.1: saldo do item no período que contém a data de referência. */
export function saldoItem(c: Contrato, itemId: string, data: string, ignorarOrdemId?: string): number {
  return quantidadeItemEm(c, itemId, data) - emitidoNoPeriodo(c, itemId, data, ignorarOrdemId);
}

/** CA06.3: soma de quantidade x valor unitário vigente. */
export function valorTotalContrato(c: Contrato, hoje: string): number {
  return c.itens.reduce((s, it) => s + totalCentavos(quantidadeItemEm(c, it.id, hoje), valorUnitarioEm(c, it.id, hoje)), 0);
}

/** CA08.5: OF/OS valorada pelo valor unitário vigente na data de emissão. */
export function valorOrdem(c: Contrato, o: Ordem): number {
  return o.itens.reduce((s, it) => s + totalCentavos(it.quantidade, valorUnitarioEm(c, it.itemId, o.dataEmissao)), 0);
}

/** Data a partir da qual um reequilíbrio da ARP vale (início dos efeitos, ou a data do aditivo). */
export const efeitoReequilibrioAta = (a: AditivoAta) => a.inicioEfeitos || a.data;

/** Reequilíbrios da ARP em ordem de efeito. */
export function reequilibriosAta(ata: Ata): AditivoAta[] {
  return ata.aditivos
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.tipo === 'reequilibrio')
    .sort((x, y) => efeitoReequilibrioAta(x.a).localeCompare(efeitoReequilibrioAta(y.a)) || x.a.data.localeCompare(y.a.data) || x.i - y.i)
    .map(({ a }) => a);
}

/**
 * Valor unitário registrado da parcela em vigor na data (revisão 5): o original, ou o do último
 * reequilíbrio com efeito até a data. Sem data: o mais recente.
 */
export function valorParcelaEm(ata: Ata, parcela: Parcela, data = '9999-12-31'): number {
  let v = parcela.valorUnitario;
  for (const a of reequilibriosAta(ata)) {
    if (efeitoReequilibrioAta(a) > data) break;
    const alt = a.valores.find((x) => x.parcelaId === parcela.id);
    if (alt) v = alt.novoValorUnitario;
  }
  return v;
}

/** Reequilíbrios da ARP com efeito depois do início do contrato, que afetam itens dele. Só aviso: o contrato não muda. */
export function reequilibriosPosterioresAoContrato(ata: Ata, c: Contrato): AditivoAta[] {
  const parcelas = new Set(c.itens.map((i) => i.parcelaId).filter(Boolean));
  return reequilibriosAta(ata).filter((a) => efeitoReequilibrioAta(a) > c.dataInicio && a.valores.some((v) => parcelas.has(v.parcelaId)));
}

export function valorTotalAta(ata: Ata, data?: string): number {
  let s = 0;
  for (const item of ata.itens) for (const p of item.parcelas) s += totalCentavos(quantidadeVigenteParcela(ata, p), valorParcelaEm(ata, p, data));
  return s;
}
