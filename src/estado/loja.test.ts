import { describe, expect, it } from 'vitest';
import { RepositorioMemoria } from '../armazenamento/memoria';
import { novaAta, novaEmpresa, novoContrato } from '../dominio/fabrica';
import type { Contrato } from '../dominio/tipos';
import { validarContrato } from '../dominio/validacoes';
import { criarLoja, type RespostaConflito } from './loja';

async function cenario(resposta?: RespostaConflito) {
  const repo = new RepositorioMemoria();
  const pedidos: number[] = [];
  const opcoes = {
    resolverConflito: async (p: { conflitos: unknown[] }) => {
      pedidos.push(p.conflitos.length);
      return resposta ?? { tipo: 'cancelar' as const };
    },
  };
  const priscila = criarLoja(opcoes);
  const ednaldo = criarLoja(opcoes);
  await priscila.getState().conectar(repo);

  const emp = novaEmpresa({ id: 'emp1', nome: 'Papelaria Alfa' });
  await priscila.getState().salvar(emp);
  const c = novoContrato({ id: 'c1', numero: '045/2026', empresaId: 'emp1', dataInicio: '2026-02-01', dataFim: '2027-01-31', itens: [{ id: 'i1', parcelaId: null, descricao: 'Toner', unidade: 'un', quantidade: 100_000, valorUnitario: 100_000 }] });
  await priscila.getState().salvar(c);
  await ednaldo.getState().conectar(repo);
  return { repo, priscila, ednaldo, pedidos };
}

const contratoDe = (l: ReturnType<typeof criarLoja>) => l.getState().contratos.get('c1') as Contrato;

