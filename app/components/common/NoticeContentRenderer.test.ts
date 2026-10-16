import { describe, expect, it } from "vitest";
import { parseNoticeBody } from "./NoticeContentRenderer";

describe("parseNoticeBody", () => {
  it("parses single and multiple markdown tables correctly without leaking rows to raw text", () => {
    const notice = `
Announcement regarding upcoming exams.

| Day | Date | Subject |
|---|---|---|
| Mon | 2026-11-01 | CS101 - Intro to CS |
| Tue | 2026-11-02 | CS102 - Data Structures |
| Wed | 2026-11-03 | CS103 - Algorithms |

Please prepare your admit cards before entering the examination hall.

| Roll No Range | Room No |
|---|---|
| 01 - 30 | Hall A |
| 31 - 60 | Hall B |

Best of luck!
`;

    const parsed = parseNoticeBody(notice);
    expect(parsed.blocks.length).toBe(5);
    expect(parsed.blocks[0]).toEqual({
      type: "text",
      text: "Announcement regarding upcoming exams.",
    });
    expect(parsed.blocks[1].type).toBe("table");
    if (parsed.blocks[1].type === "table") {
      expect(parsed.blocks[1].table.headers).toEqual(["Day", "Date", "Subject"]);
      expect(parsed.blocks[1].table.rows.length).toBe(3);
      expect(parsed.blocks[1].table.isRoutine).toBe(true);
      expect(parsed.blocks[1].table.routineEntries?.length).toBe(3);
    }
    expect(parsed.blocks[2]).toEqual({
      type: "text",
      text: "Please prepare your admit cards before entering the examination hall.",
    });
    expect(parsed.blocks[3].type).toBe("table");
    if (parsed.blocks[3].type === "table") {
      expect(parsed.blocks[3].table.headers).toEqual(["Roll No Range", "Room No"]);
      expect(parsed.blocks[3].table.rows.length).toBe(2);
      expect(parsed.blocks[3].table.isRoutine).toBe(false);
    }
    expect(parsed.blocks[4]).toEqual({
      type: "text",
      text: "Best of luck!",
    });
  });

  it("handles tables with missing trailing pipes or trailing spaces gracefully", () => {
    const raw = `
| Code | Subject Name | Credits
| --- | --- | ---
| AR111 | Basic Design I | 4
| AR112 | Theory of Architecture | 3
`;
    const parsed = parseNoticeBody(raw);
    expect(parsed.blocks.length).toBe(1);
    expect(parsed.blocks[0].type).toBe("table");
    if (parsed.blocks[0].type === "table") {
      expect(parsed.blocks[0].table.headers).toEqual(["Code", "Subject Name", "Credits"]);
      expect(parsed.blocks[0].table.rows.length).toBe(2);
      expect(parsed.blocks[0].table.rows[0]).toEqual(["AR111", "Basic Design I", "4"]);
    }
  });
});
