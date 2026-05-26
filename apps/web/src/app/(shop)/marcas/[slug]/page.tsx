export default function MarcaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <div className="container-web py-12">
      <p className="text-text-muted text-sm">Marca — em construção</p>
    </div>
  );
}
