import { diferencaDias } from '../dominio/datas';
import {
  ALERTA_VIGENCIA_DIAS,
  dataFimVigenteAta,
  dataFimVigenteContrato,
  diasRestantes,
  faixaPrazo,
  periodoDaData,
  saldoParcela,
  situacaoAta,
  situacaoContrato,
  valorOrdem,
} from '../dominio/calculos';
import { somarDias } from '../dominio/datas';
import { dataLimiteOrdem, ordemEmAlerta, situacaoOrdem } from '../dominio/prazos';
import type { Ata, Contrato, FaixaPrazo, ItemAta, ItemContrato, Ordem, Parcela, Situacao, SituacaoOrdem } from '../dominio/tipos';
import type { EstadoLoja } from './loja';
import { casaBusca, compararNumeroDoc, objetoAta } from '../dominio/texto';

type Base = Pick<EstadoLoja, 'atas' | 'contratos' | 'empresas' | 'hoje'>;

export interface LinhaDoc {
  tipo: 'ata' | 'contrato';
  id: string;
  numero: string;
  objeto: string;
  empresa: string;
  /** Vazio para ARP. */
  empresaId: string;
  tipoContrato: 'material' | 'servico' | null;
  inicio: string;
  vencimento: string;
  vencimentoOriginal: string;
  dias: number;
  situacao: Situacao;
  faixa: FaixaPrazo;
  /** Contrato vencido ainda sem termo de encerramento (RF18). */
  aguardandoEncerramento: boolean;
}

