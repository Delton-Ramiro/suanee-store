import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { FavoritesDrawer } from "@/components/FavoritesDrawer";
import { OrdersDrawer } from "@/components/OrdersDrawer";
import { SearchOverlay } from "@/components/SearchOverlay";
import { LoginModal } from "@/components/LoginModal";
import { ClientChatPanel } from "@/components/ClientChatPanel";
import { ChatFab } from "@/components/ChatFab";
import SiteTopBar from "@/components/SiteTopBar";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div style={{ paddingTop: "calc(var(--spacing-nav) + var(--topbar-h, 0px))" }}>
        <SiteTopBar />
        <main className="min-h-screen container-web">
          {children}
        </main>
      </div>
      <Footer />
      <SearchOverlay />
      <LoginModal />
      <ClientChatPanel />
      <ChatFab />
      <CartDrawer />
      <FavoritesDrawer />
      <OrdersDrawer />
    </>
  );
}
