// Diagnostica 10/11 (5): contoGiusto sul box del builder letterale.
import { verificaPerSostituzione } from "../server/costruisci";

const op = "2 \\cdot \\sqrt{\\left(12 \\cdot x^{2}\\right)}";
const an = "4x\\sqrt{3}";
console.log("sostituzione:", JSON.stringify(verificaPerSostituzione(op, an)));
console.log("op senza spazi comando-preservati:", op.replace(/(?<!\\[a-zA-Z])\s+/g, ""));

