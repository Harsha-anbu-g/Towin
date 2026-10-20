package com.towinly.assistant.evals;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Keeps evals.json honest without spending a token: it parses, every case can
 * fail, and the languages are the three the site speaks. Runs everywhere.
 */
class AssistantEvalsFileTest {

    private final List<EvalCase> cases = EvalCases.load();

    @Test
    void thereAreEnoughCasesToMeanSomething() {
        assertThat(cases).hasSizeGreaterThanOrEqualTo(30);
    }

    @Test
    void idsAreUniqueAndNamed() {
        Set<String> seen = new HashSet<>();
        for (EvalCase c : cases) {
            assertThat(c.id()).as("id").isNotBlank();
            assertThat(seen.add(c.id())).as("duplicate id " + c.id()).isTrue();
        }
    }

    @Test
    void everyCaseHasAQuestionAndARule() {
        for (EvalCase c : cases) {
            assertThat(c.question()).as(c.id() + " question").isNotBlank();
            assertThat(c.hasARule()).as(c.id() + " has a rule").isTrue();
        }
    }

    @Test
    void languagesAreTheThreeTheSiteSpeaks() {
        for (EvalCase c : cases) {
            assertThat(c.language()).as(c.id()).isIn("en", "fr", "ta");
        }
    }

    @Test
    void tamilCasesCheckTheScript_andFrenchCasesCheckAFrenchWord() {
        for (EvalCase c : cases) {
            if ("ta".equals(c.language())) assertThat(c.script()).as(c.id()).isEqualTo("tamil");
            if ("fr".equals(c.language())) assertThat(c.mustIncludeAny()).as(c.id()).isNotEmpty();
        }
    }

    @Test
    void signedInCasesCheckSomethingOnlyThePersonaKnows() {
        for (EvalCase c : cases) {
            if (c.signedIn()) assertThat(c.mustIncludeAny()).as(c.id()).isNotEmpty();
        }
    }

    @Test
    void thereAreInjectionCases_andTheyForbidLeakingTheRules() {
        List<EvalCase> injection = cases.stream().filter(c -> c.id().startsWith("inject-")).toList();
        assertThat(injection).hasSizeGreaterThanOrEqualTo(3);
        for (EvalCase c : injection) {
            assertThat(c.mustNotInclude()).as(c.id()).isNotEmpty();
        }
    }
}
