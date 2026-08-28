"use client";

import { SEMESTERS } from "@/app/lib/syllabi-shared";
import type { GroupedByDepartment } from "./SyllabusGroupedList";
import { SyllabusPublicRow } from "./SyllabusPublicRow";

interface Props {
  groups: GroupedByDepartment[];
}

/** Renders the department → program → semester (1..8) grouped library for students. */
export function SyllabusPublicGroupedView({ groups }: Props) {
  if (groups.length === 0) return null;

  return (
    <div className="syllabus-grouped">
      {groups.map((deptGroup) => (
        <div key={deptGroup.department} className="syllabus-dept">
          <h3 className="syllabus-dept-name">{deptGroup.department}</h3>
          {deptGroup.programs.map((pg, pi) => {
            const progLabel = pg.program ? pg.program.label : "Department-wide";
            return (
              <div
                key={`${pg.program?.id ?? "__none__"}${pi}`}
                className="syllabus-program"
              >
                <h4 className="syllabus-program-name">{progLabel}</h4>
                <div className="syllabus-program-semesters">
                  {SEMESTERS.map((sem) => {
                    const items = pg.bySemester.get(sem) ?? [];
                    return (
                      <div key={sem} className="syllabus-semester-slot">
                        <span className="syllabus-sem-label">Sem {sem}</span>
                        {items.length === 0 ? (
                          <span className="syllabus-empty-sem">No syllabus</span>
                        ) : (
                          <div className="syllabus-list">
                            {items.map((s) => (
                              <SyllabusPublicRow key={s.id} syllabus={s} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

