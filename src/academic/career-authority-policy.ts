export type CareerAuthorityScope = {
  programId: string;
  modalityId: string;
};

export type CareerAuthorityAssignmentLike = CareerAuthorityScope & {
  active?: boolean;
};

export function careerAuthorityScopeKey(scope: CareerAuthorityScope) {
  return `${scope.programId}:${scope.modalityId}`;
}

export function sameCareerAuthorityScope(
  left: CareerAuthorityScope,
  right: CareerAuthorityScope,
) {
  return left.programId === right.programId && left.modalityId === right.modalityId;
}

export function activeCareerAuthorityScopeWhere(scope: CareerAuthorityScope) {
  return {
    programId: scope.programId,
    modalityId: scope.modalityId,
    active: true,
  } as const;
}

export function hasCareerAuthorityScope(
  assignments: CareerAuthorityAssignmentLike[],
  scope: CareerAuthorityScope,
) {
  return assignments.some((assignment) =>
    assignment.active !== false && sameCareerAuthorityScope(assignment, scope));
}
