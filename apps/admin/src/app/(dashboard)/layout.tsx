import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import AuthGuard from "@/components/AuthGuard";
import { SidebarProvider } from "@/lib/sidebar-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-col flex-1 md:ml-[240px] min-w-0">
            <Header />
            <main className="mt-header p-4 md:p-8 flex flex-col flex-1 bg-bg min-h-[calc(100vh-72px)]">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
