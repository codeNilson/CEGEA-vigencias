import { useMemo } from 'react';
import type { Empresa } from '../../dominio/tipos';
import { EscolhaBusca, type OpcaoBusca } from './EscolhaBusca';

/**
 * Campo de escolha de empresa com busca (revisão 5). Substitui a lista suspensa,
 * que fica inutilizável com dezenas de fornecedores. Busca por nome ou CNPJ, sem acento;
 * a última opção cadastra uma nova empresa com o texto digitado.
 */
export function EscolhaEmpresa({
  valor,
  muda,
  empresas,
  aoNova,
  desabilitado,
  autoFocus,
}: {
  valor: string;
  muda: (id: string) => void;
  empresas: Map<string, Empresa>;
  aoNova?: (texto: string) => void;
  desabilitado?: boolean;
  autoFocus?: boolean;
}) {
  const opcoes = useMemo<OpcaoBusca[]>(
    () =>
      [...empresas.values()]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((e) => ({ id: e.id, rotulo: e.nome, sub: e.cnpj || 'sem CNPJ', busca: `${e.nome} ${e.cnpj ?? ''} ${(e.cnpj ?? '').replace(/\D/g, '')}` })),
    [empresas],
  );
  return (
    <EscolhaBusca
      valor={valor}
      muda={muda}
      opcoes={opcoes}
      placeholder="Digite o nome ou CNPJ…"
      nomePlural="empresas"
      detalheEscolhida={valor ? empresas.get(valor)?.cnpj ?? undefined : undefined}
      desabilitado={desabilitado}
      autoFocus={autoFocus}
      nova={aoNova && { rotulo: (t) => `+ Cadastrar nova empresa${t ? ` “${t}”` : ''}`, acao: aoNova }}
    />
  );
}
