import { describe, expect, it } from 'vitest';
import { utils } from 'xlsx';
import { montarExportacaoCompleta } from './planilha';
import { novaAta, novaEmpresa, novoContrato } from '../dominio/fabrica';
import { validarArquivo } from '../dominio/tipos';

describe('RF19 exportação completa', () => {
  const emp = novaEmpresa({ id: 'e1', nome: 'Papelaria Alfa', cnpj: '11.222.333/0001-81', email: 'vendas@alfa.com.br', telefone: '(85) 3000-0000' });
  const ata = novaAta({
    id: 'a1', numero: '018/2026', tema: 'Expediente', dataInicio: '2026-01-10', dataFim: '2027-01-09',
    itens: [{ id: 'i1', descricao: 'Papel A4', unidade: 'resma', parcelas: [{ id: 'p1', empresaId: 'e1', tipoCota: 'ampla', quantidade: 1_000_000, valorUnitario: 249_000 }] }],
  });
  const c = novoContrato({
    id: 'c1', numero: '045/2026', empresaId: 'e1', ataId: 'a1', dataInicio: '2026-02-01', dataFim: '2027-01-31',
    itens: [{ id: 'ci1', parcelaId: 'p1', descricao: 'Papel A4', unidade: 'resma', quantidade: 400_000, valorUnitario: 249_000 }],
    ordens: [{ id: 'o1', numero: 'OF 1', dataEmissao: '2026-03-01', prazoDias: 5, tipoPrazo: 'corridos', dataEntrega: null, itens: [{ itemId: 'ci1', quantidade: 150_000 }], observacoes: '' }],
  });
  const wb = montarExportacaoCompleta([ata], [c], new Map([[emp.id, emp]]), '2026-11-18');
  const linhas = (aba: string) => utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[aba]);

  it('cinco abas, nesta ordem', () => {
    expect(wb.SheetNames).toEqual(['ARPs', 'Itens das ARPs', 'Contratos', 'Itens dos contratos', 'Empresas']);
  });
  it('sem fórmulas em nenhuma aba', () => {
    for (const n of wb.SheetNames) for (const [k, cel] of Object.entries(wb.Sheets[n])) if (!k.startsWith('!')) expect((cel as { f?: string }).f).toBeUndefined();
  });
  it('saldos da ARP e do contrato', () => {
    expect(linhas('Itens das ARPs')[0]).toMatchObject({ 'Número da ARP': '018/2026', Fornecedor: 'Papelaria Alfa', 'Já contratada': 400, 'Saldo disponível': 600, 'Valor unitário original': 24.9, 'Valor unitário atual': 24.9 });
    expect(linhas('Itens dos contratos')[0]).toMatchObject({ 'Número do contrato': '045/2026', 'Número da ARP': '018/2026', 'Já solicitada em OF/OS': 150, 'Saldo disponível': 250 });
    expect(linhas('Contratos')[0]).toMatchObject({ 'Número da ARP': '018/2026', Empresa: 'Papelaria Alfa', Situação: 'Vigente' });
  });
  it('contatos das empresas', () => {
    expect(linhas('Empresas')[0]).toMatchObject({ 'E-mail': 'vendas@alfa.com.br', Telefone: '(85) 3000-0000' });
  });
  it('empresa gravada antes dos campos de contato continua válida', () => {
    const antiga = { id: 'x', formato: 1, versao: 1, atualizadoEm: '', registro: 'empresa', nome: 'Antiga', cnpj: null };
    const r = validarArquivo('empresas', antiga);
    expect(r.ok && r.valor.registro === 'empresa' && [r.valor.email, r.valor.telefone]).toEqual(['', '']);
  });
  it('ARP sem data de início (revisão 4): nova sem o campo e antiga com o campo continuam válidas', () => {
    const nova = { id: 'y', formato: 1, versao: 0, atualizadoEm: '', registro: 'ata', numero: '020/2026', tema: '', dataFim: '2027-01-01', observacoes: '', itens: [], aditivos: [] };
    const r1 = validarArquivo('atas', nova);
    expect(r1.ok && r1.valor.registro === 'ata' && r1.valor.dataInicio).toBe('');

    const antiga = { ...nova, id: 'z', numero: '021/2026', dataInicio: '2026-01-01' };
    const r2 = validarArquivo('atas', antiga);
    expect(r2.ok && r2.valor.registro === 'ata' && r2.valor.dataInicio).toBe('2026-01-01');
  });
});
