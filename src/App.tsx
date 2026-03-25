import { ThemeProvider } from "@/components/ThemeProvider";
import { AppRoutes } from "@/routes";
import { JSX } from "react";

function App(): JSX.Element {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppRoutes />
    </ThemeProvider>
  );
}

export default App;
