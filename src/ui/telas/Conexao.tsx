import { useState } from 'react';
import { concederPermissao, escolherPasta, suportaPasta, type EstadoPastaSalva } from '../../armazenamento/pastaRede';
import type { Repositorio } from '../../armazenamento/repositorio';
import { repositorioDemonstracao } from '../../estado/demo';
import { Assinatura } from '../componentes/Assinatura';
import { ORGAO } from '../orgao';

export function TelaConexao({ salva, aoConectar }: { salva: EstadoPastaSalva; aoConectar: (r: Repositorio) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function tentar(f: () => Promise<Repositorio | null>) {
    setErro(null);
    setOcupado(true);
    try {
      const r = await f();
      if (r) aoConectar(r);
      else setErro('Permissão negada. Sem ela o sistema não consegue ler a pasta de dados.');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="conexao">
      <div className="conexao-cartao">
        <Assinatura comApp={false} />
        <h1>{ORGAO.sistema}</h1>
        {!suportaPasta() ? (
          <p>Abra este arquivo no Google Chrome. Outros navegadores não conseguem ler a pasta de dados na rede.</p>
        ) : salva.tipo === 'precisa-permissao' ? (
          <>
            <p>O Chrome pede confirmação para acessar a pasta de dados.</p>
            <button className="btn btn-primario" disabled={ocupado} onClick={() => tentar(() => concederPermissao(salva.handle))}>
              Permitir acesso à pasta
            </button>
          </>
        ) : (
          <>
            <p>Escolha a pasta <b>dados</b> que fica ao lado deste arquivo, na pasta de rede do setor.</p>
            <button className="btn btn-primario" disabled={ocupado} onClick={() => tentar(escolherPasta)}>
              Escolher pasta de dados
            </button>
            <details>
              <summary>Primeira vez?</summary>
              <ol>
                <li>Crie uma pasta vazia chamada "dados" ao lado do arquivo Vigencias.html.</li>
                <li>Escolha essa pasta no botão acima. O sistema monta a estrutura.</li>
                <li>Cada colega faz isso uma vez no próprio computador.</li>
              </ol>
            </details>
          </>
        )}
        {erro && (
          <ul className="erros" style={{ marginTop: 14 }}>
            <li>{erro}</li>
          </ul>
        )}
        <div className="conexao-rodape">
          {salva.tipo === 'precisa-permissao' ? <button onClick={() => tentar(escolherPasta)}>Escolher outra pasta</button> : <span />}
          <button onClick={() => tentar(() => repositorioDemonstracao())}>Ver demonstração</button>
        </div>
      </div>
    </div>
  );
}
