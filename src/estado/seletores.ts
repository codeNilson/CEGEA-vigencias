import { diferencaDias } from '../dominio/datas';
import {
  ALERTA_VIGENCIA_DIAS,
  dataFimVigenteAta,
  dataFimVigenteContrato,
  diasRestantes,
  faixaPrazo,
  situacaoAta,
  situacaoContrato,
  valorOrdem,
} from '../dominio/calculos';
import { somarDias } from '../dominio/datas';
import { dataLimiteOrdem, ordemEmAlerta, situacaoOrdem } from '../dominio/prazos';
import type { Contrato, FaixaPrazo, Ordem, Situacao, SituacaoOrdem } from '../dominio/tipos';
import type { EstadoLoja } from './loja';
import { objetoAta } from '../dominio/texto';

type Base = Pick<EstadoLoja, 'atas' | 'contratos' | 'empresas' | 'hoje'>;

export interface LinhaDoc {
  tipo: 'ata' | 'contrato';
  id: string;
  numero: string;
  objeto: string;
  empresa: string;
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
      tipo: 'ata', id: a.id, numero: a.numero, objeto: objetoAta(a), empresa: '', tipoContrato: null,
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
      empresa: e.empresas.get(c.empresaId)?.nome ?? '(empresa não encontrada)', tipoContrato: c.tipo,
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
