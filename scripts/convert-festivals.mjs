// Parses Data/Upcoming_Major_Indian_Festivals_2026.xlsx → src/lib/db/data/festivals.json
// Run: node scripts/convert-festivals.mjs
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const SRC = "Data/Upcoming_Major_Indian_Festivals_2026.xlsx";
const OUT = "src/lib/db/data/festivals.json";

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

// "28/29 July 2026" | "16 July 2026" | "5-7 November 2026" → ISO of the first day.
function parseDate(s) {
  const m = String(s).match(/(\d{1,2})(?:\s*[/\-–]\s*\d{1,2})?\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = MONTHS[m[2].toLowerCase()];
  const yr = parseInt(m[3], 10);
  if (!mon || !day) return null;
  return `${yr}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function emojiFor(name) {
  const n = name.toLowerCase();
  const map = [
    [/diwali|deepavali/, "🪔"],
    [/holi/, "🎨"],
    [/ganesh|chaturthi/, "🐘"],
    [/krishna|janmashtami/, "🦚"],
    [/navratri|durga|dussehra|dasara|vijayadashami/, "🗡️"],
    [/onam/, "🚣"],
    [/raksha|rakhi/, "🧵"],
    [/eid/, "🌙"],
    [/christmas/, "🎄"],
    [/pongal|makar|sankranti/, "🪁"],
    [/rath\s*yatra|jagannath/, "🛕"],
    [/teej/, "🌿"],
    [/guru\s*purnima|purnima/, "🙏"],
    [/navroz|ugadi|gudi/, "🌸"],
    [/baisakhi|vaisakhi/, "🌾"],
    [/karva|karwa/, "🌕"],
    [/chhath/, "🌅"],
    [/mahashivratri|shivratri/, "🔱"],
    [/bihu/, "💃"],
    [/lohri/, "🔥"],
  ];
  for (const [re, e] of map) if (re.test(n)) return e;
  return "🎉";
}

const wb = XLSX.read(fs.readFileSync(SRC), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false, blankrows: false });

const out = [];
for (const r of rows) {
  const name = (r["Festival Name"] || "").toString().trim();
  if (!name) continue;
  const dateLabel = (r["2026 Date(s)"] || "").toString().trim();
  out.push({
    name,
    hub: (r["Where It Is Famous (Primary Hub)"] || "").toString().trim() || null,
    dateISO: parseDate(dateLabel),
    dateLabel,
    significance: (r["Cultural Significance"] || "").toString().trim() || null,
    emoji: emojiFor(name),
  });
}
out.sort((a, b) => (a.dateISO || "9999").localeCompare(b.dateISO || "9999"));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`festivals.json: ${out.length}`);
console.log(out.map((f) => `  ${f.emoji} ${f.name} — ${f.dateISO} (${f.hub})`).join("\n"));
