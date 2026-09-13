import assert from "node:assert/strict";
import { reportRangeFor, startOfWeekMonday, ymd } from "../src/lib/report-period";

const wed = new Date(2026, 8, 16); // quarta 16/09/2026
assert.equal(ymd(wed), "2026-09-16");
assert.equal(ymd(startOfWeekMonday(wed)), "2026-09-14");
assert.deepEqual(reportRangeFor("hoje", wed), { from: "2026-09-16", to: "2026-09-16" });
assert.deepEqual(reportRangeFor("semana", wed), { from: "2026-09-14", to: "2026-09-16" });
assert.deepEqual(reportRangeFor("mes", wed), { from: "2026-09-01", to: "2026-09-16" });
assert.deepEqual(reportRangeFor("mes_passado", wed), { from: "2026-08-01", to: "2026-08-31" });
assert.deepEqual(reportRangeFor("ano", wed), { from: "2026-01-01", to: "2026-09-16" });

const sun = new Date(2026, 8, 13);
assert.equal(ymd(startOfWeekMonday(sun)), "2026-09-07");

console.log("relatorio-period ok");
