import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { FavoritesDrawer } from "@/components/FavoritesDrawer";
import { OrdersDrawer } from "@/components/OrdersDrawer";
import { SearchOverlay } from "@/components/SearchOverlay";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-nav container-web">
        {children}
      </main>
      <Footer />
      <SearchOverlay />
      <CartDrawer />
      <FavoritesDrawer />
      <OrdersDrawer />
    </>
  );
}
