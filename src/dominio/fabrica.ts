import { FORMATO_ATUAL, type Ata, type Contrato, type Empresa } from './tipos';

export function novoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const meta = () => ({ id: novoId(), formato: FORMATO_ATUAL, versao: 0, atualizadoEm: '' });

export const novaEmpresa = (p: Partial<Empresa> = {}): Empresa => ({ ...meta(), registro: 'empresa', nome: '', cnpj: null, email: '', telefone: '', ...p });

export const novaAta = (p: Partial<Ata> = {}): Ata => ({
  ...meta(),
  registro: 'ata',
  numero: '',
  tema: '',
  dataInicio: '',
  dataFim: '',
  observacoes: '',
  itens: [],
  aditivos: [],
  ...p,
});

export const novoContrato = (p: Partial<Contrato> = {}): Contrato => ({
  ...meta(),
  registro: 'contrato',
  numero: '',
  empresaId: '',
  tipo: 'material',
  objeto: '',
  ataId: null,
  dataInicio: '',
  dataFim: '',
  gestor: '',
  fiscal: '',
  observacoes: '',
  itens: [],
  aditivos: [],
  ordens: [],
  encerramento: null,
  ...p,
});
