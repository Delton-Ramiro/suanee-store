import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { FavoritesDrawer } from "@/components/FavoritesDrawer";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {/* pt-[98px] = header height so content is never behind the fixed nav */}
      <main className="min-h-screen pt-[var(--spacing-nav)] container-web">
        {children}
      </main>
      <Footer />
      <CartDrawer />
      <FavoritesDrawer />
    </>
  );
}
