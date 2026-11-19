import { useMemo, useState } from 'react';
import { casaBusca, cnpjValido, formatarCnpj, nomesParecidos } from '../../dominio/texto';
import { novaEmpresa } from '../../dominio/fabrica';
import type { Empresa } from '../../dominio/tipos';
import { validarEmpresa } from '../../dominio/validacoes';
import { dependentesDaEmpresa } from '../../dominio/dependencias';
import { Campo, Entrada, ModalForm, useConfirmacao } from '../componentes/base';
import { gravar, loja, useLoja } from '../contexto';

/** Empresas já cadastradas que parecem ser a mesma (nome parecido ou mesmo CNPJ). RF04 revisão 5. */
export function empresasParecidas(nome: string, cnpj: string, todas: Iterable<Empresa>, ignorarId?: string): Empresa[] {
  const d = cnpj.replace(/\D/g, '');
  const r: Empresa[] = [];
  for (const e of todas) {
    if (e.id === ignorarId) continue;
    const mesmoCnpj = d.length === 14 && (e.cnpj ?? '').replace(/\D/g, '') === d;
    if (mesmoCnpj || (nome.trim().length >= 3 && nomesParecidos(nome, e.nome))) r.push(e);
  }
  return r.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function FormEmpresa({
  empresa,
  nomeInicial = '',
  aoFechar,
  aoSalvo,
}: {
  empresa?: Empresa;
  nomeInicial?: string;
  aoFechar: () => void;
  aoSalvo?: (e: Empresa) => void;
}) {
  const base = empresa ?? novaEmpresa({ nome: nomeInicial });
  const empresas = useLoja((e) => e.empresas);
  const [nome, setNome] = useState(base.nome);
  const [cnpj, setCnpj] = useState(base.cnpj ?? '');
  const [email, setEmail] = useState(base.email);
  const [telefone, setTelefone] = useState(base.telefone);
  const [outraMesmo, setOutraMesmo] = useState(false);
  // Na edição, só avisa se o nome ou o CNPJ mudaram.
  const mudou = !empresa || nome.trim() !== empresa.nome || cnpj.trim() !== (empresa.cnpj ?? '');
  const parecidas = mudou ? empresasParecidas(nome, cnpj, empresas.values(), base.id) : [];
  const cnpjRepetido = parecidas.some((e) => cnpj.replace(/\D/g, '').length === 14 && (e.cnpj ?? '').replace(/\D/g, '') === cnpj.replace(/\D/g, ''));

  return (
    <ModalForm
      titulo={empresa ? 'Editar empresa' : 'Nova empresa'}
      aoFechar={aoFechar}
      aoSalvar={async () => {
        if (parecidas.length && !cnpjRepetido && !outraMesmo)
          return ['Já existe empresa com nome parecido. Use a existente ou marque "É outra empresa" para cadastrar mesmo assim.'];
        const atual = loja.getState().empresas.get(base.id) ?? base;
        const reg: Empresa = { ...atual, nome: nome.trim(), cnpj: cnpj.trim() ? formatarCnpj(cnpj) : null, email: email.trim(), telefone: telefone.trim() };
        const erros = await gravar(reg, (r, e) => validarEmpresa(r as Empresa, e.empresas.values()));
        if (!erros.length) aoSalvo?.(loja.getState().empresas.get(reg.id) ?? reg);
        return erros;
      }}
    >
      <div className="grade g3">
        <Campo rotulo="Nome / razão social" className="span2">
          <Entrada valor={nome} muda={(v) => { setNome(v); setOutraMesmo(false); }} autoFocus />
        </Campo>
        <Campo rotulo="CNPJ" dica={cnpj.trim() && !cnpjValido(cnpj) ? 'CNPJ inválido: confira os dígitos.' : 'Opcional'}>
          <Entrada valor={cnpj} muda={(v) => { setCnpj(v); setOutraMesmo(false); }} onBlur={() => setCnpj(formatarCnpj(cnpj))} className="num" placeholder="00.000.000/0000-00" />
        </Campo>
        <Campo rotulo="E-mail" className="span2" dica="Mais de um: separe por vírgula.">
          <Entrada valor={email} muda={setEmail} type="text" inputMode="email" placeholder="contato@empresa.com.br" />
        </Campo>
        <Campo rotulo="Telefone">
          <Entrada valor={telefone} muda={setTelefone} inputMode="tel" placeholder="(85) 0000-0000" />
        </Campo>
      </div>
      {parecidas.length > 0 && (
        <div className="aviso-duplicada" role="status">
          <strong>{cnpjRepetido ? 'Este CNPJ já está cadastrado:' : 'Já existe empresa com nome parecido:'}</strong>
          <ul>
            {parecidas.slice(0, 5).map((e) => (
              <li key={e.id}>
                <span>
                  {e.nome}
                  {e.cnpj && <span className="num fraco"> · {e.cnpj}</span>}
                </span>
                {aoSalvo && (
                  <button type="button" className="btn btn-mini" onClick={() => { aoSalvo(e); aoFechar(); }}>
                    Usar esta
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!cnpjRepetido && (
            <label className="marcar">
              <input type="checkbox" checked={outraMesmo} onChange={(ev) => setOutraMesmo(ev.target.checked)} /> É outra empresa, cadastrar mesmo assim
            </label>
          )}
        </div>
      )}
    </ModalForm>
  );
}

const POR_PAGINA = 20;

export function Paginacao({ pagina, total, porPagina, muda }: { pagina: number; total: number; porPagina: number; muda: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total === 0) return null;
  const ini = (pagina - 1) * porPagina + 1;
  const fim = Math.min(total, pagina * porPagina);
  return (
    <div className="paginacao">
      <span className="num">
        Mostrando {ini} a {fim} de {total}
      </span>
      {paginas > 1 && (
        <span className="paginacao-botoes">
          <button type="button" className="btn btn-mini" disabled={pagina <= 1} onClick={() => muda(pagina - 1)}>
            ‹ Anterior
          </button>
          <span className="num">
            Página {pagina} de {paginas}
          </span>
          <button type="button" className="btn btn-mini" disabled={pagina >= paginas} onClick={() => muda(pagina + 1)}>
            Próxima ›
          </button>
        </span>
      )}
    </div>
  );
}

export function TelaEmpresas() {
  const empresas = useLoja((e) => e.empresas);
  const atas = useLoja((e) => e.atas);
  const contratos = useLoja((e) => e.contratos);
  const [editando, setEditando] = useState<Empresa | null | 'nova'>(null);
  const { pedir, elemento } = useConfirmacao();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const todas = useMemo(() => [...empresas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [empresas]);
  const filtradas = busca.trim() ? todas.filter((e) => casaBusca(`${e.nome} ${e.cnpj ?? ''} ${(e.cnpj ?? '').replace(/\D/g, '')} ${e.email}`, busca)) : todas;
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas);
  const lista = filtradas.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);

  return (
    <>
      <div className="pagina-titulo">
        <h1>Empresas</h1>
        <p>{todas.length} cadastradas</p>
        <div className="acoes">
          <button className="btn btn-primario" onClick={() => setEditando('nova')}>+ Nova empresa</button>
        </div>
      </div>
      <div className="filtros">
        <input
          className="entrada busca"
          placeholder="Buscar nome, CNPJ ou e-mail"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
          style={{ flexBasis: 340 }}
        />
      </div>
      <div className="tabela-caixa">
        {lista.length === 0 ? (
          <div className="vazio">{todas.length ? 'Nenhuma empresa encontrada com essa busca.' : 'Nenhuma empresa cadastrada.'}</div>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CNPJ</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th className="direita">Contratos</th>
                <th className="direita">Itens em ARPs</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => {
                const nContratos = [...contratos.values()].filter((c) => c.empresaId === e.id).length;
                const nParcelas = [...atas.values()].flatMap((a) => a.itens.flatMap((i) => i.parcelas)).filter((p) => p.empresaId === e.id).length;
                return (
                  <tr key={e.id}>
                    <td>{e.nome}</td>
                    <td className="num">{e.cnpj || <span className="fraco">-</span>}</td>
                    <td>{e.email ? e.email.split(/[;,\s]+/).filter(Boolean).map((m) => <div key={m}><a href={`mailto:${m}`}>{m}</a></div>) : <span className="fraco">-</span>}</td>
                    <td className="num">{e.telefone || <span className="fraco">-</span>}</td>
                    <td className="direita num">{nContratos}</td>
                    <td className="direita num">{nParcelas}</td>
                    <td>
                      <div className="acoes-linha">
                        <button className="btn btn-leve btn-mini" onClick={() => setEditando(e)}>
                          Editar
                        </button>
                        <button
                          className="btn btn-leve btn-mini"
                          onClick={() =>
                            pedir('Excluir empresa', <p>Excluir {e.nome} definitivamente?</p>, async () => {
                              const r = await loja.getState().excluir(e, (s) => dependentesDaEmpresa(e.id, s.atas.values(), s.contratos.values()));
                              return r.ok ? [] : r.erros;
                            })
                          }
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Paginacao pagina={pag} total={filtradas.length} porPagina={POR_PAGINA} muda={setPagina} />
      {editando && <FormEmpresa empresa={editando === 'nova' ? undefined : editando} aoFechar={() => setEditando(null)} />}
      {elemento}
    </>
  );
}
