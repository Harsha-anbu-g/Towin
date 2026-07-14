// NB: deliberately not in a package named `build` — .gitignore has a `build/` rule that
// would silently untrack this file.
package com.towin.common;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;
import java.io.File;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the OWASP dependency-check wiring in pom.xml.
 *
 * <p>The plugin used to be declared with a &lt;configuration&gt; but no
 * &lt;executions&gt;, so its goal was never bound to a lifecycle phase and the
 * scanner never actually ran. The binding now lives in the {@code security}
 * profile: {@code ./mvnw -Psecurity verify} scans, while plain {@code ./mvnw test}
 * (what CI runs) stays fast and never downloads the NVD database.
 */
class DependencyCheckBindingTest {

    private static final String PLUGIN_ARTIFACT_ID = "dependency-check-maven";
    private static final String SECURITY_PROFILE_ID = "security";

    private static Document pom;
    private static XPath xpath;

    @BeforeAll
    static void parsePom() throws Exception {
        // Surefire runs with basedir as the working directory, so pom.xml is right here.
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(false); // keeps the XPath expressions below prefix-free
        pom = factory.newDocumentBuilder().parse(new File("pom.xml"));
        xpath = XPathFactory.newInstance().newXPath();
    }

    @Test
    void securityProfile_bindsDependencyCheckGoalToVerifyPhase() throws Exception {
        Node plugin = selectNode("/project/profiles/profile[id='" + SECURITY_PROFILE_ID + "']"
                + "/build/plugins/plugin[artifactId='" + PLUGIN_ARTIFACT_ID + "']");

        assertThat(plugin)
                .as("dependency-check-maven must be declared inside the '%s' profile", SECURITY_PROFILE_ID)
                .isNotNull();

        Node execution = selectNode("/project/profiles/profile[id='" + SECURITY_PROFILE_ID + "']"
                + "/build/plugins/plugin[artifactId='" + PLUGIN_ARTIFACT_ID + "']"
                + "/executions/execution[phase='verify'][goals/goal='check']");

        assertThat(execution)
                .as("the 'check' goal must be bound to the 'verify' phase, otherwise the scanner never runs")
                .isNotNull();
    }

    @Test
    void defaultBuild_doesNotBindDependencyCheck_soOrdinaryTestRunsStayFast() throws Exception {
        NodeList executions = selectNodes("/project/build/plugins/plugin[artifactId='"
                + PLUGIN_ARTIFACT_ID + "']/executions/execution");

        assertThat(executions.getLength())
                .as("no execution may be bound in the default build: CI runs './mvnw test' "
                        + "and must not trigger the slow NVD download")
                .isZero();
    }

    @Test
    void dependencyCheck_keepsFailBuildOnCvssAndSkipTestScopeConfiguration() throws Exception {
        Node plugin = selectNode("/project/build/plugins/plugin[artifactId='"
                + PLUGIN_ARTIFACT_ID + "']");

        assertThat(plugin)
                .as("the shared configuration stays in the default build so that a direct "
                        + "'./mvnw dependency-check:check' picks it up too")
                .isNotNull();

        assertThat(selectText("/project/build/plugins/plugin[artifactId='"
                + PLUGIN_ARTIFACT_ID + "']/configuration/failBuildOnCVSS")).isEqualTo("9");
        assertThat(selectText("/project/build/plugins/plugin[artifactId='"
                + PLUGIN_ARTIFACT_ID + "']/configuration/skipTestScope")).isEqualTo("true");
    }

    private Node selectNode(String expression) throws Exception {
        return (Node) xpath.evaluate(expression, pom, XPathConstants.NODE);
    }

    private NodeList selectNodes(String expression) throws Exception {
        return (NodeList) xpath.evaluate(expression, pom, XPathConstants.NODESET);
    }

    private String selectText(String expression) throws Exception {
        return xpath.evaluate(expression, pom).trim();
    }
}
