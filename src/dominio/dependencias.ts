import type { Ata, Contrato } from './tipos';

/** CA15.2: lista o que impede a exclusão. Lista vazia = pode excluir. */

export function dependentesDaEmpresa(empresaId: string, atas: Iterable<Ata>, contratos: Iterable<Contrato>): string[] {
  const r: string[] = [];
  for (const c of contratos) if (c.empresaId === empresaId) r.push(`Contrato ${c.numero}`);
  for (const a of atas)
    for (const it of a.itens)
      if (it.parcelas.some((p) => p.empresaId === empresaId)) r.push(`ARP ${a.numero}, item "${it.descricao}"`);
  return r;
}

export function dependentesDaAta(ataId: string, contratos: Iterable<Contrato>): string[] {
  const r: string[] = [];
  for (const c of contratos) if (c.ataId === ataId) r.push(`Contrato ${c.numero}`);
  return r;
}

export function dependentesDaParcela(parcelaId: string, contratos: Iterable<Contrato>): string[] {
  const r: string[] = [];
  for (const c of contratos) if (c.itens.some((i) => i.parcelaId === parcelaId)) r.push(`Contrato ${c.numero}`);
  return r;
}

export function dependentesDoItemAta(ata: Ata, itemId: string, contratos: Iterable<Contrato>): string[] {
  const item = ata.itens.find((i) => i.id === itemId);
  if (!item) return [];
  const lista = [...contratos];
  return [...new Set(item.parcelas.flatMap((p) => dependentesDaParcela(p.id, lista)))];
}

export function dependentesDoContrato(c: Contrato): string[] {
  return c.ordens.map((o) => `Ordem ${o.numero}`);
}

export function dependentesDoItemContrato(c: Contrato, itemId: string): string[] {
  return c.ordens.filter((o) => o.itens.some((i) => i.itemId === itemId)).map((o) => `Ordem ${o.numero}`);
}

/** Parcelas citadas em aditivos de quantidade também bloqueiam exclusão. */
export function aditivosDaParcela(ata: Ata, parcelaId: string): string[] {
  return ata.aditivos
    .filter((a) => a.quantidades.some((q) => q.parcelaId === parcelaId) || a.valores.some((v) => v.parcelaId === parcelaId))
    .map((a) => `Aditivo ${a.identificacao || a.data}`);
}

export function aditivosDoItemContrato(c: Contrato, itemId: string): string[] {
  return c.aditivos.filter((a) => a.alteracoes.some((x) => x.itemId === itemId)).map((a) => `Aditivo ${a.identificacao || a.dataAssinatura}`);
}
