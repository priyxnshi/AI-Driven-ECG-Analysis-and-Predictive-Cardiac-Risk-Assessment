import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/ui/Sidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ECGenius — Clinical ECG Analysis",
  description:
    "Enterprise-grade ECG analysis platform. Upload ECG recordings for automated pattern detection, rhythm analysis, and clinical reporting. Supports 12-lead digital signals, scanned documents, and image files.",
  keywords: [
    "ECG analysis",
    "electrocardiogram",
    "clinical analysis",
    "cardiac monitoring",
    "sinus tachycardia",
    "atrial flutter",
    "heart rhythm",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans h-screen overflow-hidden">
        <div className="flex h-full w-full">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
