"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { SubjectManager } from "@/features/subjects/SubjectManager";

export default function SubjectsPage() {
  return (
    <ProtectedPage
      title="Matières"
      description="Gérez les matières enseignées et les formateurs qualifiés pour chacune."
      permission="subjects.manage"
    >
      {(profile) => <SubjectManager actor={profile} />}
    </ProtectedPage>
  );
}
