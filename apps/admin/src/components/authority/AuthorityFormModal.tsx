"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { Camera, User } from "lucide-react";
import { toast } from "sonner";
import type { RoleKey } from "@ecommerce/types";
import Modal from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import Toggle from "@/components/ui/Toggle";
import { apiFetch } from "@/lib/api";
import type { AdminUser } from "@/lib/hooks/useAuthority";
import {
  SYSTEM_ROLE_OPTIONS,
  getAdminRolePresentation,
  resolveAdminRoleKey,
} from "@/lib/admin-access";

/* ── Component ─────────────────────────────────────────────────────────────── */
export type AuthorityFormPayload = {
  name: string;
  email: string;
  password: string;
  roleKey: RoleKey;
  avatarUrl?: string | null;
};

export type AuthorityUpdatePayload = {
  name: string;
  roleKey: RoleKey;
  avatarUrl?: string | null;
  isActive?: boolean;
};

interface AuthorityFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreate?: (data: AuthorityFormPayload) => Promise<void>;
  onUpdate?: (data: AuthorityUpdatePayload) => Promise<void>;
  initial?: AdminUser;
  loading?: boolean;
}

export default function AuthorityFormModal({
  open,
  onClose,
  onCreate,
  onUpdate,
  initial,
  loading,
}: AuthorityFormModalProps) {
  const isEdit = !!initial;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState<RoleKey>(
    SYSTEM_ROLE_OPTIONS[0].roleKey,
  );
  const [isActive, setIsActive] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAvatarRef = useRef<string | null>(null);

  const selectedRole =
    SYSTEM_ROLE_OPTIONS.find((role) => role.roleKey === roleKey) ??
    SYSTEM_ROLE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    pendingAvatarRef.current = null;
    setName(initial?.name ?? "");
    setEmail(initial?.email ?? "");
    setPassword("");
    setAvatarUrl(initial?.avatarUrl ?? null);
    setIsActive(initial?.isActive ?? true);

    if (initial) {
      setRoleKey(
        resolveAdminRoleKey(initial) ?? SYSTEM_ROLE_OPTIONS[0].roleKey,
      );
    } else {
      setRoleKey(SYSTEM_ROLE_OPTIONS[0].roleKey);
    }
  }, [open, initial]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAvatarUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { publicUrl } = await apiFetch<{ publicUrl: string }>(
        "/admin/media/upload",
        {
          method: "POST",
          body: JSON.stringify({
            context: "admin-avatar",
            filename: file.name,
            contentType: file.type,
            data: base64,
          }),
        },
      );

      // Clean up previous pending avatar if there was one
      if (pendingAvatarRef.current) {
        apiFetch("/admin/media/delete", {
          method: "POST",
          body: JSON.stringify({ url: pendingAvatarRef.current }),
        }).catch(() => {});
      }

      pendingAvatarRef.current = publicUrl;
      setAvatarUrl(publicUrl);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao carregar imagem",
      );
    } finally {
      setAvatarUploading(false);
    }
  }

  function handleClose() {
    if (pendingAvatarRef.current) {
      apiFetch("/admin/media/delete", {
        method: "POST",
        body: JSON.stringify({ url: pendingAvatarRef.current }),
      }).catch(() => {});
      pendingAvatarRef.current = null;
    }
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isEdit && onUpdate) {
        await onUpdate({
          name: name.trim(),
          roleKey,
          avatarUrl: avatarUrl,
          isActive,
        });
      } else if (!isEdit && onCreate) {
        await onCreate({
          name: name.trim(),
          email: email.trim(),
          password,
          roleKey,
          avatarUrl: avatarUrl,
        });
      }
      pendingAvatarRef.current = null;
    } catch {
      // error handled by mutation hook
    }
  }

  const isValid = isEdit
    ? name.trim().length >= 2
    : name.trim().length >= 2 &&
      email.trim().length > 0 &&
      password.length >= 8;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? "Editar acesso" : "Detalhes do acesso"}
      maxWidth="max-w-[540px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Avatar */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="relative group w-20 h-20 rounded-full overflow-hidden border-2 border-border-light bg-surface-hover flex items-center justify-center focus:outline-none"
            aria-label="Selecionar foto"
          >
            {avatarUploading ? (
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            ) : avatarUrl ? (
              <>
                <Image
                  fill
                  src={avatarUrl}
                  alt="Avatar"
                  className="object-cover"
                  sizes="80px"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={18} className="text-white" />
                </div>
              </>
            ) : (
              <>
                <User size={28} className="text-text-label" />
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={18} className="text-text-muted" />
                </div>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* Name */}
        <FormField
          label="Nome"
          id="admin-name"
          value={name}
          onChange={setName}
          placeholder="Ex: João Silva"
          autoFocus
          maxLength={100}
        />

        {/* Email — create only */}
        {!isEdit && (
          <FormField
            label="Email"
            id="admin-email"
            value={email}
            onChange={setEmail}
            placeholder="Ex: joao@multitraders.co.mz"
            maxLength={150}
          />
        )}

        {/* Password — create only */}
        {!isEdit && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="admin-password"
              className="text-s font-semibold text-text-dark font-figtree"
            >
              Palavra-passe
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mín. 8 caracteres, 1 maiúscula, 1 número"
              autoComplete="new-password"
              className="w-full bg-bg border border-border-light rounded-lg px-4 py-2.5 text-sm text-text-dark font-figtree placeholder:text-text-muted outline-none focus:border-accent transition-colors"
            />
          </div>
        )}

        {/* Role selector */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="admin-role"
            className="text-s font-semibold text-text-dark font-figtree"
          >
            Role
          </label>
          <select
            id="admin-role"
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value as RoleKey)}
            className="w-full bg-bg border border-border-light rounded-lg px-4 py-2.5 text-sm text-text-dark font-figtree outline-none focus:border-accent transition-colors appearance-none"
          >
            {SYSTEM_ROLE_OPTIONS.map((role) => (
              <option key={role.roleKey} value={role.roleKey}>
                {role.label}
              </option>
            ))}
          </select>

          {/* Description of selected role */}
          <p className="text-[12px] text-text-body font-figtree leading-relaxed bg-surface-hover rounded-lg px-3 py-2 mt-0.5">
            {selectedRole.description}
            {initial && !getAdminRolePresentation(initial)
              ? " Role atual personalizada será convertida para a role selecionada ao guardar."
              : ""}
          </p>
        </div>

        {/* Active toggle — edit only */}
        {isEdit && (
          <Toggle label="Conta ativa" value={isActive} onChange={setIsActive} />
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={loading || !isValid || avatarUploading}
            className="bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "A guardar..." : isEdit ? "Atualizar" : "Criar acesso"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
