/** Caso minimo del blocco: contoGiusto su \sqrt[-2]{\dfrac{1}{90}} (argv 1,2). */
import { contoGiusto } from "./server/costruisci";

const op = process.argv[2] ?? "\\sqrt[-2]{\\dfrac{1}{90}}";
const answer = process.argv[3] ?? "3\\sqrt{10}";
console.log("op:", op);
console.log("answer:", answer);
const t0 = Date.now();
const esito = contoGiusto(op, answer);
console.log("esito:", JSON.stringify(esito), "in", Date.now() - t0, "ms");
