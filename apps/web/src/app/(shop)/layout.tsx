import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {/* pt-[98px] = header height so content is never behind the fixed nav */}
      <main className="min-h-screen pt-[var(--spacing-nav)] container-web bg-bg">
        {children}
      </main>
      <Footer />
    </>
  );
}
