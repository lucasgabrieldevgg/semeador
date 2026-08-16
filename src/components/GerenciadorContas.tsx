"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Conta {
  id: string;
  nome: string;
  criado_em: string;
  ultima_presenca: string | null;
  online: boolean;
  total_respostas: number;
  taxa: number | null;
  mensagens_nao_lidas: number;
}

/**
 * 🗂️ GERENCIADOR DE CONTAS (Painel Admin)
 * - lista todas as contas com busca e ordenação
 * - status online/offline ao vivo
 * - criar conta manualmente
 * - renomear / zerar progresso / excluir
 * - seleção múltipla + exclusão em massa
 */
export default function GerenciadorContas({ aoMudar }: { aoMudar?: () => void }) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<"recentes" | "nome" | "atividade">("recentes");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [novoNome, setNovoNome] = useState("");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/usuarios");
      const json = await res.json();
      if (json?.contas) setContas(json.contas);
    } catch {}
  }, []);

  useEffect(() => {
    carregar();
    const i = setInterval(carregar, 30_000);
    return () => clearInterval(i);
  }, [carregar]);

  function notificar(msg: string) {
    setFeedback(msg);
    aoMudar?.();
  }

  /* ---------- Ações ---------- */
  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setOcupado(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novoNome.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro);
      notificar(`✅ ${json.mensagem}`);
      setNovoNome("");
      carregar();
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function renomear(c: Conta) {
    const nome = window.prompt(`Novo nome para "${c.nome}":`, c.nome);
    if (!nome || nome.trim() === c.nome) return;
    setOcupado(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: c.id, acao: "renomear", novoNome: nome.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro);
      notificar(`✅ ${json.mensagem}`);
      carregar();
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function zerarProgresso(c: Conta) {
    if (
      !window.confirm(
        `Zerar o progresso de quiz de "${c.nome}"?\n\nApaga ${c.total_respostas} resposta(s). A conta é mantida.\nEssa ação não pode ser desfeita.`
      )
    )
      return;
    setOcupado(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: c.id, acao: "limpar_progresso" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro);
      notificar(`✅ Progresso de "${c.nome}" zerado.`);
      carregar();
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function excluir(c: Conta) {
    if (
      !window.confirm(
        `EXCLUIR a conta "${c.nome}" permanentemente?\n\nApaga: conta, respostas, sessões, mensagens, chats e desafios.\nNÃO pode ser desfeito.`
      )
    )
      return;
    const digitado = window.prompt(`Para confirmar, digite o nome da conta: ${c.nome}`);
    if (digitado?.trim().toLowerCase() !== c.nome.toLowerCase()) {
      setFeedback("⚠️ Exclusão cancelada (nome não confere).");
      return;
    }
    setOcupado(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: c.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro);
      notificar(`✅ ${json.mensagem}`);
      setSelecionadas((s) => {
        const n = new Set(s);
        n.delete(c.id);
        return n;
      });
      carregar();
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function excluirSelecionadas() {
    const ids = Array.from(selecionadas);
    if (!ids.length) return;
    const nomes = contas.filter((c) => selecionadas.has(c.id)).map((c) => c.nome);
    if (
      !window.confirm(
        `EXCLUIR ${ids.length} conta(s) permanentemente?\n\n${nomes.join(", ")}\n\nApaga todos os dados de cada uma. NÃO pode ser desfeito.`
      )
    )
      return;
    const confirmacao = window.prompt(`Para confirmar, digite: EXCLUIR ${ids.length}`);
    if (confirmacao?.trim().toUpperCase() !== `EXCLUIR ${ids.length}`) {
      setFeedback("⚠️ Exclusão em massa cancelada (confirmação não confere).");
      return;
    }
    setOcupado(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioIds: ids }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro);
      notificar(`✅ ${json.mensagem}`);
      setSelecionadas(new Set());
      carregar();
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    } finally {
      setOcupado(false);
    }
  }

  /* ---------- Filtro e ordenação ---------- */
  const visiveis = useMemo(() => {
    let lista = contas;
    if (busca.trim()) {
      const b = busca.trim().toLowerCase();
      lista = lista.filter((c) => c.nome.toLowerCase().includes(b));
    }
    const copia = [...lista];
    if (ordem === "nome") copia.sort((a, b) => a.nome.localeCompare(b.nome));
    else if (ordem === "atividade")
      copia.sort(
        (a, b) =>
          new Date(b.ultima_presenca ?? 0).getTime() - new Date(a.ultima_presenca ?? 0).getTime()
      );
    // "recentes" já vem ordenado por criado_em desc da API
    return copia;
  }, [contas, busca, ordem]);

  function alternarSelecao(id: string) {
    setSelecionadas((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function alternarTodas() {
    if (selecionadas.size === visiveis.length) setSelecionadas(new Set());
    else setSelecionadas(new Set(visiveis.map((c) => c.id)));
  }

  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "nunca";

  return (
    <section className="card mt-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-extrabold text-lg">🗂️ Gerenciar contas ({contas.length})</h2>
        <span className="text-xs font-bold text-gray-400">
          🟢 {contas.filter((c) => c.online).length} online · atualiza a cada 30s
        </span>
      </div>

      {feedback && <p className="font-bold text-sm mb-3 animate-pop" role="status">{feedback}</p>}

      {/* Criar conta */}
      <form onSubmit={criarConta} className="flex gap-2 mb-4">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Criar nova conta: nome do aluno..."
          maxLength={40}
          className="flex-1 rounded-2xl border-2 border-gray-300 dark:border-[#37464f] bg-white dark:bg-[#131f24] px-4 py-2.5 font-semibold focus:outline-none focus:border-duo-blue"
        />
        <button type="submit" disabled={ocupado || !novoNome.trim()} className="btn-green !px-4 !py-2 text-sm disabled:opacity-50">
          + Criar
        </button>
      </form>

      {/* Busca e ordenação */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔍 Buscar conta..."
          className="flex-1 min-w-[150px] rounded-2xl border-2 border-gray-300 dark:border-[#37464f] bg-white dark:bg-[#131f24] px-4 py-2 font-semibold text-sm focus:outline-none focus:border-duo-blue"
        />
        <select
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as any)}
          className="rounded-2xl border-2 border-gray-300 dark:border-[#37464f] bg-white dark:bg-[#131f24] px-3 py-2 font-bold text-sm"
        >
          <option value="recentes">📅 Mais recentes</option>
          <option value="nome">🔤 Nome (A-Z)</option>
          <option value="atividade">⚡ Última atividade</option>
        </select>
      </div>

      {/* Barra de seleção múltipla */}
      <div className="flex items-center gap-3 mb-2 px-1">
        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={visiveis.length > 0 && selecionadas.size === visiveis.length}
            onChange={alternarTodas}
            className="w-4 h-4 accent-duo-blue"
          />
          Selecionar todas ({visiveis.length})
        </label>
        {selecionadas.size > 0 && (
          <button
            onClick={excluirSelecionadas}
            disabled={ocupado}
            className="btn-red !px-3 !py-1.5 text-xs ml-auto disabled:opacity-50 animate-pop"
          >
            🗑️ Excluir {selecionadas.size} selecionada(s)
          </button>
        )}
      </div>

      {/* Lista */}
      {visiveis.length === 0 && (
        <p className="text-gray-400 font-semibold text-sm py-4 text-center">
          {busca ? "Nenhuma conta encontrada na busca." : "Nenhuma conta criada ainda."}
        </p>
      )}
      <ul className="divide-y divide-gray-200 dark:divide-[#37464f]">
        {visiveis.map((c) => (
          <li key={c.id} className="py-3 flex items-center gap-3">
            <input
              type="checkbox"
              checked={selecionadas.has(c.id)}
              onChange={() => alternarSelecao(c.id)}
              className="w-4 h-4 accent-duo-blue shrink-0"
              aria-label={`Selecionar ${c.nome}`}
            />
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-duo-blue flex items-center justify-center text-white font-extrabold">
                {c.nome.charAt(0).toUpperCase()}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#202f36] ${c.online ? "bg-duo-green" : "bg-gray-400"}`}
                title={c.online ? "Online" : "Offline"}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold truncate">
                {c.nome}
                {c.mensagens_nao_lidas > 0 && (
                  <span className="ml-2 text-[10px] font-bold bg-duo-yellow text-yellow-900 rounded-full px-2 py-0.5">
                    📩 {c.mensagens_nao_lidas} não lida(s)
                  </span>
                )}
              </p>
              <p className="text-[11px] font-semibold text-gray-400 truncate">
                Criada {fmt(c.criado_em)} · visto {fmt(c.ultima_presenca)} ·{" "}
                {c.total_respostas} resposta(s)
                {c.taxa !== null && (
                  <span className={c.taxa >= 70 ? "text-duo-green" : "text-duo-red"}> · {c.taxa}%</span>
                )}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => renomear(c)} disabled={ocupado} className="btn-ghost !px-2.5 !py-1.5 text-xs disabled:opacity-50" title="Renomear">
                ✏️
              </button>
              <button onClick={() => zerarProgresso(c)} disabled={ocupado || !c.total_respostas} className="btn-ghost !px-2.5 !py-1.5 text-xs disabled:opacity-50" title="Zerar progresso">
                🧹
              </button>
              <button onClick={() => excluir(c)} disabled={ocupado} className="btn-red !px-2.5 !py-1.5 text-xs disabled:opacity-50" title="Excluir conta">
                🗑️
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
