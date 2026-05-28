"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Truck,
  Globe,
  Headphones,
  ChevronDown,
} from "lucide-react";

/* ─── Social icons ───────────────────────────────────────────── */
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
    </svg>
  );
}
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.83 1.54V6.76a4.85 4.85 0 0 1-1.06-.07Z" />
    </svg>
  );
}
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
    </svg>
  );
}
function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0Z" />
    </svg>
  );
}

/* ─── Data ───────────────────────────────────────────────────── */
const TRUST_ITEMS = [
  { icon: CreditCard, label: "Pagamento seguro" },
  { icon: Truck, label: "Entrega ao domicílio" },
  { icon: Globe, label: "Lojas mundiais" },
  { icon: Headphones, label: "Atendimento ao cliente" },
];

const LOJA = [
  { href: "/produtos?genero=homem", label: "Homem" },
  { href: "/produtos?genero=mulher", label: "Mulher" },
  { href: "/produtos?categoria=joias", label: "Joias" },
  { href: "/produtos?categoria=desporto", label: "Desporto" },
  { href: "/produtos?categoria=casa", label: "Casa" },
  { href: "/produtos?categoria=relogios", label: "Relógios" },
  { href: "/produtos?categoria=calcados", label: "Calçados" },
];

const BRANDS = [
  { href: "/marcas/adidas", label: "Adidas" },
  { href: "/marcas/nike", label: "Nike" },
  { href: "/marcas/puma", label: "Puma" },
  { href: "/marcas/aldo", label: "Aldo" },
  { href: "/marcas/timberland", label: "Timberland" },
  { href: "/marcas/ray-ban", label: "Ray Ban" },
  { href: "/marcas", label: "Tudo" },
];

const POLICIES = [
  { href: "/politicas/privacidade", label: "Política de privacidade" },
  { href: "/politicas/venda", label: "Política de venda" },
  { href: "/politicas/utilizacao", label: "Condições de utilização" },
  { href: "/politicas/termos", label: "Termos e condições" },
  { href: "/politicas/registo", label: "Registo legal" },
];

const HELP = [
  { href: "/ajuda/faq", label: "FAQ" },
  { href: "/ajuda/email", label: "Email" },
  { href: "/ajuda/telefone", label: "Telefone" },
  { href: "/ajuda/localizacao", label: "Localização" },
];

const SOCIALS = [
  { href: "https://facebook.com", label: "Facebook", Icon: FacebookIcon },
  { href: "https://tiktok.com", label: "TikTok", Icon: TikTokIcon },
  { href: "https://instagram.com", label: "Instagram", Icon: InstagramIcon },
  { href: "https://pinterest.com", label: "Pinterest", Icon: PinterestIcon },
];

const PAYMENT_LOGOS = [
  { src: "/financial-logos/visa.png", alt: "Visa" },
  { src: "/financial-logos/mastercard.png", alt: "Mastercard" },
  { src: "/financial-logos/mpesa.png", alt: "M-Pesa" },
  { src: "/financial-logos/emola.png", alt: "e-Mola" },
];

/* ─── Helpers ────────────────────────────────────────────────── */
function ColHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-white font-bold text-sm mb-4 tracking-wide">
      {children}
    </p>
  );
}

function ColLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block text-white text-sm font-normal hover:text-white transition-colors duration-150 mb-2.5"
    >
      {children}
    </Link>
  );
}

function AccordionSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-white font-semibold text-sm text-left"
      >
        {title}
        <ChevronDown
          className={`w-5 h-5 text-white/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────── */
export default function Footer() {
  return (
    <footer className="bg-footer-bg">
      {/* ── Trust bar ─────────────────────────────────────── */}
      <div className="container-web py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-3 text-center"
            >
              <Icon className="w-8 h-8 text-white stroke-[1.2]" />
              <span className="text-white text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="container-web">
        <hr className="border-accent/40" />
      </div>

      {/* ── Desktop link columns ───────────────────────────── */}
      <div className="container-web py-12 hidden md:block">
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-10 text-white">
          <div>
            <ColHeading>Loja</ColHeading>
            {LOJA.map((l) => (
              <ColLink key={l.href} href={l.href}>
                {l.label}
              </ColLink>
            ))}
          </div>
          <div>
            <ColHeading>Marcas</ColHeading>
            {BRANDS.map((l) => (
              <ColLink key={l.href} href={l.href}>
                {l.label}
              </ColLink>
            ))}
          </div>
          <div>
            <ColHeading>Políticas</ColHeading>
            {POLICIES.map((l) => (
              <ColLink key={l.href} href={l.href}>
                {l.label}
              </ColLink>
            ))}
          </div>
          <div>
            <ColHeading>Ajuda e contacto</ColHeading>
            {HELP.map((l) => (
              <ColLink key={l.href} href={l.href}>
                {l.label}
              </ColLink>
            ))}
            <p className="text-footer-link text-xs leading-relaxed mt-4">
              A nossa equipa de apoio ao cliente está disponível de segunda a
              sábado, das 8h às 18h.
            </p>
          </div>
          <div>
            <ColHeading>Segue-nos</ColHeading>
            <div className="flex flex-col gap-3">
              {SOCIALS.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-footer-link text-sm hover:text-white transition-colors duration-150"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile accordion ──────────────────────────────── */}
      <div className="container-web pt-4 pb-2 md:hidden text-white">
        <AccordionSection title="Loja">
          {LOJA.map((l) => (
            <ColLink key={l.href} href={l.href}>
              {l.label}
            </ColLink>
          ))}
        </AccordionSection>
        <AccordionSection title="Marcas">
          {BRANDS.map((l) => (
            <ColLink key={l.href} href={l.href}>
              {l.label}
            </ColLink>
          ))}
        </AccordionSection>
        <AccordionSection title="Políticas">
          {POLICIES.map((l) => (
            <ColLink key={l.href} href={l.href}>
              {l.label}
            </ColLink>
          ))}
        </AccordionSection>
        <AccordionSection title="Ajuda e contacto">
          {HELP.map((l) => (
            <ColLink key={l.href} href={l.href}>
              {l.label}
            </ColLink>
          ))}
          <p className="text-footer-link text-xs leading-relaxed mt-3">
            A nossa equipa de apoio ao cliente está disponível de segunda a
            sábado, das 8h às 18h.
          </p>
        </AccordionSection>

        {/* Mobile socials — icon-only row */}
        <div className="py-5">
          <p className="text-white font-semibold text-sm mb-4">Segue-nos</p>
          <div className="flex items-center gap-5">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-footer-link hover:text-white transition-colors duration-150"
              >
                <Icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Payment logos ──────────────────────────────────── */}
      <div className="container-web">
        <div className="py-6 flex justify-start md:justify-end items-center gap-6 md:gap-8">
          {PAYMENT_LOGOS.map(({ src, alt }) => (
            <img
              key={alt}
              src={src}
              alt={alt}
              className="h-6 w-auto object-contain"
            />
          ))}
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────── */}
      <div className="container-web">
        <div className="py-6 flex flex-col items-start md:items-end justify-end gap-4">
          <div className="flex items-center gap-2.5">
            <span className="font-black text-[22px] tracking-[0.08em] text-white uppercase font-figtree">
              SUANEE
            </span>
          </div>
          <p className="text-footer-caption text-xs leading-relaxed md:text-right">
            © Copyright Foschini Retail Group (Pty) Ltd. All rights reserved.
            <br />
            Foschini Retail Group (Pty) Ltd is a registered credit provider
            NCRCP36 and authorised financial services provider FSP 32719.
          </p>
        </div>
      </div>
    </footer>
  );
}
