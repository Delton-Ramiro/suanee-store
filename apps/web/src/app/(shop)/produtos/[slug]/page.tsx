export default function ProdutoDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <div className="container-web py-12">
      <p className="text-text-muted text-sm">
        Detalhe do produto — em construção
      </p>
    </div>
  );
}
