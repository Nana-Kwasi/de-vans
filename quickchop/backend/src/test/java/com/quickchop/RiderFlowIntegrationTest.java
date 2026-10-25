package com.quickchop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.test.mock.mockito.MockBean;
import com.quickchop.service.EmailService;
import com.quickchop.service.OrderService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end rider flow against the local (H2) profile: admin creates riders, a customer
 * orders for delivery, the admin dispatches, two riders race for the job, and the winner
 * delivers with the customer's code while the customer tracks it.
 */
@SpringBootTest(properties = {"quickchop.rate-limit.proxy-hops=0", "quickchop.rate-limit.login-per-minute=1000"})
@AutoConfigureMockMvc
@ActiveProfiles("local")
class RiderFlowIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired OrderService orderService;
    @MockBean EmailService emailService;

    private final UUID customerAuthId = UUID.randomUUID();

    @Test
    void fullDeliveryFlow() throws Exception {
        String admin = body(call(post("/api/admin/login"), null,
                "{\"email\":\"franciskontoh4@gmail.com\",\"password\":\"0000000000\"}"), 200).get("token").asText();

        // --- Admin sets up two riders; riders cannot exist any other way.
        JsonNode r1 = body(call(post("/api/admin/riders"), admin,
                "{\"fullName\":\"Kofi Mensah\",\"phoneNumber\":\"024 111 2222\",\"vehiclePlate\":\"GR-123-24\"}"), 201);
        JsonNode r2 = body(call(post("/api/admin/riders"), admin,
                "{\"fullName\":\"Ama Owusu\",\"phoneNumber\":\"0243334444\"}"), 201);
        assertThat(r1.at("/rider/phoneNumber").asText()).isEqualTo("+233241112222");
        call(post("/api/admin/riders"), admin, "{\"fullName\":\"Dup\",\"phoneNumber\":\"+233241112222\"}").andExpect(status().isBadRequest());

        String t1 = riderLogin("0241112222", r1.at("/temporaryPassword").asText());
        String t2 = riderLogin("0243334444", r2.at("/temporaryPassword").asText());

        // Temporary password: everything but change-password is refused server side.
        call(get("/api/rider/deliveries/available"), t1, null).andExpect(status().isForbidden());
        t1 = changePassword(t1, r1.at("/temporaryPassword").asText(), "rider-one-pass");
        t2 = changePassword(t2, r2.at("/temporaryPassword").asText(), "rider-two-pass");
        acceptRiderPolicies(t1);
        acceptRiderPolicies(t2);

        // A rider token cannot reach admin or customer routes.
        call(get("/api/admin/riders"), t1, null).andExpect(status().isForbidden());
        call(get("/api/orders/me"), t1, null).andExpect(status().isForbidden());

        // --- Customer places a delivery order with an accurate pin.
        customer(post("/api/customers"), "{\"fullName\":\"Esi Customer\",\"email\":\"esi@example.com\"}").andExpect(status().is2xxSuccessful());
        acceptCustomerPolicies(jwt().jwt(j -> j.subject(customerAuthId.toString())));
        String menuId = body(mvc.perform(get("/api/menu")), 200).get(0).get("id").asText();
        JsonNode order = body(customer(post("/api/orders"), """
                {"items":[{"menuItemId":"%s","quantity":2}],
                 "deliveryAddress":"12 Palm St, Achimota","deliveryLat":5.6150,"deliveryLng":-0.2300,
                 "deliveryAccuracyM":8,"contactPhone":"+233205556666",
                 "kitchenNote":"[DELIVERY] · ☎ +233205556666 · blue gate"}
                """.formatted(menuId)), 201);
        String orderId = order.get("id").asText();
        assertThat(order.get("deliveryLat").asDouble()).isEqualTo(5.6150);

        // Placing an order is not paying for it: no "confirmed" email, no kitchen alert,
        // and it cannot go to riders yet.
        verify(emailService, never()).send(any(), any(), any(), any());
        verify(emailService, never()).sendToSupport(any(), any(), any());
        call(post("/api/admin/orders/" + orderId + "/dispatch"), admin, "{}").andExpect(status().isBadRequest());

        // Payment confirmed (what the Paystack webhook / verify does) → confirmation, once.
        orderService.markPaid(UUID.fromString(orderId));
        orderService.markPaid(UUID.fromString(orderId));
        verify(emailService, times(1)).send(eq("esi@example.com"), contains("confirmed"), any(), any());
        verify(emailService, times(1)).sendToSupport(any(), any(), any());

        // Board cannot fake rider statuses.
        call(patch("/api/orders/" + orderId + "/status"), admin, "{\"status\":\"RIDER_ASSIGNED\"}").andExpect(status().isBadRequest());

        // --- Dispatch: appears for every rider, without customer contact details.
        JsonNode job = body(call(post("/api/admin/orders/" + orderId + "/dispatch"), admin, "{\"note\":\"Fragile soup\"}"), 200);
        String deliveryId = job.get("id").asText();
        call(post("/api/admin/orders/" + orderId + "/dispatch"), admin, "{}").andExpect(status().isConflict());

        JsonNode pool1 = body(call(get("/api/rider/deliveries/available"), t1, null), 200);
        JsonNode pool2 = body(call(get("/api/rider/deliveries/available"), t2, null), 200);
        assertThat(pool1).hasSize(1);
        assertThat(pool2).hasSize(1);
        assertThat(pool1.get(0).get("riderFee").decimalValue()).isPositive();
        assertThat(pool1.get(0).get("dropoffLat").asDouble()).isEqualTo(5.6150);
        assertThat(pool1.get(0).get("customerPhone").isNull()).isTrue();
        // Riders never handle order money: no totals, payment state or item prices — only their fee.
        assertThat(pool1.get(0).get("orderTotal").isNull()).isTrue();
        assertThat(pool1.get(0).get("paid").isNull()).isTrue();
        assertThat(pool1.get(0).at("/items/0/unitPrice").isNull()).isTrue();

        // --- Race: first accept wins, second gets 409 and the job leaves the pool.
        JsonNode accepted = body(call(post("/api/rider/deliveries/" + deliveryId + "/accept"), t1, null), 200);
        call(post("/api/rider/deliveries/" + deliveryId + "/accept"), t2, null).andExpect(status().isConflict());
        assertThat(body(call(get("/api/rider/deliveries/available"), t2, null), 200)).isEmpty();
        assertThat(accepted.get("customerPhone").asText()).isEqualTo("+233205556666");
        assertThat(accepted.get("customerNote").asText()).isEqualTo("blue gate");
        assertThat(accepted.get("orderTotal").isNull()).isTrue();
        // Admins still see the order's money.
        assertThat(body(call(get("/api/admin/deliveries"), admin, null), 200).get(0).get("orderTotal").decimalValue()).isPositive();
        // The losing rider cannot read or act on it.
        call(get("/api/rider/deliveries/" + deliveryId), t2, null).andExpect(status().isNotFound());
        call(post("/api/rider/deliveries/" + deliveryId + "/picked-up"), t2, null).andExpect(status().isNotFound());

        // --- Rider moves; customer tracks.
        call(post("/api/rider/location"), t1, "{\"lat\":5.6080,\"lng\":-0.2800,\"accuracyM\":6}").andExpect(status().isNoContent());
        call(post("/api/rider/location"), t1, "{\"lat\":95,\"lng\":0}").andExpect(status().isBadRequest());
        call(post("/api/rider/deliveries/" + deliveryId + "/picked-up"), t1, null).andExpect(status().isOk());
        call(post("/api/rider/deliveries/" + deliveryId + "/arrived"), t1, null).andExpect(status().isOk());

        JsonNode tracking = body(customer(get("/api/orders/" + orderId + "/tracking"), null), 200);
        assertThat(tracking.get("orderStatus").asText()).isEqualTo("OUT_FOR_DELIVERY");
        assertThat(tracking.at("/delivery/riderName").asText()).isEqualTo("Kofi Mensah");
        assertThat(tracking.at("/riderLocation/lat").asDouble()).isEqualTo(5.6080);
        String pin = tracking.get("deliveryPin").asText();
        assertThat(pin).hasSize(4);

        // Another customer cannot see this order's tracking.
        mvc.perform(get("/api/orders/" + orderId + "/tracking").with(jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().is4xxClientError());

        // --- Wrong code is refused; right code completes.
        String wrong = pin.equals("0000") ? "1111" : "0000";
        call(post("/api/rider/deliveries/" + deliveryId + "/complete"), t1, "{\"pin\":\"" + wrong + "\"}").andExpect(status().isBadRequest());
        JsonNode done = body(call(post("/api/rider/deliveries/" + deliveryId + "/complete"), t1, "{\"pin\":\"" + pin + "\"}"), 200);
        assertThat(done.get("status").asText()).isEqualTo("DELIVERED");
        assertThat(done.get("pinAttempts").asInt()).isEqualTo(1);

        JsonNode after = body(customer(get("/api/orders/" + orderId + "/tracking"), null), 200);
        assertThat(after.get("orderStatus").asText()).isEqualTo("DELIVERED");
        assertThat(after.get("riderLocation").isNull()).isTrue();   // location stops being shared
        assertThat(after.get("deliveryPin").isNull()).isTrue();

        JsonNode summary = body(call(get("/api/rider/summary"), t1, null), 200);
        assertThat(summary.get("todayCount").asInt()).isEqualTo(1);

        JsonNode route = body(call(get("/api/admin/deliveries/" + deliveryId), admin, null), 200);
        assertThat(route.get("path")).isNotEmpty();

        // --- Deactivation signs the rider out immediately.
        call(post("/api/admin/riders/" + r1.at("/rider/id").asText() + "/deactivate"), admin, null).andExpect(status().isOk());
        call(get("/api/rider/me"), t1, null).andExpect(status().isUnauthorized());
        call(post("/api/rider/login"), null, "{\"phoneNumber\":\"0241112222\",\"password\":\"rider-one-pass\"}")
                .andExpect(status().isUnauthorized());
    }

    @Test
    void drinksSearchAndOrderDetail() throws Exception {
        String admin = body(call(post("/api/admin/login"), null,
                "{\"email\":\"franciskontoh4@gmail.com\",\"password\":\"0000000000\"}"), 200).get("token").asText();

        // Drinks carry a soft/local type; food never does.
        JsonNode sobolo = body(call(post("/api/menu"), admin,
                "{\"name\":\"Asaana\",\"price\":12,\"category\":\"drinks\",\"drinkType\":\"local\"}"), 201);
        assertThat(sobolo.get("drinkType").asText()).isEqualTo("local");
        JsonNode soda = body(call(post("/api/menu"), admin,
                "{\"name\":\"Sprite\",\"price\":10,\"category\":\"drinks\"}"), 201);
        assertThat(soda.get("drinkType").asText()).isEqualTo("soft");
        JsonNode food = body(call(post("/api/menu"), admin,
                "{\"name\":\"Waakye\",\"price\":30,\"category\":\"rice\",\"drinkType\":\"local\"}"), 201);
        assertThat(food.get("drinkType").isNull()).isTrue();
        call(post("/api/menu"), admin, "{\"name\":\"X\",\"price\":1,\"category\":\"drinks\",\"drinkType\":\"beer\"}")
                .andExpect(status().isBadRequest());

        // A customer with two orders.
        UUID authId = UUID.randomUUID();
        var as = jwt().jwt(j -> j.subject(authId.toString()));
        mvc.perform(post("/api/customers").with(as).contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Abena Search\",\"email\":\"abena@example.com\",\"phoneNumber\":\"+233501234567\"}"));
        acceptCustomerPolicies(as);
        String jollof = body(mvc.perform(get("/api/menu")), 200).get(0).get("id").asText();
        String orderBody = "{\"items\":[{\"menuItemId\":\"%s\",\"quantity\":%d},{\"menuItemId\":\"%s\",\"quantity\":1}],\"deliveryAddress\":\"Osu\",\"pickup\":true}";
        JsonNode o1 = body(mvc.perform(post("/api/orders").with(as).contentType(MediaType.APPLICATION_JSON)
                .content(orderBody.formatted(jollof, 2, sobolo.get("id").asText()))), 201);
        mvc.perform(post("/api/orders").with(as).contentType(MediaType.APPLICATION_JSON)
                .content(orderBody.formatted(jollof, 1, sobolo.get("id").asText())));
        assertThat(o1.get("customerName").asText()).isEqualTo("Abena Search");

        // Search by order number, customer name, and phone in local format.
        JsonNode byNumber = body(call(get("/api/admin/search?q=" + o1.get("orderNumber").asText()), admin, null), 200);
        assertThat(byNumber.get("orders").get(0).get("id").asText()).isEqualTo(o1.get("id").asText());
        JsonNode byName = body(call(get("/api/admin/search?q=abena"), admin, null), 200);
        assertThat(byName.get("customers").get(0).get("orderCount").asInt()).isEqualTo(2);
        assertThat(byName.get("orders")).hasSize(2);
        JsonNode byPhone = body(call(get("/api/admin/search?q=050 123 4567"), admin, null), 200);
        assertThat(byPhone.get("customers")).hasSize(1);
        JsonNode byMenu = body(call(get("/api/admin/search?q=asaa"), admin, null), 200);
        assertThat(byMenu.get("menu").get(0).get("name").asText()).isEqualTo("Asaana");
        // Search is admin only.
        mvc.perform(get("/api/admin/search?q=abena").with(as)).andExpect(status().isForbidden());

        // Order detail with customer analytics.
        JsonNode detail = body(call(get("/api/admin/orders/" + o1.get("id").asText()), admin, null), 200);
        assertThat(detail.at("/customer/orderCount").asInt()).isEqualTo(2);
        assertThat(detail.at("/customer/segment").asText()).isEqualTo("RETURNING");
        assertThat(detail.at("/customer/pickupCount").asInt()).isEqualTo(2);
        assertThat(detail.at("/customer/favouriteItems/0/quantity").asInt()).isEqualTo(3);
        assertThat(detail.get("paid").asBoolean()).isFalse();
    }

    @Test
    void riderAccountLocksAfterRepeatedWrongPasswords() throws Exception {
        String admin = body(call(post("/api/admin/login"), null,
                "{\"email\":\"franciskontoh4@gmail.com\",\"password\":\"0000000000\"}"), 200).get("token").asText();
        JsonNode r = body(call(post("/api/admin/riders"), admin,
                "{\"fullName\":\"Lock Test\",\"phoneNumber\":\"0209998888\"}"), 201);
        for (int i = 0; i < 5; i++) {
            call(post("/api/rider/login"), null, "{\"phoneNumber\":\"0209998888\",\"password\":\"wrong-pass\"}")
                    .andExpect(status().isUnauthorized());
        }
        // Even the right password is refused while locked.
        call(post("/api/rider/login"), null,
                "{\"phoneNumber\":\"0209998888\",\"password\":\"" + r.at("/temporaryPassword").asText() + "\"}")
                .andExpect(status().isTooManyRequests());
        // Admin reset unlocks.
        String temp = body(call(post("/api/admin/riders/" + r.at("/rider/id").asText() + "/reset-password"), admin, null), 200)
                .get("temporaryPassword").asText();
        riderLogin("0209998888", temp);
    }

    // ------------------------------------------------------------------ helpers

    private void acceptCustomerPolicies(org.springframework.test.web.servlet.request.RequestPostProcessor as) throws Exception {
        JsonNode st = body(mvc.perform(get("/api/customers/me/policies").with(as)), 200);
        StringBuilder ids = new StringBuilder();
        st.forEach(x -> ids.append(ids.length() == 0 ? "" : ",").append('"').append(x.at("/policy/id").asText()).append('"'));
        mvc.perform(post("/api/customers/me/policies/accept").with(as).contentType(MediaType.APPLICATION_JSON)
                .content("{\"policyIds\":[" + ids + "]}")).andExpect(status().isOk());
    }

    private void acceptRiderPolicies(String token) throws Exception {
        JsonNode st = body(call(get("/api/rider/policies"), token, null), 200);
        StringBuilder ids = new StringBuilder();
        st.forEach(x -> ids.append(ids.length() == 0 ? "" : ",").append('"').append(x.at("/policy/id").asText()).append('"'));
        call(post("/api/rider/policies/accept"), token, "{\"policyIds\":[" + ids + "]}").andExpect(status().isOk());
    }

    private String riderLogin(String phone, String password) throws Exception {
        JsonNode res = body(call(post("/api/rider/login"), null,
                "{\"phoneNumber\":\"" + phone + "\",\"password\":\"" + password + "\"}"), 200);
        return res.get("token").asText();
    }

    private String changePassword(String token, String current, String next) throws Exception {
        JsonNode res = body(call(patch("/api/rider/change-password"), token,
                "{\"currentPassword\":\"" + current + "\",\"newPassword\":\"" + next + "\"}"), 200);
        // The old token is revoked by the change.
        call(get("/api/rider/me"), token, null).andExpect(status().isUnauthorized());
        return res.get("token").asText();
    }

    private ResultActions call(MockHttpServletRequestBuilder req, String token, String body) throws Exception {
        if (token != null) req.header("Authorization", "Bearer " + token);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(req);
    }

    private ResultActions customer(MockHttpServletRequestBuilder req, String body) throws Exception {
        req.with(jwt().jwt(j -> j.subject(customerAuthId.toString())));
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(req);
    }

    private JsonNode body(ResultActions res, int expected) throws Exception {
        var r = res.andReturn().getResponse();
        assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(expected);
        return json.readTree(r.getContentAsString());
    }
}
