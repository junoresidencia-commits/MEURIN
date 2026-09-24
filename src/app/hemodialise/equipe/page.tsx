"use client";

import { useEffect, useState } from "react";
import { useHd } from "@/components/hd/HdShell";
import { HD_PERM_LABEL, HD_ROLE_LABEL } from "@/lib/hd-labels";
import { HD_PERM_KEYS, type HdPermKey, type HdRole } from "@/lib/hd-types";

type Member = {
  id: string;
  name: string;
  email: string;
  role: HdRole;
  functionLabel: string;
  status: string;
  lastAccessAt: string | null;
  permissions: Record<HdPermKey, boolean>;
};

export default function HdEquipePage() {
  const { can } = useHd();
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<HdRole>("ENFERMAGEM");
  const [fn, setFn] = useState("");
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState<Member | null>(null);

  async function load() {
    const d = await fetch("/api/hemodialise?view=team").then((r) => r.json());
    setMembers(d.members || []);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_member", email, name, role, functionLabel: fn }),
    });
    const d = await r.json();
    if (d.error) setMsg(d.error);
    else {
      setOpen(false);
      setEmail("");
      setName("");
      setMsg(d.member?.status === "invited" ? "Convite registrado. A pessoa entra ao criar/usar a conta do Meu Rim." : "Membro adicionado.");
      await load();
    }
  }

  async function patch(memberId: string, body: Record<string, unknown>) {
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_member", memberId, ...body }),
    });
    const d = await r.json();
    if (d.error) setMsg(d.error);
    else {
      setMsg(body.status === "inactive" ? "Acesso desativado. O histórico foi preservado." : "Atualizado.");
      setEdit(null);
      await load();
    }
  }

  if (!can("manage_team")) return <p>Somente o administrador da Hemodiálise gerencia a equipe.</p>;

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold">Equipe</h2>
          <p className="text-sm text-[var(--text-muted)]">Quem pode usar a Hemodiálise. Desativar não apaga auditoria.</p>
        </div>
        <button type="button" className="btn-gold" onClick={() => setOpen(true)}>Adicionar membro</button>
      </div>
      {msg && <p className="mt-2 text-sm text-[var(--gold)]">{msg}</p>}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-[var(--text-muted)]">
              <th className="px-2 py-2 text-left">Nome</th>
              <th className="px-2 py-2 text-left">E-mail</th>
              <th className="px-2 py-2 text-left">Função</th>
              <th className="px-2 py-2 text-left">Perfil</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Último acesso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-[var(--border)]">
                <td className="px-2 py-2 font-semibold">{m.name}</td>
                <td className="px-2 py-2">{m.email}</td>
                <td className="px-2 py-2">{m.functionLabel || "—"}</td>
                <td className="px-2 py-2">{HD_ROLE_LABEL[m.role]}</td>
                <td className="px-2 py-2">{m.status}</td>
                <td className="px-2 py-2">{m.lastAccessAt ? new Date(m.lastAccessAt).toLocaleString("pt-BR") : "—"}</td>
                <td className="px-2 py-2">
                  <button type="button" className="text-[var(--gold)]" onClick={() => setEdit(m)}>Permissões</button>
                  {m.status === "active" && (
                    <button type="button" className="ml-3 text-[var(--danger)]" onClick={() => patch(m.id, { status: "inactive" })}>Desativar acesso</button>
                  )}
                  {m.status !== "active" && (
                    <button type="button" className="ml-3 text-[var(--gold)]" onClick={() => patch(m.id, { status: "active" })}>Reativar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <form onSubmit={add} className="panel mt-4 grid gap-3 sm:grid-cols-2">
          <h3 className="font-display text-lg font-bold sm:col-span-2">Adicionar membro</h3>
          <input required className="rounded-xl border border-[var(--border)] px-3 py-2" placeholder="E-mail da conta Meu Rim" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="rounded-xl border border-[var(--border)] px-3 py-2" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="rounded-xl border border-[var(--border)] px-3 py-2" placeholder="Função (ex.: Enfermeira)" value={fn} onChange={(e) => setFn(e.target.value)} />
          <select className="rounded-xl border border-[var(--border)] px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as HdRole)}>
            {(Object.keys(HD_ROLE_LABEL) as HdRole[]).map((k) => <option key={k} value={k}>{HD_ROLE_LABEL[k]}</option>)}
          </select>
          <div className="sm:col-span-2 flex gap-2">
            <button className="btn-gold" type="submit">Salvar</button>
            <button className="btn-ghost" type="button" onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {edit && (
        <div className="panel mt-4">
          <p className="font-display text-lg font-bold">Permissões de {edit.name}</p>
          <p className="text-sm text-[var(--text-muted)]">Perfil {HD_ROLE_LABEL[edit.role]} com ajustes individuais.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {HD_PERM_KEYS.map((k) => (
              <label key={k} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                <span>{HD_PERM_LABEL[k]}</span>
                <input
                  type="checkbox"
                  checked={Boolean(edit.permissions[k])}
                  onChange={(e) => setEdit({ ...edit, permissions: { ...edit.permissions, [k]: e.target.checked } })}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-gold" onClick={() => patch(edit.id, { permissions: edit.permissions, role: edit.role, functionLabel: edit.functionLabel })}>Salvar permissões</button>
            <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
