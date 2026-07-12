
  import { createRoot } from "react-dom/client";
  import { BrowserRouter } from "react-router";
  import { AuthProvider } from "./context/AuthContext";
  import { ThemeProvider } from "./context/ThemeContext";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Apply the persisted theme before first paint to avoid a flash of the wrong theme.
  const storedTheme = localStorage.getItem("transitops-theme");
  const initialTheme = storedTheme === "light" ? "light" : "dark";
  document.documentElement.classList.toggle("dark", initialTheme === "dark");
  document.documentElement.setAttribute("data-theme", initialTheme);

  createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
