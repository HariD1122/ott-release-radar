// Manual collection from the terminal: npm run collect
import { runCollection } from "../src/lib/collect";

const r = await runCollection();
console.log(JSON.stringify(r, null, 2));
