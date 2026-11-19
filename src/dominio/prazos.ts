import { diferencaDias, somarDias } from './datas';
import { ehDiaUtil } from './feriados';
import type { Ordem, SituacaoOrdem } from './tipos';

/**
 * Data limite de entrega (CA10.3 a CA10.5, D01).
 * Conta a partir do dia seguinte à emissão, incluindo o dia do vencimento.
 */
export function dataLimite(emissao: string, dias: number, tipo: 'uteis' | 'corridos'): string {
  if (tipo === 'corridos') return somarDias(emissao, dias);
  let atual = emissao;
  let contados = 0;
  while (contados < dias) {
    atual = somarDias(atual, 1);
    if (ehDiaUtil(atual)) contados++;
  }
  return atual;
}

export const dataLimiteOrdem = (o: Pick<Ordem, 'dataEmissao' | 'prazoDias' | 'tipoPrazo'>) =>
  dataLimite(o.dataEmissao, o.prazoDias, o.tipoPrazo);

/** CA10.6 */
export function situacaoOrdem(o: Ordem, hoje: string): SituacaoOrdem {
  if (o.dataEntrega) return 'entregue';
  return hoje > dataLimiteOrdem(o) ? 'atrasada' : 'pendente';
}

/** Antecedência do alerta de OF/OS, em dias corridos (P03). */
export const ALERTA_ORDEM_DIAS = 3;

/** CA13.7: pendente com limite a 3 dias corridos ou menos, ou atrasada. */
export function ordemEmAlerta(o: Ordem, hoje: string): boolean {
  const s = situacaoOrdem(o, hoje);
  if (s === 'atrasada') return true;
  if (s === 'entregue') return false;
  return diferencaDias(hoje, dataLimiteOrdem(o)) <= ALERTA_ORDEM_DIAS;
}
