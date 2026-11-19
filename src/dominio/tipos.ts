import { z } from 'zod';

/**
 * Convenções (design.md 3.1):
 * - Datas: texto AAAA-MM-DD, sem hora e sem fuso.
 * - Quantidades: inteiro em milésimos (quantidade x 1000).
 * - Valores unitários: inteiro em décimos de milésimo de real (valor x 10000).
 */

export const FORMATO_ATUAL = 1 as const;

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data inválida');
/** Igual a `data`, mas aceita também vazio (campo opcional). */
const dataOuVazia = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'data inválida');
const id = z.string().min(1);
const inteiroPositivo = z.number().int().positive();
const meta = {
  id,
  formato: z.literal(FORMATO_ATUAL),
  versao: z.number().int().nonnegative(),
  atualizadoEm: z.string(),
};

export const EmpresaSchema = z.object({
  ...meta,
  registro: z.literal('empresa'),
  nome: z.string().min(1),
  cnpj: z.string().nullable(),
  // Revisão 3: contato. Default vazio para ler arquivos gravados antes destes campos existirem.
  email: z.string().default(''),
  telefone: z.string().default(''),
});

export const ParcelaSchema = z.object({
  id,
  empresaId: id,
  tipoCota: z.enum(['ampla', 'cota_me']),
  quantidade: inteiroPositivo,
  valorUnitario: inteiroPositivo,
});

export const ItemAtaSchema = z.object({
  id,
  descricao: z.string().min(1),
  unidade: z.string(),
  parcelas: z.array(ParcelaSchema),
});

export const AditivoAtaSchema = z.object({
  id,
  identificacao: z.string(),
  data,
  // Revisão 5: 'reequilibrio' altera o valor unitário das parcelas a partir de `inicioEfeitos`.
  tipo: z.enum(['prazo', 'quantidade', 'prazo_quantidade', 'reequilibrio']),
  novaDataFim: data.nullable(),
  quantidades: z.array(z.object({ parcelaId: id, novaQuantidade: inteiroPositivo })),
  // Revisão 5. Defaults para ler aditivos gravados antes destes campos existirem.
  inicioEfeitos: dataOuVazia.default(''),
  valores: z.array(z.object({ parcelaId: id, novoValorUnitario: inteiroPositivo })).default([]),
  observacoes: z.string(),
});

export const ROTULO_ADITIVO_ATA: Record<z.infer<typeof AditivoAtaSchema>['tipo'], string> = {
  prazo: 'Prazo',
  quantidade: 'Quantidade',
  prazo_quantidade: 'Prazo e quantidade',
  reequilibrio: 'Reequilíbrio',
};

export const AtaSchema = z.object({
  ...meta,
  registro: z.literal('ata'),
  numero: z.string().min(1),
  tema: z.string(),
  // Revisão 4: início da vigência deixou de ser obrigatório (não influenciava nenhum cálculo).
  // Default vazio para novas ARPs; arquivos antigos com a data preenchida continuam válidos.
  dataInicio: dataOuVazia.default(''),
  dataFim: data,
  observacoes: z.string(),
  itens: z.array(ItemAtaSchema),
  aditivos: z.array(AditivoAtaSchema),
});

export const ItemContratoSchema = z.object({
  id,
  parcelaId: id.nullable(),
  descricao: z.string().min(1),
  unidade: z.string(),
  quantidade: inteiroPositivo,
  valorUnitario: inteiroPositivo,
});

export const AditivoContratoSchema = z.object({
  id,
  identificacao: z.string(),
  tipo: z.enum(['prazo', 'valor', 'reequilibrio']),
  dataAssinatura: data,
  inicioEfeitos: data,
  novaDataFim: data.nullable(),
  alteracoes: z.array(
    z.object({
      itemId: id,
      novaQuantidade: inteiroPositivo.nullable(),
      novoValorUnitario: inteiroPositivo.nullable(),
    }),
  ),
  observacoes: z.string(),
});

export const OrdemSchema = z.object({
  id,
  numero: z.string().min(1),
  dataEmissao: data,
  prazoDias: inteiroPositivo,
  tipoPrazo: z.enum(['uteis', 'corridos']),
  dataEntrega: data.nullable(),
  itens: z.array(z.object({ itemId: id, quantidade: inteiroPositivo })),
  observacoes: z.string(),
});

export const ContratoSchema = z.object({
  ...meta,
  registro: z.literal('contrato'),
  numero: z.string().min(1),
  empresaId: id,
  tipo: z.enum(['material', 'servico']),
  objeto: z.string(),
  ataId: id.nullable(),
  dataInicio: data,
  dataFim: data,
  gestor: z.string(),
  fiscal: z.string(),
  observacoes: z.string(),
  itens: z.array(ItemContratoSchema),
  aditivos: z.array(AditivoContratoSchema),
  ordens: z.array(OrdemSchema),
  encerramento: z.object({ data, termo: z.string() }).nullable(),
});

export type Empresa = z.infer<typeof EmpresaSchema>;
export type Parcela = z.infer<typeof ParcelaSchema>;
export type ItemAta = z.infer<typeof ItemAtaSchema>;
export type AditivoAta = z.infer<typeof AditivoAtaSchema>;
export type Ata = z.infer<typeof AtaSchema>;
export type ItemContrato = z.infer<typeof ItemContratoSchema>;
export type AditivoContrato = z.infer<typeof AditivoContratoSchema>;
export type Ordem = z.infer<typeof OrdemSchema>;
export type Contrato = z.infer<typeof ContratoSchema>;

export type Agregado = Empresa | Ata | Contrato;
export type Colecao = 'empresas' | 'atas' | 'contratos';

export const COLECAO_DO_REGISTRO = {
  empresa: 'empresas',
  ata: 'atas',
  contrato: 'contratos',
} as const satisfies Record<Agregado['registro'], Colecao>;

export const SCHEMA_DA_COLECAO = {
  empresas: EmpresaSchema,
  atas: AtaSchema,
  contratos: ContratoSchema,
} as const;

export type Situacao = 'vigente' | 'vencido' | 'encerrado';
/** Alerta de prazo, separado da situação (requisitos RF12, revisão 2). */
export type FaixaPrazo = 'critico' | 'atencao' | 'normal';
export type SituacaoOrdem = 'pendente' | 'entregue' | 'atrasada';

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  vigente: 'Vigente',
  vencido: 'Vencido',
  encerrado: 'Encerrado',
};

/** Ata é feminino: "Vigente", "Vencida". */
export function rotuloSituacao(s: Situacao, tipo: 'ata' | 'contrato'): string {
  if (tipo === 'ata' && s === 'vencido') return 'Vencida';
  return ROTULO_SITUACAO[s];
}

export const ROTULO_SITUACAO_ORDEM: Record<SituacaoOrdem, string> = {
  pendente: 'Pendente',
  entregue: 'Entregue',
  atrasada: 'Atrasada',
};

/** Valida um arquivo lido da pasta. Retorna o registro ou a mensagem de erro. */
export function validarArquivo(colecao: Colecao, dados: unknown): { ok: true; valor: Agregado } | { ok: false; erro: string } {
  const r = SCHEMA_DA_COLECAO[colecao].safeParse(dados);
  if (r.success) return { ok: true, valor: r.data };
  const p = r.error.issues[0];
  return { ok: false, erro: `${p.path.join('.') || 'arquivo'}: ${p.message}` };
}
