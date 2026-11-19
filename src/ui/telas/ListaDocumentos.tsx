import { useMemo, useState } from 'react';
import { filtrarDocumentos, linhasDocumentos, type FiltroDocs } from '../../estado/seletores';
import { exportarLista } from '../../exportacao/planilha';
import { formatarData } from '../../dominio/datas';
import { CabecalhoImpressao, Escolha, Paginacao, Prazo, Segmentado, Situacao, usePaginacao } from '../componentes/base';
import { FiltroEmpresa } from '../componentes/EscolhaEmpresa';
import { irPara, useLoja } from '../contexto';
import { usePreferencia } from '../preferencias';

type Ordem = 'vencimento' | 'numero';
const ORDENS: readonly Ordem[] = ['vencimento', 'numero'];

type Filtro = FiltroDocs;
const POR_PAGINA = 20;

/** Lista de ARPs ou de contratos. Padrão: só vigentes (vencidos ficam no filtro próprio, RF18). */
export function ListaDocumentos({ tipo, aoNovo }: { tipo: 'ata' | 'contrato'; aoNovo: () => void }) {
  const atas = useLoja((e) => e.atas);
  const contratos = useLoja((e) => e.contratos);
  const empresas = useLoja((e) => e.empresas);
  const hoje = useLoja((e) => e.hoje);
  const [filtro, setFiltro] = useState<Filtro>('vigentes');
  const [modalidade, setModalidade] = useState<'' | 'material' | 'servico'>('');
  const [busca, setBusca] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [ordem, setOrdem] = usePreferencia<Ordem>(`lista.${tipo}.ordem`, 'vencimento', ORDENS);

  const todas = useMemo(() => linhasDocumentos({ atas, contratos, empresas, hoje }).filter((l) => l.tipo === tipo), [atas, contratos, empresas, hoje, tipo]);
  // Contagens dos botões respeitam os outros filtros, para mostrar o que cada situação vai trazer.
  const n = (f: Filtro) => filtrarDocumentos(todas, { filtro: f, modalidade, empresaId, busca }).length;
  const linhas = filtrarDocumentos(todas, { filtro, modalidade, empresaId, busca, ordem });
  const { itens: pagina, paginacao } = usePaginacao(linhas, POR_PAGINA, [filtro, modalidade, empresaId, busca, ordem].join('|'));
  const ehAta = tipo === 'ata';
  const titulo = ehAta ? 'Atas de Registro de Preços' : 'Contratos';

  const opcoes: Array<[Filtro, string, number]> = [
    ['vigentes', ehAta ? 'Vigentes' : 'Vigentes', n('vigentes')],
    ['vencendo', 'Vencendo em 90 dias', n('vencendo')],
    ['vencidos', ehAta ? 'Vencidas' : 'Vencidos', n('vencidos')],
    ...(ehAta ? [] : ([['encerrados', 'Encerrados', n('encerrados')]] as Array<[Filtro, string, number]>)),
    ['todos', ehAta ? 'Todas' : 'Todos', n('todos')],
  ];

  return (
    <>
      <CabecalhoImpressao titulo={titulo} hoje={hoje} />
      <div className="pagina-titulo">
        <h1>{ehAta ? 'ARPs' : 'Contratos'}</h1>
        <p>{ehAta ? 'Atas de Registro de Preços da SEPOG aderidas' : 'Contratos de materiais e serviços'}</p>
        <div className="acoes">
          <button className="btn btn-mini" onClick={() => exportarLista(linhas, titulo, hoje)} disabled={!linhas.length}>Planilha</button>
          <button className="btn btn-mini" onClick={() => window.print()} disabled={!linhas.length}>PDF</button>
          <button className="btn btn-primario" onClick={aoNovo}>{ehAta ? '+ Nova ARP' : '+ Novo contrato'}</button>
        </div>
      </div>

      <div className="filtros">
        <Segmentado<Filtro> valor={filtro} muda={setFiltro} opcoes={opcoes} />
        {!ehAta && (
          <div style={{ width: 190 }}>
            <Escolha valor={modalidade} muda={setModalidade} vazio="Material e serviço" opcoes={[['material', 'Só material'], ['servico', 'Só serviço']]} />
          </div>
        )}
        {!ehAta && <FiltroEmpresa valor={empresaId} muda={setEmpresaId} empresas={empresas} ids={todas.map((l) => l.empresaId)} />}
        <input className="entrada busca" placeholder={ehAta ? 'Buscar número ou objeto' : 'Buscar número, objeto ou empresa'} value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label className="ordenar">
          <span>Ordenar por</span>
          <select className="entrada" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
            <option value="vencimento">Vencimento</option>
            <option value="numero">Número (mais recente)</option>
          </select>
        </label>
      </div>

      <div className="tabela-caixa">
        {linhas.length === 0 ? (
          <div className="vazio">Nada encontrado com esses filtros.</div>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Número</th>
                <th>Objeto</th>
                {!ehAta && <th>Empresa</th>}
                <th>Vencimento</th>
                <th>Prazo</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {pagina.map((l) => (
                <tr key={l.id} className="clicavel" onClick={() => irPara({ tela: l.tipo, id: l.id })}>
                  <td>
                    <span className="doc-numero">{l.numero}</span>
                    {!ehAta && <span className="sub">{l.tipoContrato === 'material' ? 'Material' : 'Serviço'}</span>}
                  </td>
                  <td style={{ maxWidth: 380 }}>{l.objeto || <span className="fraco">-</span>}</td>
                  {!ehAta && <td>{l.empresa}</td>}
                  <td>
                    <span className="num">{formatarData(l.vencimento)}</span>
                    {l.vencimento !== l.vencimentoOriginal && <span className="sub">prorrogado</span>}
                  </td>
                  <td>
                    <Prazo dias={l.dias} s={l.situacao} encerradoEm={contratos.get(l.id)?.encerramento?.data} />
                  </td>
                  <td>
                    <Situacao s={l.situacao} tipo={l.tipo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Paginacao {...paginacao} />
    </>
  );
}
