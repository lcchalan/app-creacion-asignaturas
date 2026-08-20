import assert from "node:assert/strict";
import test from "node:test";

import {
  activeCareerAuthorityScopeWhere,
  careerAuthorityScopeKey,
  hasCareerAuthorityScope,
  sameCareerAuthorityScope,
} from "../src/academic/career-authority-policy.js";

test("career authority scope distinguishes modalities of the same career", () => {
  const online = { programId: "program-a", modalityId: "online" };
  const onsite = { programId: "program-a", modalityId: "onsite" };

  assert.equal(careerAuthorityScopeKey(online), "program-a:online");
  assert.equal(sameCareerAuthorityScope(online, onsite), false);
  assert.equal(sameCareerAuthorityScope(online, { ...online }), true);
});

test("active authority where always includes career, modality and active flag", () => {
  assert.deepEqual(
    activeCareerAuthorityScopeWhere({ programId: "program-a", modalityId: "online" }),
    { programId: "program-a", modalityId: "online", active: true },
  );
});

test("authority access is granted only for an active matching career and modality", () => {
  const assignments = [
    { programId: "program-a", modalityId: "online", active: true },
    { programId: "program-a", modalityId: "onsite", active: false },
  ];

  assert.equal(hasCareerAuthorityScope(assignments, { programId: "program-a", modalityId: "online" }), true);
  assert.equal(hasCareerAuthorityScope(assignments, { programId: "program-a", modalityId: "onsite" }), false);
  assert.equal(hasCareerAuthorityScope(assignments, { programId: "program-b", modalityId: "online" }), false);
});
