import { useEffect, useState } from 'react';
import { recuperarPasta, type EstadoPastaSalva } from '../armazenamento/pastaRede';
import type { Repositorio } from '../armazenamento/repositorio';
import { repositorioDemonstracao } from '../estado/demo';
import { ModalConflito } from './componentes/Conflito';
import { exportarTudo } from '../exportacao/planilha';
import { Assinatura } from './componentes/Assinatura';
import { hrefDe, loja, useLoja, useRota, type Rota } from './contexto';
import { AtaTela, FormAta } from './telas/AtaTela';
import { TelaConexao } from './telas/Conexao';
import { ContratoTela, FormContrato } from './telas/ContratoTela';
import { TelaEmpresas } from './telas/Empresas';
import { Inicio } from './telas/Inicio';
import { ListaDocumentos } from './telas/ListaDocumentos';
import { GavetaOrdem, TelaOrdens } from './telas/Ordens';
import { Visor } from './telas/Visor';
import { BotaoVersao, FaixaAtualizacao, ModalAtualizacao, ModalNovidades, useVerificacaoDeVersao } from './componentes/Atualizacao';

const INTERVALO_VERIFICACAO = 2 * 60 * 1000;

export function App() {
  const repo = useLoja((e) => e.repo);
  const [salva, setSalva] = useState<EstadoPastaSalva | null>(null);

  useEffect(() => {
    (async () => {
      if (new URLSearchParams(location.search).has('demo')) {
        // Gancho de inspeção, só no modo demonstração (dados fictícios em memória).
        const { prepararPasta, RepositorioPastaRede } = await import('../armazenamento/pastaRede');
        Object.assign(window, { __vigencias: { loja, prepararPasta, RepositorioPastaRede } });
        return conectar(await repositorioDemonstracao());
      }
      const s = await recuperarPasta().catch(() => ({ tipo: 'nenhuma' }) as const);
      if (s.tipo === 'pronta') return conectar(s.repo);
      setSalva(s);
    })();
  }, []);

  function conectar(r: Repositorio) {
    loja.getState().conectar(r);
  }

  if (repo) return <Sistema />;
  if (!salva) return null;
  return <TelaConexao salva={salva} aoConectar={conectar} />;
}

const ABAS: Array<[Rota['tela'], string]> = [
  ['inicio', 'Início'],
  ['atas', 'ARPs'],
  ['contratos', 'Contratos'],
  ['ordens', 'OF/OS'],
  ['empresas', 'Empresas'],
];

function abaAtiva(r: Rota): Rota['tela'] {
  if (r.tela === 'ata') return 'atas';
  if (r.tela === 'contrato') return 'contratos';
  return r.tela;
}

function Sistema() {
  const rota = useRota();
  const repo = useLoja((e) => e.repo)!;
  const ultima = useLoja((e) => e.ultimaLeitura);
  const carregando = useLoja((e) => e.carregando);
  const haAlteracoes = useLoja((e) => e.haAlteracoes);
  const [novo, setNovo] = useState<null | 'ata' | 'contrato'>(null);

  useEffect(() => {
    if (rota.tela === 'visor') return;
    const t = setInterval(() => loja.getState().verificarAlteracoes(), INTERVALO_VERIFICACAO);
    const vis = () => document.visibilityState === 'visible' && loja.getState().verificarAlteracoes();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [rota.tela]);

  useVerificacaoDeVersao(rota.tela === 'visor');

  if (rota.tela === 'visor') return <Visor />;

  const demo = repo.nome.startsWith('Demonstração');
  const ativa = abaAtiva(rota);

  return (
    <>
      <header className="topo nao-imprimir">
        <div className="topo-interno">
          <Assinatura />
          <nav className="nav">
            {ABAS.map(([t, r]) => (
              <a key={t} href={hrefDe({ tela: t } as Rota)} aria-current={ativa === t ? 'page' : undefined}>
                {r}
              </a>
            ))}
            <span className="espaco" />
            <a className="btn btn-escuro btn-mini" href={hrefDe({ tela: 'visor' })} style={{ color: '#fff', borderBottom: 0, padding: '8px 12px' }}>
              Visor para TV
            </a>
          </nav>
        </div>
      </header>

      <FaixaAtualizacao />
      {haAlteracoes && (
        <div className="banner-alteracoes nao-imprimir">
          Outra pessoa salvou alterações na pasta de dados.
          <button className="btn btn-mini btn-primario" onClick={() => loja.getState().carregar()}>Atualizar agora</button>
        </div>
      )}

      <div className="faixa-status nao-imprimir">
        <span>{demo ? 'Demonstração com dados fictícios: nada é gravado' : `Pasta de dados: ${repo.nome}`}</span>
        <span>{carregando ? 'lendo…' : ultima ? `atualizado às ${new Date(ultima).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
        <span className="espaco" />
        <BotaoVersao />
        <button
          className="btn btn-leve btn-mini"
          title="Uma planilha com ARPs, itens, contratos, saldos e contatos das empresas"
          onClick={() => {
            const e = loja.getState();
            exportarTudo([...e.atas.values()], [...e.contratos.values()], e.empresas, e.hoje);
          }}
        >
          Exportar todos os dados
        </button>
        <button className="btn btn-leve btn-mini" onClick={() => loja.getState().carregar()} disabled={carregando}>Atualizar</button>
        <button
          className="btn btn-leve btn-mini"
          onClick={() => {
            loja.getState().desconectar();
            location.hash = '#/';
            if (demo) location.search = '';
            else location.reload();
          }}
        >
          {demo ? 'Sair da demonstração' : 'Trocar pasta'}
        </button>
      </div>

      <main className="conteudo">
        {rota.tela === 'inicio' && <Inicio aoNovaAta={() => setNovo('ata')} aoNovoContrato={() => setNovo('contrato')} />}
        {rota.tela === 'atas' && <ListaDocumentos key="atas" tipo="ata" aoNovo={() => setNovo('ata')} />}
        {rota.tela === 'contratos' && <ListaDocumentos key="contratos" tipo="contrato" aoNovo={() => setNovo('contrato')} />}
        {rota.tela === 'ordens' && <TelaOrdens />}
        {rota.tela === 'ata' && <AtaTela key={rota.id} id={rota.id} />}
        {rota.tela === 'contrato' && <ContratoTela key={rota.id} id={rota.id} />}
        {rota.tela === 'empresas' && <TelaEmpresas />}
      </main>

      {novo === 'ata' && <FormAta aoFechar={() => setNovo(null)} />}
      {novo === 'contrato' && <FormContrato aoFechar={() => setNovo(null)} ataInicial={rota.tela === 'ata' ? rota.id : undefined} />}
      <GavetaOrdem />
      <ModalConflito />
      <ModalAtualizacao />
      <ModalNovidades />
      <Avisos />
    </>
  );
}

function Avisos() {
  const avisos = useLoja((e) => e.avisos);
  return (
    <div className="avisos" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className={`aviso ${a.tipo}`}>
          <span>{a.texto}</span>
          <button onClick={() => loja.getState().dispensarAviso(a.id)} aria-label="Fechar aviso">✕</button>
        </div>
      ))}
    </div>
  );
}
