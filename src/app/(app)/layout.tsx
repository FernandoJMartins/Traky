import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { BottomNav } from "@/components/shell/BottomNav";

// Layout das telas autenticadas. Guarda de sessão: sem usuário → /login.
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={{ name: user.name, email: user.email }} />
        <main className="flex-1 px-4 py-3 w-full mx-auto">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
