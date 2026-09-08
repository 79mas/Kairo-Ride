import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import KairoApp from "@/components/kairo/app";
import {LanguageProvider} from "@/lib/kairo/i18n";
import {AppErrorBoundary} from "@/components/kairo/error-boundary";
import "./globals.css";

const root=document.getElementById("root");
if(!root)throw new Error("Kairo Ride root element was not found.");
createRoot(root).render(<StrictMode><LanguageProvider><AppErrorBoundary><KairoApp/></AppErrorBoundary></LanguageProvider></StrictMode>);
