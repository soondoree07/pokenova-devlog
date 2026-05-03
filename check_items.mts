import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const sql = neon(process.env.DATABASE_URL!);

// 메가스톤 관련 아이템 확인
const rows = await sql`
  SELECT ko, en, category FROM item_data
  WHERE ko LIKE '%나이트%' OR en LIKE '%ite' OR category LIKE '%mega%'
  ORDER BY ko
  LIMIT 40
`;
console.log("=== 메가스톤 아이템 ===");
rows.forEach((r: { ko: string; en: string; category: string }) => console.log(r.ko, "|", r.en, "|", r.category));
