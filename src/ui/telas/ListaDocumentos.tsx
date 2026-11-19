import { useMemo, useState } from 'react';
import { linhasDocumentos, type LinhaDoc } from '../../estado/seletores';
import { exportarLista } from '../../exportacao/planilha';
import { formatarData } from '../../dominio/datas';
import { CabecalhoImpressao, Escolha, Prazo, Segmentado, Situacao } from '../componentes/base';
import { irPara, useLoja } from '../contexto';
import { usePreferencia } from '../preferencias';
import { casaBusca, compararNumeroDoc } from '../../dominio/texto';

type Ordem = 'vencimento' | 'numero';
const ORDENS: readonly Ordem[] = ['vencimento', 'numero'];

type Filtro = 'vigentes' | 'vencendo' | 'vencidos' | 'encerrados' | 'todos';

const passa = (l: LinhaDoc, f: Filtro) =>
  f === 'todos' ||
  (f === 'vigentes' && l.situacao === 'vigente') ||
  (f === 'vencendo' && l.faixa !== 'normal') ||
  (f === 'vencidos' && l.situacao === 'vencido') ||
  (f === 'encerrados' && l.situacao === 'encerrado');

/** Lista de ARPs ou de contratos. Padrão: só vigentes (vencidos ficam no filtro próprio, RF18). */
export function ListaDocumentos({ tipo, aoNovo }: { tipo: 'ata' | 'contrato'; aoNovo: () => void }) {
  const atas = useLoja((e) => e.atas);
  const contratos = useLoja((e) => e.contratos);
  const empresas = useLoja((e) => e.empresas);
  const hoje = useLoja((e) => e.hoje);
  const [filtro, setFiltro] = useState<Filtro>('vigentes');
  const [modalidade, setModalidade] = useState<'' | 'material' | 'servico'>('');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = usePreferencia<Ordem>(`lista.${tipo}.ordem`, 'vencimento', ORDENS);

  const todas = useMemo(() => linhasDocumentos({ atas, contratos, empresas, hoje }).filter((l) => l.tipo === tipo), [atas, contratos, empresas, hoje, tipo]);
  const n = (f: Filtro) => todas.filter((l) => passa(l, f)).length;
  const linhas = todas.filter((l) => {
    if (!passa(l, filtro)) return false;
    if (modalidade && l.tipoContrato !== modalidade) return false;
    if (busca.trim() && !casaBusca(`${l.numero} ${l.objeto} ${l.empresa}`, busca)) return false;
    return true;
  });
  // linhasDocumentos já vem por vencimento.
  if (ordem === 'numero') linhas.sort((a, b) => compararNumeroDoc(a.numero, b.numero));
  const ehAta = tipo === 'ata';
  const titulo = ehAta ? 'Atas de Registro de Preços' : 'Contratos';

  const opcoes: Array<[Filtro, string, number]> = [
    ['vigentes', ehAta ? 'Vigentes' : 'Vigentes', n('vigentes')],
    ['vencendo', 'Vencendo em 90 dias', n('vencendo')],
    ['vencidos', ehAta ? 'Vencidas' : 'Vencidos', n('vencidos')],
    ...(ehAta ? [] : ([['encerrados', 'Encerrados', n('encerrados')]] as Array<[Filtro, string, number]>)),
    ['todos', ehAta ? 'Todas' : 'Todos', todas.length],
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
              {linhas.map((l) => (
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
    </>
  );
}
