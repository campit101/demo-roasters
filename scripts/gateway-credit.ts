// Prints the team's Vercel AI Gateway credit balance (free monthly credit) and how much has been used.
// Usage: node scripts/gateway-credit.ts
import { oidcToken } from "./generate-photo.ts";

const r = await fetch("https://ai-gateway.vercel.sh/v1/credits", { headers: { authorization: `Bearer ${oidcToken()}` } });
if (!r.ok) throw new Error(`AI Gateway refused: ${r.status}`);
const { balance, total_used } = (await r.json()) as { balance: string; total_used: string };
console.log(`AI Gateway credit: $${Number(balance).toFixed(2)} left, $${Number(total_used).toFixed(2)} used`);
