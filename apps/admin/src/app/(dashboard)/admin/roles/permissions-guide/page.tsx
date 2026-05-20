"use client";

import { useState } from "react";
import {
  ChevronDown,
  ShieldCheck,
  BookOpen,
  Layers,
  Users,
  Package,
  BarChart2,
  MessageCircle,
  Settings,
  Lock,
  Lightbulb,
  Copy,
  Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { canManageAuthority } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Data ────────────────────────────────────────────────────────────────── */

const PERMISSIONS_TABLE = [
  {
    bit: 1,
    nome: "DASHBOARD_VIEW",
    area: "Dashboard",
    descricao:
      "Ver o painel principal com estatísticas gerais de vendas, encomendas e utilizadores.",
  },
  {
    bit: 2,
    nome: "ORDERS_VIEW",
    area: "Encomendas",
    descricao:
      "Consultar a lista de encomendas e os detalhes de cada uma (cliente, produtos, valores, estado).",
  },
  {
    bit: 4,
    nome: "ORDERS_EDIT",
    area: "Encomendas",
    descricao:
      "Actualizar o estado das encomendas (ex: pendente → pago → em trânsito), editar itens e alterar custos de envio.",
  },
  {
    bit: 8,
    nome: "CLIENTS_VIEW",
    area: "Clientes",
    descricao:
      "Ver a lista de clientes e os perfis individuais (compras, dados de contacto).",
  },
  {
    bit: 16,
    nome: "PRODUCTS_VIEW",
    area: "Produtos",
    descricao:
      "Consultar a lista de produtos e os seus detalhes (preços, variantes, imagens).",
  },
  {
    bit: 32,
    nome: "PRODUCTS_CREATE",
    area: "Produtos",
    descricao:
      "Criar novos produtos do zero, incluindo variantes, imagens e preços.",
  },
  {
    bit: 64,
    nome: "PRODUCTS_EDIT",
    area: "Produtos",
    descricao:
      "Editar produtos existentes: nome, descrição, preços, variantes, concorrentes, etc.",
  },
  {
    bit: 128,
    nome: "CATEGORIES_EDIT",
    area: "Estrutura",
    descricao:
      "Criar, editar e organizar categorias de produtos (nível 0, 1 e 2).",
  },
  {
    bit: 256,
    nome: "BRANDS_EDIT",
    area: "Estrutura",
    descricao: "Gerir marcas: criar, editar, associar categorias permitidas.",
  },
  {
    bit: 512,
    nome: "FILTERS_EDIT",
    area: "Estrutura",
    descricao: "Criar e editar filtros de pesquisa usados no catálogo.",
  },
  {
    bit: 1024,
    nome: "SIZES_EDIT",
    area: "Estrutura",
    descricao:
      "Gerir tamanhos disponíveis para produtos (ex: XS, S, M, L, 38, 40…).",
  },
  {
    bit: 2048,
    nome: "COLORS_EDIT",
    area: "Estrutura",
    descricao:
      "Gerir cores disponíveis para variantes de produtos, incluindo o código hex.",
  },
  {
    bit: 4096,
    nome: "COLLECTIONS_EDIT",
    area: "Estrutura",
    descricao:
      "Criar e editar coleções de produtos (agrupamentos temáticos ou sazonais).",
  },
  {
    bit: 8192,
    nome: "STORIES_EDIT",
    area: "Estrutura",
    descricao:
      "Publicar e gerir stories visuais que aparecem na aplicação móvel.",
  },
  {
    bit: 16384,
    nome: "MOST_SEARCHED_EDIT",
    area: "Estrutura",
    descricao:
      "Editar as sugestões de pesquisa em destaque que aparecem ao cliente.",
  },
  {
    bit: 32768,
    nome: "CURRENCY_EDIT",
    area: "Estrutura",
    descricao: "Actualizar as taxas de câmbio usadas nos preços apresentados.",
  },
  {
    bit: 65536,
    nome: "CHATS_VIEW",
    area: "Chats",
    descricao:
      "Ver e responder às conversas com clientes através do painel de chat.",
  },
  {
    bit: 131072,
    nome: "ANALYTICS_VIEW",
    area: "Análises",
    descricao:
      "Aceder às análises detalhadas de vendas, tráfego e comportamento.",
  },
  {
    bit: 262144,
    nome: "AUTHORITY_MANAGE",
    area: "Administração",
    descricao:
      "Criar e editar administradores, definir os seus perfis e permissões. Esta é a permissão mais sensível — atribua apenas a pessoas de máxima confiança.",
  },
];

const AREA_COLORS: Record<string, string> = {
  Dashboard: "bg-primary/10 text-primary",
  Encomendas: "bg-warning/10 text-warning",
  Clientes: "bg-accent/10 text-accent",
  Produtos: "bg-success/10 text-success",
  Estrutura: "bg-navy/10 text-navy",
  Chats: "bg-primary/10 text-primary",
  Análises: "bg-accent/10 text-accent",
  Administração: "bg-danger/10 text-danger",
};

const BUNDLE_EXAMPLES = [
  {
    nome: "Operador de Encomendas",
    emoji: "📦",
    descricao:
      "Pode ver e processar encomendas, consultar clientes e o dashboard.",
    permissoes: [
      "DASHBOARD_VIEW",
      "ORDERS_VIEW",
      "ORDERS_EDIT",
      "CLIENTS_VIEW",
    ],
    valor: 1 + 2 + 4 + 8,
  },
  {
    nome: "Gestor de Catálogo",
    emoji: "🛍️",
    descricao:
      "Pode gerir produtos, categorias, marcas e toda a estrutura do catálogo.",
    permissoes: [
      "DASHBOARD_VIEW",
      "PRODUCTS_VIEW",
      "PRODUCTS_CREATE",
      "PRODUCTS_EDIT",
      "CATEGORIES_EDIT",
      "BRANDS_EDIT",
      "COLLECTIONS_EDIT",
      "FILTERS_EDIT",
      "SIZES_EDIT",
      "COLORS_EDIT",
    ],
    valor: 1 + 16 + 32 + 64 + 128 + 256 + 4096 + 512 + 1024 + 2048,
  },
  {
    nome: "Gestor de Conteúdo",
    emoji: "✏️",
    descricao: "Responsável pelos stories, pesquisas em destaque e câmbio.",
    permissoes: [
      "DASHBOARD_VIEW",
      "STORIES_EDIT",
      "MOST_SEARCHED_EDIT",
      "CURRENCY_EDIT",
    ],
    valor: 1 + 8192 + 16384 + 32768,
  },
  {
    nome: "Agente de Apoio ao Cliente",
    emoji: "💬",
    descricao: "Atende clientes via chat, consulta encomendas e perfis.",
    permissoes: ["DASHBOARD_VIEW", "CHATS_VIEW", "ORDERS_VIEW", "CLIENTS_VIEW"],
    valor: 1 + 65536 + 2 + 8,
  },
  {
    nome: "Analista",
    emoji: "📊",
    descricao: "Só pode ver dashboards e análises, sem fazer alterações.",
    permissoes: ["DASHBOARD_VIEW", "ANALYTICS_VIEW"],
    valor: 1 + 131072,
  },
];

/* ── Components ──────────────────────────────────────────────────────────── */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 border-b border-border-light pb-3">
        <span className="text-primary">{icon}</span>
        <h2 className="text-[18px] font-bold text-text-dark font-lato">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Callout({
  type,
  children,
}: {
  type: "info" | "warning" | "tip";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-accent/5 border-accent/30 text-accent",
    warning: "bg-danger/5 border-danger/30 text-danger",
    tip: "bg-success/5 border-success/30 text-success",
  };
  const icons = {
    info: <BookOpen size={15} />,
    warning: <Lock size={15} />,
    tip: <Lightbulb size={15} />,
  };
  return (
    <div className={`flex gap-2.5 border rounded-lg px-4 py-3 ${styles[type]}`}>
      <span className="shrink-0 mt-0.5">{icons[type]}</span>
      <p className="text-s font-figtree leading-relaxed">{children}</p>
    </div>
  );
}

function BundleCard({ bundle }: { bundle: (typeof BUNDLE_EXAMPLES)[number] }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  function copy() {
    navigator.clipboard.writeText(String(bundle.valor));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-card border border-border-light rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-hover transition-colors"
      >
        <span className="text-2xl shrink-0">{bundle.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-text-dark font-lato text-[15px]">
            {bundle.nome}
          </p>
          <p className="text-s text-text-muted font-figtree truncate">
            {bundle.descricao}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-navy/8 px-3 py-1 rounded-full">
            <span className="text-[12px] font-bold font-inter text-navy">
              {bundle.valor}
            </span>
          </div>
          <ChevronDown
            size={16}
            className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border-light px-5 py-4 flex flex-col gap-3 bg-bg">
          <div className="flex flex-wrap gap-1.5">
            {bundle.permissoes.map((p) => (
              <span
                key={p}
                className="px-2 py-0.5 rounded-md bg-navy/8 text-navy text-xxs font-inter font-medium"
              >
                {p}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between bg-card border border-border-light rounded-lg px-4 py-2.5">
            <div>
              <p className="text-xxs text-text-muted font-figtree uppercase tracking-wide mb-0.5">
                Valor a inserir no campo "Permissões"
              </p>
              <p className="text-[22px] font-bold text-primary font-inter">
                {bundle.valor}
              </p>
            </div>
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-navy text-white text-[12px] font-lato font-semibold hover:bg-primary transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function PermissionsGuidePage() {
  const { user } = useAuth();
  const allowAuthorityManagement = canManageAuthority(user);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const areas = [...new Set(PERMISSIONS_TABLE.map((p) => p.area))];
  const filtered = activeArea
    ? PERMISSIONS_TABLE.filter((p) => p.area === activeArea)
    : PERMISSIONS_TABLE;

  if (!allowAuthorityManagement) {
    return (
      <AccessDeniedState message="A sua role não pode aceder ao guia de permissões." />
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-10 pb-16">
      {/* Hero */}
      <div className="bg-card border border-border-light rounded-2xl px-8 py-8 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center shrink-0">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-[22px] font-black text-text-dark font-lato leading-tight">
              Guia de Permissões — Suanee Admin
            </h1>
            <p className="text-s text-text-muted font-figtree mt-0.5">
              Como criar, combinar e atribuir permissões a administradores
            </p>
          </div>
        </div>
      </div>

      {/* 1. O que são permissões */}
      <Section icon={<BookOpen size={18} />} title="1. O que são permissões?">
        <p className="text-s text-text-body font-figtree leading-relaxed">
          Cada administrador tem um conjunto de permissões que define
          exactamente o que pode fazer no painel. As permissões são
          independentes umas das outras — pode dar acesso a encomendas sem dar
          acesso a produtos, por exemplo.
        </p>
        <p className="text-s text-text-body font-figtree leading-relaxed">
          Internamente, cada permissão é um número (potência de 2). O sistema
          soma os números das permissões que quer atribuir e guarda o total. A
          esse total chamamos{" "}
          <strong className="text-text-dark">bitmask</strong>.
        </p>
        <Callout type="tip">
          Não precisa de perceber como funciona por dentro. Basta seguir os
          exemplos neste guia — indicamos sempre o valor final a inserir.
        </Callout>
      </Section>

      {/* 2. Lista completa */}
      <Section
        icon={<Layers size={18} />}
        title="2. Lista completa de permissões"
      >
        <p className="text-s text-text-body font-figtree leading-relaxed">
          Estas são todas as permissões disponíveis. Cada uma controla uma área
          específica do painel.
        </p>

        {/* Area filter */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveArea(null)}
            className={`h-7 px-3 rounded-full text-[12px] font-lato font-medium transition-colors border ${
              activeArea === null
                ? "bg-navy text-white border-navy"
                : "bg-card text-text-muted border-border-light hover:bg-surface-hover"
            }`}
          >
            Todas
          </button>
          {areas.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setActiveArea(activeArea === a ? null : a)}
              className={`h-7 px-3 rounded-full text-[12px] font-lato font-medium transition-colors border ${
                activeArea === a
                  ? "bg-navy text-white border-navy"
                  : "bg-card text-text-muted border-border-light hover:bg-surface-hover"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border-light">
          <table className="w-full border-collapse text-s font-figtree">
            <thead>
              <tr className="bg-navy">
                <th className="px-4 py-3 text-left text-[12px] font-medium text-white font-figtree first:rounded-l-lg">
                  Valor
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium text-white font-figtree">
                  Permissão
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium text-white font-figtree">
                  Área
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium text-white font-figtree last:rounded-r-lg">
                  O que permite fazer
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.nome}
                  className={`border-b border-border-light last:border-b-0 ${i % 2 === 1 ? "bg-bg" : "bg-card"}`}
                >
                  <td className="px-4 py-3 font-inter font-bold text-primary text-[13px]">
                    {p.bit}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xxs bg-navy/8 text-navy px-2 py-0.5 rounded-md font-inter">
                      {p.nome}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-semibold font-lato px-2 py-0.5 rounded-full ${AREA_COLORS[p.area]}`}
                    >
                      {p.area}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-body leading-relaxed">
                    {p.descricao}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 3. Como calcular o valor */}
      <Section
        icon={<Settings size={18} />}
        title="3. Como calcular o valor a inserir"
      >
        <p className="text-s text-text-body font-figtree leading-relaxed">
          Para atribuir várias permissões a um administrador,{" "}
          <strong className="text-text-dark">some os valores</strong> de cada
          permissão que quer dar. O resultado é o número que vai inserir no
          campo <em>"Permissões"</em> ao criar ou editar um administrador.
        </p>

        <div className="bg-card border border-border-light rounded-xl p-5 flex flex-col gap-3">
          <p className="text-s font-semibold text-text-dark font-lato">
            Exemplo prático:
          </p>
          <div className="flex flex-col gap-2 text-s font-figtree">
            <div className="flex items-center justify-between py-1.5 border-b border-border-light">
              <span className="text-text-body">DASHBOARD_VIEW</span>
              <span className="font-inter font-bold text-primary">1</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-light">
              <span className="text-text-body">ORDERS_VIEW</span>
              <span className="font-inter font-bold text-primary">2</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-light">
              <span className="text-text-body">ORDERS_EDIT</span>
              <span className="font-inter font-bold text-primary">4</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-light">
              <span className="text-text-body">CLIENTS_VIEW</span>
              <span className="font-inter font-bold text-primary">8</span>
            </div>
            <div className="flex items-center justify-between py-2 mt-1">
              <span className="font-bold text-text-dark font-lato">
                Total a inserir
              </span>
              <span className="text-[22px] font-black font-inter text-primary">
                15
              </span>
            </div>
          </div>
        </div>

        <Callout type="warning">
          Se quiser dar <strong>todas as permissões</strong> a um administrador
          (acesso total), insira o valor <strong>524287</strong>. Reserve este
          acesso apenas para o administrador principal.
        </Callout>

        <Callout type="info">
          Sempre que quiser acrescentar ou remover uma permissão a um
          administrador existente, peça ao developer para actualizar o valor. Um
          simples recalculo soma/subtrai os bits necessários.
        </Callout>
      </Section>

      {/* 4. Como pensar os perfis */}
      <Section
        icon={<Users size={18} />}
        title="4. Como pensar os perfis de acesso"
      >
        <p className="text-s text-text-body font-figtree leading-relaxed">
          A melhor abordagem é pensar no{" "}
          <strong className="text-text-dark">papel (role)</strong> de cada
          pessoa antes de escolher permissões individuais. Faça-se esta
          pergunta:
        </p>
        <blockquote className="border-l-4 border-accent pl-4 italic text-text-body font-figtree text-s leading-relaxed">
          "O que é que esta pessoa vai fazer no dia-a-dia? Quais são as páginas
          que ela precisa de abrir para fazer o seu trabalho?"
        </blockquote>
        <p className="text-s text-text-body font-figtree leading-relaxed">
          Depois, escolha apenas as permissões necessárias para esse trabalho —
          não dê mais do que o necessário. Isto protege os dados e reduz o risco
          de erros acidentais.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              icon: <Package size={15} />,
              title: "Pensa em funções, não em pessoas",
              body: "Crie perfis por função: 'Operador de Encomendas', 'Gestor de Catálogo', etc. A mesma pessoa pode ter vários perfis combinados.",
            },
            {
              icon: <ShieldCheck size={15} />,
              title: "Princípio do mínimo privilégio",
              body: "Dê sempre o mínimo de acesso necessário para a função. Se a pessoa não precisa de editar produtos, não lhe dê PRODUCTS_EDIT.",
            },
            {
              icon: <BarChart2 size={15} />,
              title: "Separe leitura de escrita",
              body: "VIEW permite consultar; EDIT/CREATE permite alterar. Um supervisor pode ter VIEW sem ter EDIT.",
            },
            {
              icon: <Lock size={15} />,
              title: "AUTHORITY_MANAGE é especial",
              body: "Quem tem AUTHORITY_MANAGE pode criar outros administradores com qualquer permissão. Atribua apenas ao dono ou responsável máximo.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="bg-card border border-border-light rounded-xl px-4 py-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 text-navy">
                {card.icon}
                <p className="font-bold text-text-dark font-lato text-[14px]">
                  {card.title}
                </p>
              </div>
              <p className="text-s text-text-body font-figtree leading-relaxed">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* 5. Exemplos de perfis prontos */}
      <Section
        icon={<Package size={18} />}
        title="5. Perfis prontos — valores para copiar"
      >
        <p className="text-s text-text-body font-figtree leading-relaxed">
          Abaixo estão perfis típicos já calculados. Clique em cada um para ver
          as permissões incluídas e copiar o valor a inserir no sistema.
        </p>
        <div className="flex flex-col gap-3">
          {BUNDLE_EXAMPLES.map((b) => (
            <BundleCard key={b.nome} bundle={b} />
          ))}
        </div>
        <Callout type="tip">
          Pode combinar perfis: se uma pessoa é Operador de Encomendas{" "}
          <strong>e</strong> Agente de Chat, some os dois valores (removendo
          duplicados). O developer pode fazer esse cálculo por si.
        </Callout>
      </Section>

      {/* 6. O que devo enviar ao developer */}
      <Section
        icon={<MessageCircle size={18} />}
        title="6. O que devo enviar ao developer?"
      >
        <p className="text-s text-text-body font-figtree leading-relaxed">
          Quando quiser criar ou actualizar um administrador, envie uma mensagem
          com este formato:
        </p>
        <div className="bg-bg border border-border-light rounded-xl p-5">
          <pre className="text-s font-inter text-text-dark whitespace-pre-wrap leading-relaxed">{`Nome: Maria Silva
Email: maria@suanee.co.mz
Função: Operadora de Encomendas + Agente de Chat
Permissões pretendidas:
  - Ver dashboard
  - Ver e editar encomendas
  - Ver clientes
  - Ver chats

→ Valor a usar: 65547`}</pre>
        </div>
        <p className="text-s text-text-body font-figtree leading-relaxed">
          Com esta informação, o developer cria o administrador com exactamente
          as permissões certas e envia-lhe a palavra-passe inicial.
        </p>
        <Callout type="info">
          Se não tiver a certeza do valor, basta indicar as permissões em
          linguagem natural (como no exemplo acima) — o developer calcula o
          número por si.
        </Callout>
      </Section>
    </div>
  );
}