export function linhasDocumentos(e: Base): LinhaDoc[] {
  const linhas: LinhaDoc[] = [];
  for (const a of e.atas.values()) {
    const fim = dataFimVigenteAta(a);
    const dias = diasRestantes(fim, e.hoje);
    const s = situacaoAta(a, e.hoje);
    linhas.push({
      tipo: 'ata', id: a.id, numero: a.numero, objeto: objetoAta(a), empresa: '', empresaId: '', tipoContrato: null,
      inicio: a.dataInicio, vencimento: fim, vencimentoOriginal: a.dataFim, dias, situacao: s, faixa: faixaPrazo(dias, s),
      aguardandoEncerramento: false,
    });
  }
  for (const c of e.contratos.values()) {
    const fim = dataFimVigenteContrato(c);
    const dias = diasRestantes(fim, e.hoje);
    const s = situacaoContrato(c, e.hoje);
    linhas.push({
      tipo: 'contrato', id: c.id, numero: c.numero, objeto: c.objeto,
      empresa: e.empresas.get(c.empresaId)?.nome ?? '(empresa não encontrada)', empresaId: c.empresaId, tipoContrato: c.tipo,
      inicio: c.dataInicio, vencimento: fim, vencimentoOriginal: c.dataFim, dias, situacao: s, faixa: faixaPrazo(dias, s),
      aguardandoEncerramento: s === 'vencido',
    });
  }
  return linhas.sort((x, y) => x.vencimento.localeCompare(y.vencimento) || x.numero.localeCompare(y.numero));
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export interface GrupoMes {
  chave: string;
  mes: string;
  ano: number;
  itens: LinhaDoc[];
}

/** Vigentes que vencem nos próximos 90 dias, agrupados por mês (RF13.1, RF17.1). Meses vazios também aparecem. */
export function vencimentosPorMes(linhas: LinhaDoc[], hoje: string): GrupoMes[] {
  const limite = somarDias(hoje, ALERTA_VIGENCIA_DIAS);
  const grupos: GrupoMes[] = [];
  let [a, m] = hoje.split('-').map(Number);
  const [la, lm] = limite.split('-').map(Number);
  while (a < la || (a === la && m <= lm)) {
    grupos.push({ chave: `${a}-${String(m).padStart(2, '0')}`, mes: MESES[m - 1], ano: a, itens: [] });
    m++;
    if (m > 12) { m = 1; a++; }
  }
  for (const l of linhas) {
    if (l.faixa === 'normal') continue;
    grupos.find((g) => l.vencimento.startsWith(g.chave))?.itens.push(l);
  }
  return grupos;
}

export interface LinhaOrdem {
  contrato: Contrato;
  empresa: string;
  ordem: Ordem;
  limite: string;
  dias: number;
  situacao: SituacaoOrdem;
  valor: number;
  itens: Array<{ descricao: string; unidade: string; quantidade: number }>;
}

function linhaOrdem(c: Contrato, o: Ordem, e: Pick<EstadoLoja, 'empresas' | 'hoje'>): LinhaOrdem {
  const limite = dataLimiteOrdem(o);
  return {
    contrato: c,
    empresa: e.empresas.get(c.empresaId)?.nome ?? '',
    ordem: o,
    limite,
    dias: diferencaDias(e.hoje, limite),
    situacao: situacaoOrdem(o, e.hoje),
    valor: valorOrdem(c, o),
    itens: o.itens.map((it) => {
      const item = c.itens.find((i) => i.id === it.itemId);
      return { descricao: item?.descricao ?? '(item removido)', unidade: item?.unidade ?? '', quantidade: it.quantidade };
    }),
  };
}

export function todasOrdens(e: Pick<EstadoLoja, 'contratos' | 'empresas' | 'hoje'>): LinhaOrdem[] {
  const r: LinhaOrdem[] = [];
  for (const c of e.contratos.values()) for (const o of c.ordens) r.push(linhaOrdem(c, o, e));
  return r.sort((a, b) => b.ordem.dataEmissao.localeCompare(a.ordem.dataEmissao));
}

/** RF13.3: pendentes com limite em até 3 dias corridos, e atrasadas. Atrasadas primeiro. */
export function ordensEmAlerta(e: Pick<EstadoLoja, 'contratos' | 'empresas' | 'hoje'>): LinhaOrdem[] {
  const r: LinhaOrdem[] = [];
  for (const c of e.contratos.values()) for (const o of c.ordens) if (ordemEmAlerta(o, e.hoje)) r.push(linhaOrdem(c, o, e));
  return r.sort((a, b) => a.limite.localeCompare(b.limite));
}

// ---------- Listas grandes (revisão 7) ----------

export interface Pagina<T> {
  itens: T[];
  /** Página efetiva, já limitada ao intervalo válido. */
  pagina: number;
  paginas: number;
  total: number;
}

/** Recorte de uma página (começa em 1). Página fora do intervalo vai para a mais próxima. */
export function paginar<T>(lista: readonly T[], pagina: number, porPagina: number): Pagina<T> {
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const p = Math.min(Math.max(1, Math.floor(pagina) || 1), paginas);
  return { itens: lista.slice((p - 1) * porPagina, p * porPagina), pagina: p, paginas, total: lista.length };
}

export type GrupoAtaContrato = 'empresa' | 'vigentes' | 'vencidas';

export interface OpcaoAtaContrato {
  ata: Ata;
  grupo: GrupoAtaContrato;
  situacao: Situacao;
  vencimento: string;
  /** Quantos itens da ARP têm a empresa do contrato como fornecedora. */
  itensDaEmpresa: number;
}

/**
 * RF06 revisão 7: ARPs para escolher no contrato. Primeiro as vigentes em que a empresa do contrato
 * é fornecedora, depois as outras vigentes e, no fim, as vencidas. Dentro do grupo, por número.
 */
export function atasParaContrato(atas: Iterable<Ata>, empresaId: string, hoje: string): OpcaoAtaContrato[] {
  const ordemGrupo: Record<GrupoAtaContrato, number> = { empresa: 0, vigentes: 1, vencidas: 2 };
  const r: OpcaoAtaContrato[] = [];
  for (const ata of atas) {
    const situacao = situacaoAta(ata, hoje);
    const itensDaEmpresa = empresaId ? ata.itens.filter((it) => it.parcelas.some((p) => p.empresaId === empresaId)).length : 0;
    const grupo: GrupoAtaContrato = situacao !== 'vigente' ? 'vencidas' : itensDaEmpresa > 0 ? 'empresa' : 'vigentes';
    r.push({ ata, grupo, situacao, vencimento: dataFimVigenteAta(ata), itensDaEmpresa });
  }
  return r.sort((a, b) => ordemGrupo[a.grupo] - ordemGrupo[b.grupo] || compararNumeroDoc(a.ata.numero, b.ata.numero));
}

export interface OpcaoParcela {
  item: ItemAta;
  parcela: Parcela;
  /** Saldo da ARP para este contrato, descontando os outros itens dele que usam a mesma parcela. */
  saldo: number;
}

/**
 * Itens da ARP que a empresa do contrato fornece, para o item do contrato. Os que têm saldo vêm
 * primeiro, na ordem da ARP; os sem saldo vão para o fim.
 */
export function parcelasParaItemContrato(ata: Ata, contrato: Contrato, contratos: Iterable<Contrato>, itemEditadoId?: string): OpcaoParcela[] {
  const lista = [...contratos];
  const r: OpcaoParcela[] = [];
  for (const item of ata.itens)
    for (const parcela of item.parcelas) {
      if (parcela.empresaId !== contrato.empresaId) continue;
      const usadoAqui = contrato.itens.filter((x) => x.parcelaId === parcela.id && x.id !== itemEditadoId).reduce((s, x) => s + x.quantidade, 0);
      r.push({ item, parcela, saldo: saldoParcela(ata, parcela, lista, contrato.id) - usadoAqui });
    }
  const comSaldo = r.filter((o) => o.saldo > 0);
  return [...comSaldo, ...r.filter((o) => o.saldo <= 0)];
}

/**
 * Filtro das tabelas de lançamento (OF/OS, aditivos). Revisão 7. Só decide o que aparece:
 * linhas escondidas continuam com o que foi digitado.
 */
export function filtrarLancamento<T>(
  linhas: readonly T[],
  f: { busca: string; soPreenchidas: boolean; textoBusca: (l: T) => string; preenchida: (l: T) => boolean; filtroExtra?: (l: T) => boolean },
): T[] {
  const temBusca = f.busca.trim() !== '';
  return linhas.filter(
    (l) => (!f.soPreenchidas || f.preenchida(l)) && (!f.filtroExtra || f.filtroExtra(l)) && (!temBusca || casaBusca(f.textoBusca(l), f.busca)),
  );
}

// ---------- Filtros das listas de ARPs, contratos e OF/OS (revisão 7) ----------

export type FiltroDocs = 'vigentes' | 'vencendo' | 'vencidos' | 'encerrados' | 'todos';

export const passaFiltroDocs = (l: LinhaDoc, f: FiltroDocs) =>
  f === 'todos' ||
  (f === 'vigentes' && l.situacao === 'vigente') ||
  (f === 'vencendo' && l.faixa !== 'normal') ||
  (f === 'vencidos' && l.situacao === 'vencido') ||
  (f === 'encerrados' && l.situacao === 'encerrado');

/** RF21 e revisão 7: situação, modalidade, empresa e busca; ordem por vencimento ou número. */
export function filtrarDocumentos(
  linhas: readonly LinhaDoc[],
  f: { filtro: FiltroDocs; modalidade?: '' | 'material' | 'servico'; empresaId?: string; busca?: string; ordem?: 'vencimento' | 'numero' },
): LinhaDoc[] {
  const busca = f.busca?.trim() ?? '';
  const r = linhas.filter(
    (l) =>
      passaFiltroDocs(l, f.filtro) &&
      (!f.modalidade || l.tipoContrato === f.modalidade) &&
      (!f.empresaId || l.empresaId === f.empresaId) &&
      (!busca || casaBusca(`${l.numero} ${l.objeto} ${l.empresa}`, busca)),
  );
  // linhasDocumentos já vem por vencimento.
  if (f.ordem === 'numero') r.sort((a, b) => compararNumeroDoc(a.numero, b.numero));
  return r;
}

export type FiltroOrdens = 'abertas' | SituacaoOrdem | 'todas';

export const passaFiltroOrdens = (s: SituacaoOrdem, f: FiltroOrdens) => f === 'todas' || (f === 'abertas' ? s !== 'entregue' : s === f);

/** RF10.10 e revisão 7: situação, empresa e busca sem acento (número, contrato, empresa ou item). */
export function filtrarOrdens(linhas: readonly LinhaOrdem[], f: { filtro: FiltroOrdens; empresaId?: string; busca?: string }): LinhaOrdem[] {
  const busca = f.busca?.trim() ?? '';
  return linhas.filter(
    (o) =>
      passaFiltroOrdens(o.situacao, f.filtro) &&
      (!f.empresaId || o.contrato.empresaId === f.empresaId) &&
      (!busca || casaBusca(`${o.ordem.numero} ${o.contrato.numero} ${o.empresa} ${o.itens.map((i) => i.descricao).join(' ')}`, busca)),
  );
}

// ---------- Fichas da ARP e do contrato (revisão 7) ----------

/** Itens do contrato que casam com a busca (descrição ou unidade). */
export function filtrarItensContrato(itens: readonly ItemContrato[], busca: string): ItemContrato[] {
  return busca.trim() ? itens.filter((it) => casaBusca(`${it.descricao} ${it.unidade}`, busca)) : [...itens];
}

/**
 * OF/OS do contrato, mais recentes primeiro, separadas entre a vigência atual (desde o início
 * ou a última prorrogação em vigor hoje) e as vigências anteriores.
 */
export function separarOrdensPorVigencia(c: Contrato, hoje: string): { atuais: Ordem[]; anteriores: Ordem[] } {
  const inicio = periodoDaData(c, hoje);
  const todas = [...c.ordens].sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));
  return {
    atuais: todas.filter((o) => periodoDaData(c, o.dataEmissao) === inicio),
    anteriores: todas.filter((o) => periodoDaData(c, o.dataEmissao) !== inicio),
  };
}