describe('RF16 edição concorrente', () => {
  it('gravação simples incrementa a versão', async () => {
    const { priscila } = await cenario();
    expect(contratoDe(priscila).versao).toBe(1);
  });

  it('CA16.1: registros diferentes, nada se perde', async () => {
    const { priscila, ednaldo, repo } = await cenario();
    await priscila.getState().salvar(novaAta({ id: 'a1', numero: '1/2026', dataInicio: '2026-01-01', dataFim: '2026-12-31' }));
    await ednaldo.getState().salvar({ ...contratoDe(ednaldo), gestor: 'Ednaldo' });
    const leitor = criarLoja();
    await leitor.getState().conectar(repo);
    expect(leitor.getState().atas.size).toBe(1);
    expect(contratoDe(leitor).gestor).toBe('Ednaldo');
  });

  it('CA16.1: mesmo contrato, partes diferentes, mescla sem perguntar', async () => {
    const { priscila, ednaldo, pedidos } = await cenario();
    await priscila.getState().salvar({ ...contratoDe(priscila), gestor: 'Priscila' });
    const r = await ednaldo.getState().salvar({ ...contratoDe(ednaldo), fiscal: 'Ednaldo' });
    expect(r.ok && r.mesclado).toBe(true);
    expect(pedidos).toHaveLength(0);
    const final = contratoDe(ednaldo);
    expect([final.gestor, final.fiscal, final.versao]).toEqual(['Priscila', 'Ednaldo', 3]);
  });

  it('CA16.2: mesmo campo pergunta e respeita a escolha', async () => {
    const { priscila, ednaldo, pedidos } = await cenario({ tipo: 'escolhas', escolhas: { gestor: 'deles' } });
    await priscila.getState().salvar({ ...contratoDe(priscila), gestor: 'Priscila' });
    const r = await ednaldo.getState().salvar({ ...contratoDe(ednaldo), gestor: 'Ednaldo' });
    expect(pedidos).toEqual([1]);
    expect(r.ok).toBe(true);
    expect(contratoDe(ednaldo).gestor).toBe('Priscila');
  });

  it('CA16.2: contrato com ata (que recarrega antes de validar) ainda detecta o conflito', async () => {
    const { priscila, ednaldo, pedidos } = await cenario({ tipo: 'escolhas', escolhas: { gestor: 'deles' } });
    const ata = novaAta({ id: 'a1', numero: '1/2026', dataInicio: '2026-01-01', dataFim: '2026-12-31' });
    await priscila.getState().salvar(ata);
    await priscila.getState().salvar({ ...contratoDe(priscila), ataId: 'a1' });
    await ednaldo.getState().carregar();
    const val = (r: unknown, e: ReturnType<typeof ednaldo.getState>) => validarContrato(r as Contrato, e.contratos.values(), e.atas);
    await priscila.getState().salvar({ ...contratoDe(priscila), gestor: 'Priscila', observacoes: 'nota' }, val);
    const r = await ednaldo.getState().salvar({ ...contratoDe(ednaldo), gestor: 'Ednaldo', objeto: 'novo objeto' }, val);
    expect(pedidos).toEqual([1]);
    expect(r.ok).toBe(true);
    const final = contratoDe(ednaldo);
    expect([final.gestor, final.objeto, final.observacoes]).toEqual(['Priscila', 'novo objeto', 'nota']);
  });

  it('CA16.2: cancelar o conflito não grava nada', async () => {
    const { priscila, ednaldo, repo } = await cenario();
    await priscila.getState().salvar({ ...contratoDe(priscila), gestor: 'Priscila' });
    const r = await ednaldo.getState().salvar({ ...contratoDe(ednaldo), gestor: 'Ednaldo' });
    expect(r.ok).toBe(false);
    const disco = (await repo.ler('contratos', 'c1'))!.dados as Contrato;
    expect(disco.gestor).toBe('Priscila');
  });

  it('excluído por outro usuário: cancelar descarta, recriar grava', async () => {
    const a = await cenario();
    await a.priscila.getState().excluir(contratoDe(a.priscila));
    const r1 = await a.ednaldo.getState().salvar({ ...contratoDe(a.ednaldo), gestor: 'X' });
    expect(r1.ok).toBe(false);
    expect(a.ednaldo.getState().contratos.has('c1')).toBe(false);

    const b = await cenario({ tipo: 'recriar' });
    await b.priscila.getState().excluir(contratoDe(b.priscila));
    const r2 = await b.ednaldo.getState().salvar({ ...contratoDe(b.ednaldo), gestor: 'X' });
    expect(r2.ok).toBe(true);
    expect(await b.repo.ler('contratos', 'c1')).not.toBeNull();
  });

  it('CA16.3: detecta alterações de outros', async () => {
    const { priscila, ednaldo } = await cenario();
    expect(await ednaldo.getState().verificarAlteracoes()).toBe(false);
    await priscila.getState().salvar({ ...contratoDe(priscila), gestor: 'P' });
    expect(await ednaldo.getState().verificarAlteracoes()).toBe(true);
    await ednaldo.getState().carregar();
    expect(contratoDe(ednaldo).gestor).toBe('P');
    expect(ednaldo.getState().haAlteracoes).toBe(false);
  });

  it('arquivo corrompido vira problema, o resto carrega', async () => {
    const { repo } = await cenario();
    repo.gravarBruto('atas', 'quebrada', '{"registro":"ata"}');
    const l = criarLoja();
    await l.getState().conectar(repo);
    expect(l.getState().problemas).toHaveLength(1);
    expect(l.getState().contratos.size).toBe(1);
  });

  it('validador bloqueia gravação inválida', async () => {
    const { priscila } = await cenario();
    const r = await priscila.getState().salvar({ ...contratoDe(priscila), id: 'c2', numero: '045/2026', versao: 0 }, (reg, e) =>
      validarContrato(reg as Contrato, e.contratos.values(), e.atas),
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erros.join()).toMatch(/Já existe/);
  });

  it('CA15.2: exclusão bloqueada por dependentes', async () => {
    const { priscila } = await cenario();
    const r = await priscila.getState().excluir(priscila.getState().empresas.get('emp1')!, (e) =>
      [...e.contratos.values()].filter((c) => c.empresaId === 'emp1').map((c) => c.numero),
    );
    expect(r.ok).toBe(false);
    expect(priscila.getState().empresas.has('emp1')).toBe(true);
  });
});
