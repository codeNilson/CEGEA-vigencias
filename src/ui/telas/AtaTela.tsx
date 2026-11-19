import { Fragment, useState } from 'react';
import {
  contratadoParcela,
  dataFimVigenteAta,
  diasRestantes,
  quantidadeVigenteParcela,
  saldoParcela,
  situacaoAta,
  situacaoContrato,
  dataFimVigenteContrato,
  valorTotalAta,
  valorParcelaEm,
  efeitoReequilibrioAta,
} from '../../dominio/calculos';
import { formatarData, hojeISO } from '../../dominio/datas';
import { novaAta, novoId } from '../../dominio/fabrica';
import {
  formatarCentavos,
  formatarQuantidade,
  formatarValorUnitario,
  lerQuantidade,
  lerValor,
  textoQuantidade,
  textoValor,
} from '../../dominio/numeros';
import { ROTULO_ADITIVO_ATA, type AditivoAta, type Ata, type ItemAta, type Parcela } from '../../dominio/tipos';
import { validarAditivoAta, validarAta } from '../../dominio/validacoes';
import { aditivosDaParcela, dependentesDaAta, dependentesDaParcela, dependentesDoItemAta } from '../../dominio/dependencias';
import { exportarAta } from '../../exportacao/planilha';
import {
  CabecalhoImpressao,
  Campo,
  Dado,
  Entrada,
  EntradaData,
  EntradaMoeda,
  EntradaQuantidade,
  Erros,
  Escolha,
  ModalForm,
  Segmentado,
  Prazo,
  Situacao,
  TagTipo,
  cls,
  useConfirmacao,
} from '../componentes/base';
import { gravar, irPara, loja, useLoja } from '../contexto';
import { FormEmpresa } from './Empresas';
import { EscolhaEmpresa } from '../componentes/EscolhaEmpresa';
import { EscolhaBusca } from '../componentes/EscolhaBusca';
import { TabelaLancamento } from '../componentes/TabelaLancamento';
import { formatarObjetoAta, objetoAta } from '../../dominio/texto';
import { FormContrato } from './ContratoTela';

const validar = (r: unknown, e: ReturnType<typeof loja.getState>) => validarAta(r as Ata, e.atas.values());

// ---------- Formulários ----------

export function FormAta({ ata, aoFechar }: { ata?: Ata; aoFechar: () => void }) {
  const base = ata ?? novaAta();
  const [f, setF] = useState({ numero: base.numero, tema: formatarObjetoAta(base.tema).trim(), dataFim: base.dataFim, observacoes: base.observacoes });
  const m = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  return (
    <ModalForm
      titulo={ata ? `Editar ARP ${ata.numero}` : 'Nova ARP (Ata de Registro de Preços)'}
      aoFechar={aoFechar}
      aoSalvar={async () => {
        const atual = ata ? loja.getState().atas.get(ata.id) ?? base : base;
        const reg = { ...atual, ...f, numero: f.numero.trim(), tema: f.tema.trim() };
        const erros = await gravar(reg, validar);
        if (!erros.length && !ata) irPara({ tela: 'ata', id: reg.id });
        return erros;
      }}
    >
      <div className="grade g4">
        <Campo rotulo="Número da ARP">
          <Entrada valor={f.numero} muda={m('numero')} autoFocus placeholder="ARP 000/2026" />
        </Campo>
        <Campo rotulo="Objeto" className="span3">
          <Entrada valor={f.tema} muda={(v) => m('tema')(formatarObjetoAta(v))} placeholder="EX.: MATERIAL DE EXPEDIENTE" />
        </Campo>
        <Campo rotulo="Vencimento" className="span2" dica={ata?.aditivos.some((a) => a.novaDataFim) ? 'Data original. Prorrogações ficam nos aditivos.' : undefined}>
          <EntradaData valor={f.dataFim} muda={m('dataFim')} />
        </Campo>
        <Campo rotulo="Observações" className="span-todo">
          <textarea className="entrada" value={f.observacoes} onChange={(e) => m('observacoes')(e.target.value)} />
        </Campo>
      </div>
    </ModalForm>
  );
}

type LinhaParcela = { id: string; empresaId: string; tipoCota: Parcela['tipoCota']; quantidade: string; valor: string; nova: boolean };

