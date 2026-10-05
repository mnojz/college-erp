"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicSyllabusLibrary } from "@/app/components/public/PublicSyllabusLibrary";
import { CourseStructureViewer } from "@/app/components/public/CourseStructureViewer";
import { PublicCatalog } from "@/app/components/public/PublicCatalog";

const TABS = ["syllabus", "structure", "fees"] as const;
type Tab = (typeof TABS)[number];

/**
 * Read-only academic resources for teachers. Every panel is the SAME component
 * the public pages render, so there is a single source of truth and nothing
 * here can drift from the public site.
 */
export function TeacherResourcesTabs() {
  const params = useSearchParams();
  const requested = params.get("tab");
  const [tab, setTab] = useState<Tab>(
    TABS.includes(requested as Tab) ? (requested as Tab) : "syllabus",
  );

  return (
    <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)}>
      <TabsList>
        <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
        <TabsTrigger value="structure">Course Structure</TabsTrigger>
        <TabsTrigger value="fees">Fee Structure</TabsTrigger>
      </TabsList>

      <TabsContent value="syllabus" className="mt-5">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Syllabus Library</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Official syllabus outlines published by FWU departments.
        </p>
        <PublicSyllabusLibrary />
      </TabsContent>

      <TabsContent value="structure" className="mt-5">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Course Structure</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          The current course map, credit assignments and departmental structure.
        </p>
        <CourseStructureViewer />
      </TabsContent>

      <TabsContent value="fees" className="mt-5">
        <PublicCatalog
          kind="fees"
          eyebrow="Student finance"
          title="Fee Structure"
          description="Published programme and semester fee information."
        />
      </TabsContent>
    </Tabs>
  );
}
