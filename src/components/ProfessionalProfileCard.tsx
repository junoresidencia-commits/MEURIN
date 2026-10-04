"use client";

import Link from "next/link";
import { ProfilePhotoUploader } from "@/components/ProfilePhotoUploader";

type Props = {
  photoEndpoint: string;
  settingsHref?: string;
  name: string;
  missing?: string[];
  onPhotoChange?: (url: string | null) => void;
};

export function ProfessionalProfileCard({ photoEndpoint, settingsHref, name, missing = [], onPhotoChange }: Props) {
  const incomplete = missing.length > 0;
  return (
    <section className="panel mt-6 border-[var(--border-gold)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Seu perfil</p>
          <h2 className="font-display text-xl text-[var(--text)]">
            {incomplete ? "Adicione sua foto e complete o perfil" : "Foto e dados profissionais"}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            A foto aparece na rede, nos encaminhamentos e no seu painel. Toque em Adicionar foto — não precisa sair daqui.
          </p>
        </div>
        {settingsHref && (
          <Link href={settingsHref} className="btn-ghost text-sm">
            Ajustar perfil completo →
          </Link>
        )}
      </div>
      <div className="mt-4">
        <ProfilePhotoUploader
          endpoint={photoEndpoint}
          label="Foto de perfil"
          hint="Toque em Adicionar foto para enviar PNG, JPG ou WEBP. Troque ou remova quando quiser."
          fallback={name || "Eu"}
          onChange={onPhotoChange}
        />
      </div>
      {incomplete && (
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          Ainda falta: {missing.join(", ")}.
          {settingsHref && (
            <>
              {" "}
              <Link href={settingsHref} className="font-semibold text-[var(--gold)]">
                Abrir perfil e recebimentos
              </Link>
            </>
          )}
        </p>
      )}
    </section>
  );
}
