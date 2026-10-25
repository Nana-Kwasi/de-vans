package com.quickchop;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Sign-in endpoints are rate limited per client IP, and a spoofed X-Forwarded-For does not escape it. */
@SpringBootTest(properties = "quickchop.rate-limit.proxy-hops=1")
@AutoConfigureMockMvc
@ActiveProfiles("local")
class RateLimitIntegrationTest {

    @Autowired MockMvc mvc;

    @Test
    void loginIsRateLimitedAndXffSpoofingDoesNotHelp() throws Exception {
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/api/rider/login")
                            // Client-chosen left-hand entries change every request; the proxy-added
                            // right-hand one (the real client) stays the same.
                            .header("X-Forwarded-For", "10.0.0." + i + ", 203.0.113.7")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"phoneNumber\":\"0241234567\",\"password\":\"guess" + i + "\"}"))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/admin/login")
                        .header("X-Forwarded-For", "1.2.3.4, 203.0.113.7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"x@example.com\",\"password\":\"guess\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }
}
