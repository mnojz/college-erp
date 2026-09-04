"use client";

import { SEMESTERS } from "@/app/lib/syllabi-shared";
import type { GroupedByDepartment } from "./SyllabusGroupedList";
import type { SyllabusDto } from "@/app/lib/syllabi-shared";
import { SyllabusAdminRow } from "./SyllabusAdminRow";

type Syllabus = SyllabusDto;

interface Props {
  groups: GroupedByDepartment[];
  onEdit: (s: Syllabus) => void;
  onDelete: (s: Syllabus) => void;
}

/** Renders the department → program → semester (1..8) grouped library. */
export function SyllabusGroupedView({ groups, onEdit, onDelete }: Props) {
  if (groups.length === 0) return null;

  return (
    <div className="syllabus-grouped">
      {groups.map((deptGroup) => (
        <div key={deptGroup.department} className="syllabus-dept">
          {/* Single-department mode: a lone banner is redundant noise. */}
          {groups.length > 1 && (
            <h3 className="syllabus-dept-name">{deptGroup.department}</h3>
          )}
          {deptGroup.programs.map((pg, pi) => {
            const progLabel = pg.program ? pg.program.label : "Department-wide";
            const hasAny = SEMESTERS.some(
              (sem) => (pg.bySemester.get(sem) ?? []).length > 0,
            );
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
                          <span className="syllabus-empty-sem">—</span>
                        ) : (
                          <div className="syllabus-list">
                            {items.map((s) => (
                              <SyllabusAdminRow
                                key={s.id}
                                syllabus={s}
                                onEdit={() => onEdit(s)}
                                onDelete={() => onDelete(s)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!hasAny && pg.program ? (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      marginTop: 8,
                    }}
                  >
                    No syllabus for this program yet.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
