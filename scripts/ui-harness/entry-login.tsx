import { createRoot } from "react-dom/client";
import LoginPage from "../../src/app/login/page";
import "../../src/app/ui.css";
import "../../src/app/globals.css";
createRoot(document.getElementById("root")!).render(<main><LoginPage /></main>);
