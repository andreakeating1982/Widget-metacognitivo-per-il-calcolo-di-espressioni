import { useState } from "react";
import { useEffect } from "react";
import { useLocation } from "wouter";

/** Formatta la data di oggi in formato italiano gg/mm/aaaa */
function getOggi(): string {
  const oggi = new Date();
  const gg = String(oggi.getDate()).padStart(2, "0");
  const mm = String(oggi.getMonth() + 1).padStart(2, "0");
  const aaaa = oggi.getFullYear();
  return `${gg}/${mm}/${aaaa}`;
}

export default function WelcomePage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    /* Vista autonoma (fuori dall'iframe del blog): la pagina deve "terminare"
       subito sotto la card come le altre app del blog dentro la cornice.
       Aggiunge la classe lf-welcome-top su <html> che rende neutro (bianco)
       il canvas sotto il contenuto, così sparisce il grande vuoto crema sotto
       la card. Dentro la cornice (iframe) NON viene aggiunta: lì è il
       heightSync a segnalare l'altezza reale del contenuto e la cornice
       dinamica si restringe da sola. */
    if (window.self === window.top) {
      document.documentElement.classList.add("lf-welcome-top");
      return () => document.documentElement.classList.remove("lf-welcome-top");
    }
  }, []);

  const [cognome, setCognome] = useState("");
  const [nome, setNome] = useState("");
  const [data, setData] = useState(getOggi());
  const [classe, setClasse] = useState("");

  /* (26/10, richiesta utente): dopo i dati, lo studente va DIRETTAMENTE
     alla pagina dove trascrive l'espressione intera (a mano, a voce, da
     tastiera); da lì l'IA costruisce lo svolgimento su misura. Il vecchio
     pulsante docente e la rotta verso /esercizio diretto sono rimossi. */
  const entra = () => {
    const params = new URLSearchParams();
    if (cognome.trim()) params.set("cognome", cognome.trim());
    if (nome.trim()) params.set("nome", nome.trim());
    if (data.trim()) params.set("data", data.trim());
    if (classe.trim()) params.set("classe", classe.trim());
    const q = params.toString();
    navigate(q ? `/espressione?${q}` : "/espressione");
  };

  return (
    <div className="lf-welcome flex flex-col items-center bg-background px-4 pb-8 sm:pb-12">
      {/* Layout compatto come le altre prime pagine: la card sta subito sotto la
          barra di accessibilità, con un piccolo respiro sopra e sotto, e la
          pagina termina subito dopo la card (niente più grande spazio vuoto
          sotto, né in pagina né dentro l'iframe) */}
      <div className="flex w-full flex-col items-center pt-4 sm:pt-8">
      <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-[20px] p-5 md:p-6 w-full max-w-[400px] shadow-[0_8px_25px_rgba(43,36,33,0.06)] flex flex-col items-center text-center">
        {/* Book icon — identico a Mappa Concettuale */}
        <div className="bg-[#F0E5DF] p-2.5 rounded-[12px] mb-3">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8B3A1A"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <line x1="12" y1="6" x2="12" y2="18" />
          </svg>
        </div>

        {/* Main heading — GIRO 33: nuovo nome dell'app */}
        <h2 className="text-base font-bold text-foreground tracking-wide mb-1">
          WIDGET METACOGNITIVO<br />PER IL CALCOLO<br />DI ESPRESSIONI
        </h2>
        <p className="text-[11px] text-muted-foreground mb-4 tracking-wide">
          RISOLVI L'ESPRESSIONE{" "}
          <span style={{ color: "#8B3A1A", fontWeight: 600 }}>PASSO DOPO PASSO</span>
        </p>

        {/* Name inputs */}
        <div className="grid grid-cols-2 gap-2 w-full mb-2">
          <input
            value={cognome}
            onChange={(e) => setCognome(e.target.value)}
            placeholder="Cognome"
            aria-label="Cognome"
            className="flex-1 bg-[#FAF8F5] border border-[#D6CEC4] rounded-[10px] px-3 py-2.5 text-sm text-foreground placeholder:text-[#8C827A] outline-none text-center font-[OpenDyslexic,Cambria,Georgia,serif] focus:border-[#D4B2A0] focus:ring-2 focus:ring-[#D4B2A0]/20 transition-all"
          />
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome"
            aria-label="Nome"
            className="flex-1 bg-[#FAF8F5] border border-[#D6CEC4] rounded-[10px] px-3 py-2.5 text-sm text-foreground placeholder:text-[#8C827A] outline-none text-center font-[OpenDyslexic,Cambria,Georgia,serif] focus:border-[#D4B2A0] focus:ring-2 focus:ring-[#D4B2A0]/20 transition-all"
          />
        </div>

        {/* Data e Classe */}
        <div className="grid grid-cols-2 gap-2 w-full mb-2">
          <input
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder="Data (es. 31/07/2026)"
            aria-label="Data"
            className="flex-1 bg-[#FAF8F5] border border-[#D6CEC4] rounded-[10px] px-3 py-2.5 text-sm text-foreground placeholder:text-[#8C827A] outline-none text-center font-[OpenDyslexic,Cambria,Georgia,serif] focus:border-[#D4B2A0] focus:ring-2 focus:ring-[#D4B2A0]/20 transition-all"
          />
          <input
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            placeholder="Classe (es. 2A)"
            aria-label="Classe"
            className="flex-1 bg-[#FAF8F5] border border-[#D6CEC4] rounded-[10px] px-3 py-2.5 text-sm text-foreground placeholder:text-[#8C827A] outline-none text-center font-[OpenDyslexic,Cambria,Georgia,serif] focus:border-[#D4B2A0] focus:ring-2 focus:ring-[#D4B2A0]/20 transition-all"
          />
        </div>

        {/* ENTRA button */}
        <button
          onClick={entra}
          disabled={!nome.trim() || !cognome.trim()}
          className="w-full py-2.5 rounded-[10px] text-sm font-bold tracking-wider transition-all duration-200"
          style={{
            backgroundColor: "#B8846A",
            color: "#FFFFFF",
            opacity: nome.trim() && cognome.trim() ? 1 : 0.55,
          }}
        >
          ENTRA
        </button>

      </div>
      </div>
    </div>
  );
}
