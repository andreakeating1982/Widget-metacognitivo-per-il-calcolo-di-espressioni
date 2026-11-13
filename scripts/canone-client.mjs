// Riproduce ESATTAMENTE ciò che il client invia al server quando lo studente
// preme «COSTRUISCI L'ESERCIZIO CON L'IA» sulla trascrizione confermata.
import { normalizeKeyboardNotation } from "../client/src/lib/keyboardNotation";

const trascrizione =
  "(0,75x^-1√(ab^-1)-0,75x^-1√(ab^-1)+0,4_6per∛((a^-2b)⁄x)+0,1_6per∜(ab^-2)-0,1_6per∜(ab^-2))⁄(1,25x^-1√(ab^-1)-1,25x^-1√(ab^-1)+0,2_3per∛((a^-2b)⁄x)+0,3per⁻³√(ab^-1)-0,3per⁻³√(ab^-1))";
console.log(normalizeKeyboardNotation(trascrizione).trim());

