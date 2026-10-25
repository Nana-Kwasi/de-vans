package com.quickchop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Policies are public, must be accepted before use, are versioned, and every acceptance is provable. */
@SpringBootTest(properties = {"quickchop.rate-limit.proxy-hops=0", "quickchop.rate-limit.login-per-minute=1000"})
@AutoConfigureMockMvc
@ActiveProfiles("local")
class PolicyIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @Test
    void customerConsentLifecycle() throws Exception {
        // Seeded and public.
        JsonNode pub = read(mvc.perform(get("/api/policies?audience=customer")));
        assertThat(pub).hasSize(2);
        mvc.perform(get("/api/policies/customer-privacy")).andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1));
        mvc.perform(get("/api/policies?audience=rider")).andExpect(status().isOk());

        RequestPostProcessor as = jwt().jwt(j -> j.subject(UUID.randomUUID().toString()));
        mvc.perform(post("/api/customers").with(as).contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Kwame Consent\",\"email\":\"kwame@example.com\"}"));
        String menuId = read(mvc.perform(get("/api/menu"))).get(0).get("id").asText();
        String order = "{\"items\":[{\"menuItemId\":\"" + menuId + "\",\"quantity\":1}],\"deliveryAddress\":\"Osu\",\"pickup\":true}";

        // Not accepted yet → cannot order, with a machine-readable code for the app.
        mvc.perform(post("/api/orders").with(as).contentType(MediaType.APPLICATION_JSON).content(order))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("POLICIES_NOT_ACCEPTED"));

        // A rider policy can't be accepted as a customer.
        String riderPolicy = read(mvc.perform(get("/api/policies?audience=rider"))).get(0).get("id").asText();
        mvc.perform(post("/api/customers/me/policies/accept").with(as).contentType(MediaType.APPLICATION_JSON)
                .content("{\"policyIds\":[\"" + riderPolicy + "\"]}")).andExpect(status().isBadRequest());

        accept(as, "203.0.113.9", "QookaApp/1.0 (iPhone)");
        mvc.perform(post("/api/orders").with(as).contentType(MediaType.APPLICATION_JSON).content(order))
                .andExpect(status().isCreated());

        // Admin: consent table and proof.
        String admin = adminToken();
        JsonNode table = read(mvc.perform(get("/api/admin/consents?audience=customer").header("Authorization", "Bearer " + admin)));
        JsonNode row = find(table.get("rows"), "Kwame Consent");
        assertThat(row.get("allAccepted").asBoolean()).isTrue();
        String customerId = row.get("subjectId").asText();
        JsonNode proof = read(mvc.perform(get("/api/admin/consents/customer/" + customerId).header("Authorization", "Bearer " + admin)));
        assertThat(proof.get("acceptances")).hasSize(2);
        JsonNode rec = proof.get("acceptances").get(0);
        assertThat(rec.get("ipAddress").asText()).isEqualTo("203.0.113.9");
        assertThat(rec.get("userAgent").asText()).contains("iPhone");
        assertThat(rec.get("hashMatches").asBoolean()).isTrue();
        assertThat(rec.get("acceptedSha256").asText()).hasSize(64);

        // Admin publishes v2 of the terms → customer must accept again, v1 proof still valid.
        mvc.perform(post("/api/admin/policies/customer-terms").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Customer Terms of Service\",\"content\":\"## New terms\\nUpdated.\",\"changeSummary\":\"Clarified refunds\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(2));
        mvc.perform(post("/api/orders").with(as).contentType(MediaType.APPLICATION_JSON).content(order))
                .andExpect(status().isForbidden());
        JsonNode row2 = find(read(mvc.perform(get("/api/admin/consents?audience=customer").header("Authorization", "Bearer " + admin))).get("rows"), "Kwame Consent");
        assertThat(row2.get("allAccepted").asBoolean()).isFalse();
        JsonNode termsCell = null;
        for (JsonNode c : row2.get("policies")) if (c.get("type").asText().equals("CUSTOMER_TERMS")) termsCell = c;
        assertThat(termsCell.get("acceptedVersion").asInt()).isEqualTo(1);
        assertThat(termsCell.get("currentVersion").asInt()).isEqualTo(2);

        accept(as, "203.0.113.10", "QookaApp/1.1");
        mvc.perform(post("/api/orders").with(as).contentType(MediaType.APPLICATION_JSON).content(order))
                .andExpect(status().isCreated());
        JsonNode proof2 = read(mvc.perform(get("/api/admin/consents/customer/" + customerId).header("Authorization", "Bearer " + admin)));
        assertThat(proof2.get("acceptances")).hasSize(3);          // history kept
        proof2.get("acceptances").forEach(a -> assertThat(a.get("hashMatches").asBoolean()).isTrue());

        // Publishing is admin only.
        mvc.perform(post("/api/admin/policies/customer-terms").with(as).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"x\",\"content\":\"y\"}")).andExpect(status().isForbidden());
    }

    @Test
    void riderMustAcceptBeforeWorking() throws Exception {
        String admin = adminToken();
        JsonNode r = read(mvc.perform(post("/api/admin/riders").header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"Yaw Policy\",\"phoneNumber\":\"0277000111\"}")));
        String token = read(mvc.perform(post("/api/rider/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"phoneNumber\":\"0277000111\",\"password\":\"" + r.at("/temporaryPassword").asText() + "\"}"))).get("token").asText();
        token = read(mvc.perform(patch("/api/rider/change-password").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"" + r.at("/temporaryPassword").asText() + "\",\"newPassword\":\"yaw-pass-123\"}"))).get("token").asText();

        mvc.perform(get("/api/rider/deliveries/available").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("POLICIES_NOT_ACCEPTED"));

        JsonNode st = read(mvc.perform(get("/api/rider/policies").header("Authorization", "Bearer " + token)));
        assertThat(st).hasSize(2);
        List<String> ids = new ArrayList<>();
        st.forEach(x -> ids.add("\"" + x.at("/policy/id").asText() + "\""));
        mvc.perform(post("/api/rider/policies/accept").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"policyIds\":[" + String.join(",", ids) + "]}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/rider/deliveries/available").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        JsonNode table = read(mvc.perform(get("/api/admin/consents?audience=rider").header("Authorization", "Bearer " + admin)));
        assertThat(find(table.get("rows"), "Yaw Policy").get("allAccepted").asBoolean()).isTrue();
    }

    // ------------------------------------------------------------------ helpers

    private void accept(RequestPostProcessor as, String ip, String ua) throws Exception {
        JsonNode st = read(mvc.perform(get("/api/customers/me/policies").with(as)));
        List<String> ids = new ArrayList<>();
        st.forEach(x -> ids.add("\"" + x.at("/policy/id").asText() + "\""));
        mvc.perform(post("/api/customers/me/policies/accept").with(as).with(r -> { r.setRemoteAddr(ip); return r; })
                        .header("User-Agent", ua).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"policyIds\":[" + String.join(",", ids) + "]}"))
                .andExpect(status().isOk());
    }

    private String adminToken() throws Exception {
        return read(mvc.perform(post("/api/admin/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"franciskontoh4@gmail.com\",\"password\":\"0000000000\"}"))).get("token").asText();
    }

    private JsonNode find(JsonNode rows, String name) {
        for (JsonNode r : rows) if (name.equals(r.get("name").asText())) return r;
        throw new AssertionError("row not found: " + name);
    }

    private JsonNode read(org.springframework.test.web.servlet.ResultActions res) throws Exception {
        var r = res.andReturn().getResponse();
        assertThat(r.getStatus()).as(r.getContentAsString()).isBetween(200, 299);
        return json.readTree(r.getContentAsString());
    }
}
