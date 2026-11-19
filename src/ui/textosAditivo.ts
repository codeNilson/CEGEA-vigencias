/** Textos comuns aos formulários de aditivo da ARP e do contrato (revisão 8). */

export const NOTA_SO_REGISTRO =
  'Fica só registrado no histórico de aditivos: não muda vencimento, saldo nem valores. Se a alteração mudar a descrição de um item, edite o item.';

export function rotuloObservacoesAditivo(tipo: string): string {
  if (tipo === 'errata') return 'O que a errata corrige';
  if (tipo === 'outro') return 'O que o aditivo altera';
  return 'Observações';
}
