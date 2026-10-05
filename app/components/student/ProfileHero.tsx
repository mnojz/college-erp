import { IconCalendar, IconPencil, IconSchool } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ProfileHeroProps = {
  name: string;
  email: string;
  status: string;
  program: string;
  department: string;
  admissionNo: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  onEdit?: () => void;
};

export function ProfileHero({
  name,
  email,
  status,
  program,
  department,
  admissionNo,
  rollNumber,
  profileImageUrl,
  onEdit,
}: ProfileHeroProps) {
  const studentId = rollNumber || admissionNo;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST";
  const active = status.toUpperCase() === "ACTIVE";

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        {/* Rounded square (not a circle) so it matches the teacher overview hero. */}
        <Avatar className="size-20 rounded-xl after:rounded-xl sm:size-24">
          {profileImageUrl ? (
            <AvatarImage src={profileImageUrl} alt={name} className="rounded-xl" />
          ) : null}
          <AvatarFallback className="rounded-xl bg-linear-to-br from-primary/85 to-primary text-xl font-semibold text-primary-foreground sm:text-2xl">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{name}</h1>
            <Badge variant={active ? "default" : "secondary"} className="gap-1.5">
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              {status}
            </Badge>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <IconSchool size={14} aria-hidden="true" />
              {department || "Department not assigned"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconCalendar size={14} aria-hidden="true" />
              {program || "Program not assigned"}
            </span>
          </div>

          <p className="mt-2 text-sm break-words">
            Registration Number: <strong>{admissionNo}</strong>{" "}
            <span className="text-muted-foreground">{email}</span>
          </p>
          <p className="text-sm text-muted-foreground">Student ID: {studentId}</p>
        </div>

        {onEdit && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5 sm:mt-0" onClick={onEdit}>
            <IconPencil size={15} aria-hidden="true" />
            Edit Profile
          </Button>
        )}
      </div>
    </Card>
  );
}