function FormItemAta({ ata, item, aoFechar }: { ata: Ata; item?: ItemAta; aoFechar: () => void }) {
  const empresas = useLoja((e) => e.empresas);
  const contratos = useLoja((e) => e.contratos);
  const [descricao, setDescricao] = useState(item?.descricao ?? '');
  const [unidade, setUnidade] = useState(item?.unidade ?? '');
  const [parcelas, setParcelas] = useState<LinhaParcela[]>(
    item?.parcelas.map((p) => ({ id: p.id, empresaId: p.empresaId, tipoCota: p.tipoCota, quantidade: textoQuantidade(p.quantidade), valor: textoValor(p.valorUnitario), nova: false })) ?? [
      { id: novoId(), empresaId: '', tipoCota: 'ampla', quantidade: '', valor: '', nova: true },
    ],
  );
  const [bloqueio, setBloqueio] = useState<string[]>([]);
  const [novaEmpresaPara, setNovaEmpresaPara] = useState<{ linha: string; nome: string } | null>(null);

  const mudar = (id: string, campo: keyof LinhaParcela, v: string) => setParcelas(parcelas.map((p) => (p.id === id ? { ...p, [campo]: v } : p)));
  const remover = (p: LinhaParcela) => {
    const deps = p.nova ? [] : [...dependentesDaParcela(p.id, contratos.values()), ...aditivosDaParcela(ata, p.id)];
    if (deps.length) return setBloqueio([`Esta parcela não pode ser removida. Usada em: ${deps.join(', ')}.`]);
    setBloqueio([]);
    setParcelas(parcelas.filter((x) => x.id !== p.id));
  };

  return (
    <>
      <ModalForm
        largo
        titulo={item ? 'Editar item da ARP' : 'Novo item aderido'}
        aoFechar={aoFechar}
        aoSalvar={async () => {
          const erros: string[] = [];
          if (!descricao.trim()) erros.push('Informe a descrição do item.');
          if (!parcelas.length) erros.push('Informe pelo menos um fornecedor.');
          const lidas: Parcela[] = parcelas.map((p, i) => {
            const q = lerQuantidade(p.quantidade);
            const v = lerValor(p.valor);
            if (!p.empresaId) erros.push(`Linha ${i + 1}: escolha o fornecedor.`);
            if (!q || q <= 0) erros.push(`Linha ${i + 1}: quantidade inválida (até 3 casas decimais).`);
            if (!v || v <= 0) erros.push(`Linha ${i + 1}: valor unitário inválido.`);
            return { id: p.id, empresaId: p.empresaId, tipoCota: p.tipoCota, quantidade: q ?? 0, valorUnitario: v ?? 0 };
          });
          if (erros.length) return erros;
          const atual = loja.getState().atas.get(ata.id) ?? ata;
          const novo: ItemAta = { id: item?.id ?? novoId(), descricao: descricao.trim(), unidade: unidade.trim(), parcelas: lidas };
          const itens = item ? atual.itens.map((i) => (i.id === item.id ? novo : i)) : [...atual.itens, novo];
          return gravar({ ...atual, itens }, validar);
        }}
      >
        <div className="grade g4" style={{ marginBottom: 18 }}>
          <Campo rotulo="Descrição do item" className="span3">
            <Entrada valor={descricao} muda={setDescricao} autoFocus />
          </Campo>
          <Campo rotulo="Unidade">
            <Entrada valor={unidade} muda={setUnidade} placeholder="un, resma, serviço" />
          </Campo>
        </div>
        <p className="nota">
          Uma linha por fornecedor. Itens com cota ME/EPP têm uma linha para a ampla concorrência e outra para a cota, cada uma com quantidade e preço próprios.
        </p>
        <Erros erros={bloqueio} />
        <table className="sub-tabela">
          <thead>
            <tr>
              <th style={{ width: '38%' }}>Fornecedor</th>
              <th>Cota</th>
              <th>Quantidade registrada</th>
              <th>Valor unitário</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {parcelas.map((p) => (
              <tr key={p.id}>
                <td>
                  <EscolhaEmpresa
                    valor={p.empresaId}
                    muda={(id) => mudar(p.id, 'empresaId', id)}
                    empresas={empresas}
                    aoNova={(t) => setNovaEmpresaPara({ linha: p.id, nome: t })}
                  />
                </td>
                <td>
                  <Escolha<Parcela['tipoCota']>
                    valor={p.tipoCota}
                    muda={(v) => mudar(p.id, 'tipoCota', v)}
                    opcoes={[
                      ['ampla', 'Ampla'],
                      ['cota_me', 'Cota ME/EPP'],
                    ]}
                  />
                </td>
                <td>
                  <EntradaQuantidade valor={p.quantidade} muda={(v) => mudar(p.id, 'quantidade', v)} placeholder="0" />
                </td>
                <td>
                  <EntradaMoeda valor={p.valor} muda={(v) => mudar(p.id, 'valor', v)} placeholder="0,00" />
                </td>
                <td>
                  <button type="button" className="btn btn-leve btn-mini" onClick={() => remover(p)} aria-label="Remover linha">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="btn btn-mini"
          style={{ marginTop: 10 }}
          onClick={() => setParcelas([...parcelas, { id: novoId(), empresaId: '', tipoCota: 'cota_me', quantidade: '', valor: '', nova: true }])}
        >
          + Fornecedor
        </button>
      </ModalForm>
      {novaEmpresaPara && (
        <FormEmpresa
          nomeInicial={novaEmpresaPara.nome}
          aoFechar={() => setNovaEmpresaPara(null)}
          aoSalvo={(e) => {
            mudar(novaEmpresaPara.linha, 'empresaId', e.id);
            setNovaEmpresaPara(null);
          }}
        />
      )}
    </>
  );
}

function FormAditivoAta({ ata, aoFechar }: { ata: Ata; aoFechar: () => void }) {
  const empresas = useLoja((e) => e.empresas);
  const [tipo, setTipo] = useState<AditivoAta['tipo']>('prazo');
  const [identificacao, setIdentificacao] = useState('');
  const [data, setData] = useState(hojeISO());
  const [novaDataFim, setNovaDataFim] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [valores, setValores] = useState<Record<string, string>>({});
  const [inicioEfeitos, setInicioEfeitos] = useState(hojeISO());
  const reeq = tipo === 'reequilibrio';
  const comPrazo = tipo === 'prazo' || tipo === 'prazo_quantidade';
  const comQtd = tipo === 'quantidade' || tipo === 'prazo_quantidade';
  // Revisão 7: uma linha por fornecedor de cada item, agrupadas por item, com filtro por fornecedor.
  const [fornecedor, setFornecedor] = useState('');
  const parcelas = ata.itens.flatMap((it) => it.parcelas.map((p) => ({ it, p })));
  type LinhaParcelaAta = (typeof parcelas)[number];
  const nomeEmp = (id: string) => empresas.get(id)?.nome ?? '(empresa não encontrada)';
  const fornecedores = [...new Set(parcelas.map((x) => x.p.empresaId))]
    .map((id) => ({ id, rotulo: nomeEmp(id) }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  const propsLancamento = {
    linhas: parcelas,
    chave: (x: LinhaParcelaAta) => x.p.id,
    textoBusca: (x: LinhaParcelaAta) => `${x.it.descricao} ${x.it.unidade} ${nomeEmp(x.p.empresaId)}`,
    grupo: (x: LinhaParcelaAta) => `${x.it.descricao}${x.it.unidade ? ` (${x.it.unidade})` : ''}`,
    colunas: 3,
    placeholderBusca: 'Buscar item ou fornecedor',
    filtroExtra: fornecedor ? (x: LinhaParcelaAta) => x.p.empresaId === fornecedor : undefined,
    controlesExtras:
      fornecedores.length > 1 ? (
        <EscolhaBusca valor={fornecedor} muda={setFornecedor} opcoes={fornecedores} semEscolha="Todos os fornecedores" nomePlural="fornecedores" />
      ) : undefined,
  };
  const cota = (p: Parcela) => (p.tipoCota === 'cota_me' ? <span className="tag">Cota ME/EPP</span> : null);

  return (
    <ModalForm
      largo
      titulo={`Novo aditivo da ARP ${ata.numero}`}
      aoFechar={aoFechar}
      aoSalvar={async () => {
        const erros: string[] = [];
        const quantidades = comQtd
          ? Object.entries(qtds)
              .filter(([, t]) => t.trim())
              .map(([parcelaId, t]) => {
                const q = lerQuantidade(t);
                if (!q || q <= 0) erros.push('Quantidade inválida em uma das parcelas.');
                return { parcelaId, novaQuantidade: q ?? 0 };
              })
          : [];
        const novosValores = reeq
          ? Object.entries(valores)
              .filter(([, t]) => t.trim())
              .map(([parcelaId, t]) => {
                const v = lerValor(t);
                if (!v || v <= 0) erros.push('Valor unitário inválido em um dos fornecedores.');
                return { parcelaId, novoValorUnitario: v ?? 0 };
              })
          : [];
        if (erros.length) return erros;
        const atual = loja.getState().atas.get(ata.id) ?? ata;
        const ad: AditivoAta = {
          id: novoId(),
          identificacao: identificacao.trim(),
          data,
          tipo,
          novaDataFim: comPrazo ? novaDataFim : null,
          quantidades,
          inicioEfeitos: reeq ? inicioEfeitos : '',
          valores: novosValores,
          observacoes,
        };
        const e2 = validarAditivoAta(ad, atual);
        if (e2.length) return e2;
        return gravar({ ...atual, aditivos: [...atual.aditivos, ad] }, validar, 'Aditivo registrado.');
      }}
    >
      <div className="grade g4" style={{ marginBottom: 16 }}>
        <Campo rotulo="Tipo" className="span-todo">
          <Segmentado<AditivoAta['tipo']>
            valor={tipo}
            muda={setTipo}
            opcoes={[
              ['prazo', 'Prazo'],
              ['quantidade', 'Quantidade'],
              ['prazo_quantidade', 'Prazo e quantidade'],
              ['reequilibrio', 'Reequilíbrio econômico-financeiro'],
            ]}
          />
        </Campo>
        <Campo rotulo="Identificação" className="span2">
          <Entrada valor={identificacao} muda={setIdentificacao} placeholder={reeq ? '1º Termo de Reequilíbrio' : '1º Termo Aditivo'} autoFocus />
        </Campo>
        <Campo rotulo={reeq ? 'Data de assinatura' : 'Data'}>
          <EntradaData valor={data} muda={setData} />
        </Campo>
        {reeq && (
          <Campo rotulo="Início dos efeitos" dica="Novos valores valem a partir desta data.">
            <EntradaData valor={inicioEfeitos} muda={setInicioEfeitos} />
          </Campo>
        )}
        {comPrazo && (
          <Campo rotulo="Novo vencimento" dica={`Atual: ${formatarData(dataFimVigenteAta(ata))}`}>
            <EntradaData valor={novaDataFim} muda={setNovaDataFim} />
          </Campo>
        )}
      </div>
      {comQtd && (
        <>
          <p className="nota">Informe a nova quantidade registrada total só dos fornecedores alterados. Deixe em branco os demais.</p>
          <TabelaLancamento
            {...propsLancamento}
            preenchida={(x) => !!qtds[x.p.id]?.trim()}
            cabecalho={
              <>
                <th>Fornecedor</th>
                <th className="direita">Quantidade registrada</th>
                <th style={{ width: 170 }}>Nova quantidade</th>
              </>
            }
            linha={({ p }) => (
              <>
                <td style={{ paddingLeft: 18 }}>
                  {nomeEmp(p.empresaId)} {cota(p)}
                </td>
                <td className="direita num">{formatarQuantidade(quantidadeVigenteParcela(ata, p))}</td>
                <td>
                  <EntradaQuantidade valor={qtds[p.id] ?? ''} muda={(v) => setQtds({ ...qtds, [p.id]: v })} />
                </td>
              </>
            )}
          />
        </>
      )}
      {reeq && (
        <>
          <p className="nota">
            Informe o novo valor unitário só dos fornecedores alterados. Deixe em branco os demais. Os novos valores valem para contratos assinados a partir do início
            dos efeitos. Contratos já existentes mantêm o valor deles: se também mudarem, registre o reequilíbrio no próprio contrato.
          </p>
          <TabelaLancamento
            {...propsLancamento}
            preenchida={(x) => !!valores[x.p.id]?.trim()}
            cabecalho={
              <>
                <th>Fornecedor</th>
                <th className="direita">Valor unitário atual</th>
                <th style={{ width: 180 }}>Novo valor unitário</th>
              </>
            }
            linha={({ p }) => (
              <>
                <td style={{ paddingLeft: 18 }}>
                  {nomeEmp(p.empresaId)} {cota(p)}
                </td>
                <td className="direita num">{formatarValorUnitario(valorParcelaEm(ata, p, inicioEfeitos))}</td>
                <td>
                  <EntradaMoeda valor={valores[p.id] ?? ''} muda={(v) => setValores({ ...valores, [p.id]: v })} placeholder="0,00" />
                </td>
              </>
            )}
          />
        </>
      )}
      <Campo rotulo="Observações">
        <textarea className="entrada" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </Campo>
    </ModalForm>
  );
}

// ---------- Tela ----------

export function AtaTela({ id }: { id: string }) {
  const ata = useLoja((e) => e.atas.get(id));
  const empresas = useLoja((e) => e.empresas);
  const contratosMapa = useLoja((e) => e.contratos);
  const hoje = useLoja((e) => e.hoje);
  const [modal, setModal] = useState<null | 'editar' | 'item' | 'aditivo' | 'contrato' | ItemAta>(null);
  const { pedir, elemento } = useConfirmacao();

  if (!ata)
    return (
      <div className="tabela-caixa">
        <div className="vazio">
          ARP não encontrada. Pode ter sido excluída por outro usuário.{' '}
          <button className="btn btn-mini" onClick={() => irPara({ tela: 'atas' })}>Ver ARPs</button>
        </div>
      </div>
    );

  const contratos = [...contratosMapa.values()];
  const vinculados = contratos.filter((c) => c.ataId === ata.id);
  const s = situacaoAta(ata, hoje);
  const fim = dataFimVigenteAta(ata);
  const dias = diasRestantes(fim, hoje);
  const nomeEmp = (eid: string) => empresas.get(eid)?.nome ?? '(empresa não encontrada)';
  const aditivos = [...ata.aditivos].sort((a, b) => a.data.localeCompare(b.data));
  const faixa = s === 'vigente' && dias <= 30 ? 'f-critico' : s === 'vigente' && dias <= 90 ? 'f-atencao' : '';

  const excluirAditivo = (ad: AditivoAta) =>
    pedir('Excluir aditivo', <p>Excluir o aditivo {ad.identificacao || formatarData(ad.data)}? Vencimento e saldos serão recalculados.</p>, async () => {
      const atual = loja.getState().atas.get(ata.id) ?? ata;
      return gravar({ ...atual, aditivos: atual.aditivos.filter((a) => a.id !== ad.id) }, validar, 'Aditivo excluído.');
    });

  const excluirItem = (it: ItemAta) =>
    pedir('Excluir item', <p>Excluir o item "{it.descricao}" e todos os seus fornecedores?</p>, async () => {
      const atual = loja.getState().atas.get(ata.id) ?? ata;
      const deps = [...dependentesDoItemAta(atual, it.id, loja.getState().contratos.values()), ...it.parcelas.flatMap((p) => aditivosDaParcela(atual, p.id))];
      if (deps.length) return deps;
      return gravar({ ...atual, itens: atual.itens.filter((i) => i.id !== it.id) }, validar, 'Item excluído.');
    });

  return (
    <>
      <CabecalhoImpressao titulo={`ARP ${ata.numero}`} hoje={hoje} />
      <button className="voltar" onClick={() => (history.length > 1 ? history.back() : irPara({ tela: 'atas' }))}>← Voltar</button>

      <section className="ficha">
        <div className={cls('ficha-cab', `s-${s}`, faixa)}>
          <div>
            <div className="ficha-tipo">
              <TagTipo tipo="ata" />
              <span className="tag">SEPOG</span>
              <Situacao s={s} tipo="ata" />
            </div>
            <h1 className="ficha-numero">{ata.numero}</h1>
            <p className="ficha-objeto">{objetoAta(ata) || 'Sem objeto informado'}</p>
          </div>
          <div className="ficha-prazo">
            <span className="data-rotulo">Vencimento</span>
            <span className="data num">{formatarData(fim)}</span>
            <Prazo dias={dias} s={s} />
            {fim !== ata.dataFim && <span className="pequeno fraco">prorrogada (original {formatarData(ata.dataFim)})</span>}
          </div>
        </div>
        <dl className="ficha-dados">
          {ata.dataInicio && <Dado rotulo="Início" num>{formatarData(ata.dataInicio)}</Dado>}
          <Dado rotulo="Itens aderidos" num>{ata.itens.length}</Dado>
          <Dado rotulo="Valor registrado" num>{formatarCentavos(valorTotalAta(ata, hoje))}</Dado>
          <Dado rotulo="Contratos vinculados" num>{vinculados.length}</Dado>
          {ata.observacoes && <Dado rotulo="Observações">{ata.observacoes}</Dado>}
        </dl>
        <div className="ficha-acoes">
          <button className="btn btn-primario" onClick={() => setModal('aditivo')}>+ Aditivo</button>
          <button className="btn" onClick={() => setModal('item')}>+ Item</button>
          <button className="btn" onClick={() => setModal('contrato')}>+ Contrato desta ARP</button>
          <button className="btn" onClick={() => setModal('editar')}>Editar dados</button>
          <span className="separador" />
          <button className="btn btn-mini" onClick={() => exportarAta(ata, empresas, contratos, hoje)}>Planilha</button>
          <button className="btn btn-mini" onClick={() => window.print()}>PDF</button>
          <button
            className="btn btn-mini btn-perigo"
            onClick={() =>
              pedir('Excluir ARP', <p>Excluir a ARP {ata.numero} definitivamente? Itens, fornecedores e aditivos serão apagados.</p>, async () => {
                const r = await loja.getState().excluir(ata, (e) => dependentesDaAta(ata.id, e.contratos.values()));
                if (r.ok) {
                  loja.getState().avisar('ok', `ARP ${ata.numero} excluída.`);
                  irPara({ tela: 'atas' });
                  return [];
                }
                return r.erros;
              })
            }
          >
            Excluir
          </button>
        </div>
      </section>

      <div className="secao">
        <h2>Itens aderidos e saldo</h2>
        <span className="linha" />
      </div>
      <div className="tabela-caixa">
        {ata.itens.length === 0 ? (
          <div className="vazio">Nenhum item aderido. Use “+ Item” para cadastrar.</div>
        ) : (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>Cota</th>
                  <th className="direita">Quantidade registrada</th>
                  <th className="direita">Já contratada</th>
                  <th className="direita">Saldo disponível</th>
                  <th className="direita">Valor unitário</th>
                </tr>
              </thead>
              <tbody>{ata.itens.map((it) => itemLinhas(it))}</tbody>
            </table>
            <div className="nota-tabela">Saldo = quantidade registrada - quantidade já contratada pelo órgão.</div>
          </>
        )}
      </div>

      <div className="secao">
        <h2>Contratos desta ARP</h2>
        <span className="linha" />
        <span className="sub">{vinculados.length}</span>
      </div>
      <div className="tabela-caixa">
        {vinculados.length === 0 ? (
          <div className="vazio">Nenhum contrato usa esta ARP ainda.</div>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Empresa</th>
                <th>Vencimento</th>
                <th>Prazo</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {vinculados.map((c) => {
                const sc = situacaoContrato(c, hoje);
                const fc = dataFimVigenteContrato(c);
                return (
                  <tr key={c.id} className="clicavel" onClick={() => irPara({ tela: 'contrato', id: c.id })}>
                    <td className="doc-numero">{c.numero}</td>
                    <td>{nomeEmp(c.empresaId)}</td>
                    <td className="num">{formatarData(fc)}</td>
                    <td><Prazo dias={diasRestantes(fc, hoje)} s={sc} encerradoEm={c.encerramento?.data} /></td>
                    <td><Situacao s={sc} tipo="contrato" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="secao">
        <h2>Aditivos</h2>
        <span className="linha" />
        <span className="sub">{aditivos.length}</span>
      </div>
      {aditivos.length === 0 ? (
        <div className="tabela-caixa"><div className="vazio">Nenhum aditivo registrado.</div></div>
      ) : (
        <div className="linha-tempo">
          {aditivos.map((ad) => (
            <div key={ad.id} className={cls('evento', (ad.tipo === 'prazo' || ad.tipo === 'prazo_quantidade') && 'prazo-ev')}>
              <div className="evento-cab">
                <strong>{ad.identificacao || 'Aditivo'}</strong>
                <span className="tag">{ROTULO_ADITIVO_ATA[ad.tipo]}</span>
                <span className="num pequeno fraco">{formatarData(ad.data)}</span>
                <button className="btn btn-leve btn-mini nao-imprimir" onClick={() => excluirAditivo(ad)}>Excluir</button>
              </div>
              <div className="evento-corpo">
                {ad.novaDataFim && <div>Novo vencimento: <b className="num">{formatarData(ad.novaDataFim)}</b></div>}
                {ad.tipo === 'reequilibrio' && <div>Novos valores a partir de <b className="num">{formatarData(efeitoReequilibrioAta(ad))}</b>, para contratos novos.</div>}
                {ad.valores.map((v) => {
                  const it = ata.itens.find((i) => i.parcelas.some((p) => p.id === v.parcelaId));
                  const p = it?.parcelas.find((x) => x.id === v.parcelaId);
                  return (
                    <div key={v.parcelaId}>
                      {it?.descricao ?? '(item removido)'} · {p ? nomeEmp(p.empresaId) : ''}: valor unitário passa a <b className="num">{formatarValorUnitario(v.novoValorUnitario)}</b>
                    </div>
                  );
                })}
                {ad.quantidades.map((q) => {
                  const it = ata.itens.find((i) => i.parcelas.some((p) => p.id === q.parcelaId));
                  const p = it?.parcelas.find((x) => x.id === q.parcelaId);
                  return (
                    <div key={q.parcelaId}>
                      {it?.descricao ?? '(item removido)'} · {p ? nomeEmp(p.empresaId) : ''}: quantidade registrada passa a <b className="num">{formatarQuantidade(q.novaQuantidade)}</b>
                    </div>
                  );
                })}
                {ad.observacoes && <div className="fraco">{ad.observacoes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === 'editar' && <FormAta ata={ata} aoFechar={() => setModal(null)} />}
      {modal === 'item' && <FormItemAta ata={ata} aoFechar={() => setModal(null)} />}
      {modal === 'aditivo' && <FormAditivoAta ata={ata} aoFechar={() => setModal(null)} />}
      {modal === 'contrato' && <FormContrato ataInicial={ata.id} aoFechar={() => setModal(null)} />}
      {modal && typeof modal === 'object' && <FormItemAta ata={ata} item={modal} aoFechar={() => setModal(null)} />}
      {elemento}
    </>
  );

  function itemLinhas(it: ItemAta) {
    return (
      <Fragment key={it.id}>
        <tr className="grupo">
          <td colSpan={5}>
            {it.descricao} {it.unidade && <span className="fraco pequeno">({it.unidade})</span>}
          </td>
          <td>
            <div className="acoes-linha">
              <button className="btn btn-leve btn-mini" onClick={() => setModal(it)}>Editar</button>
              <button className="btn btn-leve btn-mini" onClick={() => excluirItem(it)}>Excluir</button>
            </div>
          </td>
        </tr>
        {it.parcelas.map((p) => {
          const reg = quantidadeVigenteParcela(ata!, p);
          const saldo = saldoParcela(ata!, p, contratos);
          return (
            <tr key={p.id}>
              <td style={{ paddingLeft: 26 }}>{nomeEmp(p.empresaId)}</td>
              <td>{p.tipoCota === 'ampla' ? 'Ampla' : <span className="tag">Cota ME/EPP</span>}</td>
              <td className="direita num">
                {formatarQuantidade(reg)}
                {reg !== p.quantidade && <span className="sub">era {formatarQuantidade(p.quantidade)}</span>}
              </td>
              <td className="direita num">{formatarQuantidade(contratadoParcela(p.id, contratos))}</td>
              <td className={cls('direita num forte', saldo < 0 && 'negativo')}>{formatarQuantidade(saldo)}</td>
              <td className="direita num">
                {formatarValorUnitario(valorParcelaEm(ata!, p, hoje))}
                {valorParcelaEm(ata!, p, hoje) !== p.valorUnitario && <span className="sub">era {formatarValorUnitario(p.valorUnitario)}</span>}
              </td>
            </tr>
          );
        })}
      </Fragment>
    );
  }
}
