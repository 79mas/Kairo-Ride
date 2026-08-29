import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import KairoApp from "@/components/kairo/app";
import "./globals.css";

const root=document.getElementById("root");
if(!root)throw new Error("Nerastas Kairo Ride langas.");
createRoot(root).render(<StrictMode><KairoApp/></StrictMode>);
