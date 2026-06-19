import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { MultiAgentDeskSessionHost } from "@/components/multiAgent/MultiAgentDeskSessionHost";
import { Mt5ConnectionGate } from "@/components/workspace/Mt5ConnectionGate";
import { TradingWorkspaceProvider } from "@/components/workspace/TradingWorkspaceProvider";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ThinkTrade — AI Trading Control Center",
  description: "FastAPI + Next.js dashboard for the ThinkTrade engine.",
  icons: {
    icon: "/logo/logo.png",
    apple: "/logo/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TradingWorkspaceProvider>
          <Mt5ConnectionGate>
            <MultiAgentDeskSessionHost>
              <WorkspaceShell>{children}</WorkspaceShell>
            </MultiAgentDeskSessionHost>
          </Mt5ConnectionGate>
        </TradingWorkspaceProvider>
      </body>
    </html>
  );
}