/**
 * Itens da ARP com os fornecedores que passam no filtro. A busca casa com a descrição do item
 * (mostra todos os fornecedores dele) ou com o nome do fornecedor (mostra só esse).
 * Itens sem nenhum fornecedor restante saem da lista.
 */
export function filtrarItensAta(
  ata: Ata,
  f: { busca: string; empresaId: string },
  nomeEmpresa: (id: string) => string,
): Array<{ item: ItemAta; parcelas: Parcela[] }> {
  const busca = f.busca.trim();
  const r: Array<{ item: ItemAta; parcelas: Parcela[] }> = [];
  for (const item of ata.itens) {
    const parcelas = item.parcelas.filter(
      (p) => (!f.empresaId || p.empresaId === f.empresaId) && (!busca || casaBusca(`${item.descricao} ${item.unidade} ${nomeEmpresa(p.empresaId)}`, busca)),
    );
    if (parcelas.length || (!busca && !f.empresaId)) r.push({ item, parcelas });
  }
  return r;
}

/** Contratos vinculados à ARP: os não encerrados por vencimento, e os encerrados à parte. */
export function contratosDaAta(ataId: string, contratos: Iterable<Contrato>): { ativos: Contrato[]; encerrados: Contrato[] } {
  const vinculados = [...contratos].filter((c) => c.ataId === ataId);
  const porVencimento = (a: Contrato, b: Contrato) => dataFimVigenteContrato(a).localeCompare(dataFimVigenteContrato(b)) || compararNumeroDoc(a.numero, b.numero);
  return {
    ativos: vinculados.filter((c) => !c.encerramento).sort(porVencimento),
    encerrados: vinculados.filter((c) => !!c.encerramento).sort(porVencimento),
  };
}

export function contadores(linhas: LinhaDoc[], ordens: LinhaOrdem[]) {
  const vencendo = (t: 'ata' | 'contrato') => linhas.filter((l) => l.tipo === t && l.faixa !== 'normal');
  return {
    atasVencendo: vencendo('ata').length,
    atasCriticas: vencendo('ata').filter((l) => l.faixa === 'critico').length,
    contratosVencendo: vencendo('contrato').length,
    contratosCriticos: vencendo('contrato').filter((l) => l.faixa === 'critico').length,
    ordensProximas: ordens.filter((o) => o.situacao === 'pendente').length,
    ordensAtrasadas: ordens.filter((o) => o.situacao === 'atrasada').length,
    aguardandoEncerramento: linhas.filter((l) => l.aguardandoEncerramento).length,
  };
}
