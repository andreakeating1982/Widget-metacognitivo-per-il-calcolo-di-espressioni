import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useRoute } from "wouter";
import { useLayoutEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { AccessibilityToolbar } from "./components/AccessibilityToolbar";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AccessibilityProvider } from "./contexts/AccessibilityContext";
import EsercizioFrazioni from "./pages/EsercizioFrazioni";
import EspressioniExercises from "./pages/EspressioniExercises";
import WelcomePage from "./pages/WelcomePage";


function Router() {
  return (
    <Switch>
      <Route path={"/"} component={WelcomePage} />
      <Route path={"/esercizio"} component={EsercizioFrazioni} />
      <Route path={"/espressione"} component={EspressioniExercises} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  const [isExpressionInput] = useRoute("/espressione");
  const [isExercise] = useRoute("/esercizio");
  const hasCompactFrame = isExpressionInput || isExercise;

  // Seconda e terza pagina hanno un'altezza delimitata. Nella pagina autonoma
  // seguiamo anche la tastiera mobile; in iframe NON usiamo il suo viewport
  // (che è ridimensionato dalla cornice e creerebbe un feedback di altezza).
  useLayoutEffect(() => {
    if (!hasCompactFrame || window.self !== window.top) return;
    const root = document.documentElement;
    const visual = window.visualViewport;
    const update = () => root.style.setProperty(
      "--expr-visible-height", `${Math.floor(visual?.height ?? window.innerHeight)}px`
    );
    update();
    visual?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      visual?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      root.style.removeProperty("--expr-visible-height");
    };
  }, [hasCompactFrame]);

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <AccessibilityProvider>
            <Toaster />
            <div className={isExpressionInput ? "expr-input-frame" : isExercise ? "expr-exercise-frame" : undefined}>
              <AccessibilityToolbar />
              <Router />
            </div>
          </AccessibilityProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
