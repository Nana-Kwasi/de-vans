package com.quickchop.service;

import com.quickchop.dto.Dtos.OrderDto;
import com.quickchop.entity.Order;
import com.quickchop.entity.SupportTicket;

import java.time.format.DateTimeFormatter;

/**
 * Email bodies, kept together so wording and markup are in one place.
 *
 * Every message is built as both plain text and HTML. The plain-text part is not a
 * formality: some clients show it, and a message with no text alternative scores worse
 * with spam filters — which matters when sending through Gmail rather than a
 * transactional provider.
 */
final class EmailTemplates {

    private static final DateTimeFormatter STAMP =
            DateTimeFormatter.ofPattern("d MMM yyyy 'at' HH:mm");

    private EmailTemplates() {}

    /** Wraps body markup in a minimal, client-safe shell. Inline styles only: Gmail strips <style>. */
    private static String page(String brand, String heading, String bodyHtml) {
        return """
            <div style="margin:0;padding:24px 12px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e5e4;">
                <div style="background:#FF7A18;padding:18px 24px;">
                  <div style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.2px;">%s</div>
                </div>
                <div style="padding:24px;">
                  <h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:#1c1917;font-weight:650;">%s</h1>
                  %s
                </div>
                <div style="padding:14px 24px;background:#fafaf9;border-top:1px solid #e7e5e4;color:#78716c;font-size:12px;line-height:1.5;">
                  This is an automated message from %s.
                </div>
              </div>
            </div>
            """.formatted(esc(brand), esc(heading), bodyHtml, esc(brand));
    }

    private static String p(String text) {
        return "<p style=\"margin:0 0 12px;font-size:14px;line-height:1.6;color:#44403c;\">%s</p>"
                .formatted(esc(text));
    }

    /** Escapes the five characters that can break out of HTML text or an attribute. */
    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    // ---------- Order status ----------

    static String orderSubject(String brand, Order order, String headline) {
        return "%s — Order %s: %s".formatted(brand, order.getOrderNumber(), headline);
    }

    static String orderText(String brand, String customerName, Order order, String message) {
        return orderText(brand, customerName, order, message, null);
    }

    static String orderHtml(String brand, String customerName, Order order, String message) {
        return orderHtml(brand, customerName, order, message, null);
    }

    /** As above, with an optional extra paragraph (e.g. the delivery code) after the message. */
    static String orderText(String brand, String customerName, Order order, String message, String extra) {
        if (extra != null && !extra.isBlank()) message = message + "\n\n" + extra;
        return """
               Hi %s,

               %s

               Order:  %s
               Status: %s
               Total:  GHS %s

               Thank you for ordering with %s.
               """.formatted(
                customerName == null || customerName.isBlank() ? "there" : customerName,
                message, order.getOrderNumber(), pretty(order), order.getTotal(), brand);
    }

    static String orderHtml(String brand, String customerName, Order order, String message, String extra) {
        String rows = """
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%%;margin:4px 0 16px;font-size:14px;color:#1c1917;">
              <tr><td style="padding:7px 0;color:#78716c;">Order</td><td style="padding:7px 0;text-align:right;font-weight:600;">%s</td></tr>
              <tr><td style="padding:7px 0;color:#78716c;border-top:1px solid #f5f5f4;">Status</td><td style="padding:7px 0;text-align:right;font-weight:600;border-top:1px solid #f5f5f4;">%s</td></tr>
              <tr><td style="padding:7px 0;color:#78716c;border-top:1px solid #f5f5f4;">Total</td><td style="padding:7px 0;text-align:right;font-weight:600;border-top:1px solid #f5f5f4;">GHS %s</td></tr>
            </table>
            """.formatted(esc(order.getOrderNumber()), esc(pretty(order)), esc(String.valueOf(order.getTotal())));

        String body = p("Hi " + (customerName == null || customerName.isBlank() ? "there" : customerName) + ",")
                + p(message) + (extra == null || extra.isBlank() ? "" : p(extra)) + rows;
        return page(brand, message, body);
    }

    /** Human-readable status, matching the wording the app and push notifications use. */
    private static String pretty(Order order) {
        return switch (order.getStatus()) {
            case ORDER_RECEIVED -> "Order received";
            case PREPARING -> order.isPickup() ? "Processing" : "Preparing";
            case AWAITING_RIDER -> "Finding a rider";
            case RIDER_ASSIGNED -> "Rider assigned";
            case OUT_FOR_DELIVERY -> "Out for delivery";
            case DELIVERED -> "Delivered";
            case READY -> "Ready for pickup";
            case CANCELLED -> "Cancelled";
        };
    }

    // ---------- Order placed ----------

    static String placedSubject(String brand, OrderDto o) {
        return "%s — order %s confirmed".formatted(brand, o.orderNumber());
    }

    /** Itemised lines, shared by the customer receipt and the kitchen alert. */
    private static String linesText(OrderDto o) {
        StringBuilder sb = new StringBuilder();
        for (var i : o.items()) {
            sb.append("  %dx %s".formatted(i.quantity(), nz(i.name())));
            if (i.addOns() != null && !i.addOns().isBlank()) sb.append(" (").append(i.addOns()).append(")");
            sb.append("   GHS ").append(i.unitPrice().multiply(java.math.BigDecimal.valueOf(i.quantity())))
              .append("\n");
        }
        return sb.toString();
    }

    private static String linesHtml(OrderDto o) {
        StringBuilder sb = new StringBuilder(
            "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;margin:4px 0 14px;font-size:14px;color:#1c1917;\">");
        for (var i : o.items()) {
            String extra = (i.addOns() == null || i.addOns().isBlank())
                    ? "" : "<div style=\"font-size:12.5px;color:#78716c;\">" + esc(i.addOns()) + "</div>";
            sb.append("<tr><td style=\"padding:8px 0;border-bottom:1px solid #f5f5f4;\">%dx %s%s</td>"
                    .formatted(i.quantity(), esc(nz(i.name())), extra))
              .append("<td style=\"padding:8px 0;text-align:right;border-bottom:1px solid #f5f5f4;white-space:nowrap;\">GHS %s</td></tr>"
                    .formatted(esc(String.valueOf(i.unitPrice().multiply(java.math.BigDecimal.valueOf(i.quantity()))))));
        }
        sb.append("<tr><td style=\"padding:8px 0;color:#78716c;\">Subtotal</td><td style=\"padding:8px 0;text-align:right;\">GHS %s</td></tr>".formatted(esc(String.valueOf(o.subtotal()))));
        sb.append("<tr><td style=\"padding:8px 0;color:#78716c;\">Delivery</td><td style=\"padding:8px 0;text-align:right;\">GHS %s</td></tr>".formatted(esc(String.valueOf(o.deliveryFee()))));
        sb.append("<tr><td style=\"padding:10px 0;font-weight:700;border-top:2px solid #e7e5e4;\">Total</td><td style=\"padding:10px 0;text-align:right;font-weight:700;border-top:2px solid #e7e5e4;\">GHS %s</td></tr>".formatted(esc(String.valueOf(o.total()))));
        return sb.append("</table>").toString();
    }

    static String placedText(String brand, String customerName, OrderDto o) {
        return """
               Hi %s,

               Thanks for your order — we have it, and we will let you know as it progresses.

               Order:  %s
               %s
               Subtotal: GHS %s
               Delivery: GHS %s
               Total:    GHS %s

               %s: %s

               %s
               """.formatted(
                customerName == null || customerName.isBlank() ? "there" : customerName,
                o.orderNumber(), linesText(o), o.subtotal(), o.deliveryFee(), o.total(),
                o.pickup() ? "Collect from" : "Delivering to",
                nz(o.deliveryAddress()), brand);
    }

    static String placedHtml(String brand, String customerName, OrderDto o) {
        String body = p("Hi " + (customerName == null || customerName.isBlank() ? "there" : customerName) + ",")
                + p("Thanks for your order — we have it, and we will email you as it progresses.")
                + linesHtml(o)
                + p((o.pickup() ? "Collect from: " : "Delivering to: ") + nz(o.deliveryAddress()));
        return page(brand, "Order " + o.orderNumber() + " confirmed", body);
    }

    // ---------- New order, for the kitchen ----------

    static String newOrderSubject(OrderDto o) {
        return "New %s order %s — GHS %s".formatted(o.pickup() ? "pickup" : "delivery", o.orderNumber(), o.total());
    }

    static String newOrderText(OrderDto o, String customerName, String phone) {
        return """
               A new order has come in.

               Order:    %s
               Customer: %s
               Phone:    %s
               Type:     %s
               Address:  %s
               When:     %s

               %s
               Total: GHS %s

               Kitchen note: %s
               """.formatted(o.orderNumber(), nz(customerName), nz(phone),
                o.pickup() ? "Self-pickup" : "Delivery", nz(o.deliveryAddress()),
                nz(o.deliveryTimeNote()), linesText(o), o.total(), nz(o.kitchenNote()));
    }

    static String newOrderHtml(String brand, OrderDto o, String customerName, String phone) {
        String rows = """
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%%;margin:4px 0 14px;font-size:14px;color:#1c1917;">
              <tr><td style="padding:7px 0;color:#78716c;width:96px;">Customer</td><td style="padding:7px 0;">%s</td></tr>
              <tr><td style="padding:7px 0;color:#78716c;border-top:1px solid #f5f5f4;">Phone</td><td style="padding:7px 0;border-top:1px solid #f5f5f4;">%s</td></tr>
              <tr><td style="padding:7px 0;color:#78716c;border-top:1px solid #f5f5f4;">Type</td><td style="padding:7px 0;border-top:1px solid #f5f5f4;">%s</td></tr>
              <tr><td style="padding:7px 0;color:#78716c;border-top:1px solid #f5f5f4;">Address</td><td style="padding:7px 0;border-top:1px solid #f5f5f4;">%s</td></tr>
              <tr><td style="padding:7px 0;color:#78716c;border-top:1px solid #f5f5f4;">When</td><td style="padding:7px 0;border-top:1px solid #f5f5f4;">%s</td></tr>
            </table>
            """.formatted(esc(nz(customerName)), esc(nz(phone)),
                          o.pickup() ? "Self-pickup" : "Delivery",
                          esc(nz(o.deliveryAddress())), esc(nz(o.deliveryTimeNote())));
        String note = (o.kitchenNote() == null || o.kitchenNote().isBlank()) ? ""
                : "<div style=\"padding:12px 14px;background:#fafaf9;border-left:3px solid #FF7A18;border-radius:6px;font-size:14px;color:#44403c;\">%s</div>"
                    .formatted(esc(o.kitchenNote()));
        return page(brand, "New order " + o.orderNumber(), rows + linesHtml(o) + note);
    }

    // ---------- Support ticket ----------

    static String supportSubject(SupportTicket t) {
        return "New support ticket — %s%s".formatted(
                t.getCategory(),
                t.getOrderNumber() == null || t.getOrderNumber().isBlank()
                        ? "" : " (order " + t.getOrderNumber() + ")");
    }

    static String supportText(SupportTicket t) {
        return """
               A customer submitted a support ticket.

               From:     %s
               Email:    %s
               Phone:    %s
               Category: %s
               Order:    %s
               Received: %s

               Message:
               %s
               """.formatted(
                nz(t.getName()), nz(t.getEmail()), nz(t.getPhone()), nz(t.getCategory()),
                nz(t.getOrderNumber()),
                t.getCreatedAt() == null ? "just now" : STAMP.format(t.getCreatedAt()),
                nz(t.getMessage()));
    }

    static String supportHtml(String brand, SupportTicket t) {
        String rows = """
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%%;margin:4px 0 16px;font-size:14px;color:#1c1917;">
              <tr><td style="padding:7px 0;color:#78716c;width:90px;">From</td><td style="padding:7px 0;">%s</td></tr>
              <tr><td style="padding:7px 0;color:#78716c;border-top:1px solid #f5f5f4;">Email</td><td style="padding:7px 0;border-top:1px solid #f5f5f4;">%s</td></tr>
              <tr><td style="padding:7px 0;color:#78716c;border-top:1px solid #f5f5f4;">Phone</td><td style="padding:7px 0;border-top:1px solid #f5f5f4;">%s</td></tr>
              <tr><td style="padding:7px 0;color:#78716c;border-top:1px solid #f5f5f4;">Category</td><td style="padding:7px 0;border-top:1px solid #f5f5f4;">%s</td></tr>
              <tr><td style="padding:7px 0;color:#78716c;border-top:1px solid #f5f5f4;">Order</td><td style="padding:7px 0;border-top:1px solid #f5f5f4;">%s</td></tr>
            </table>
            <div style="padding:14px 16px;background:#fafaf9;border-left:3px solid #FF7A18;border-radius:6px;font-size:14px;line-height:1.6;color:#44403c;white-space:pre-wrap;">%s</div>
            """.formatted(esc(nz(t.getName())), esc(nz(t.getEmail())), esc(nz(t.getPhone())),
                          esc(nz(t.getCategory())), esc(nz(t.getOrderNumber())), esc(nz(t.getMessage())));
        return page(brand, "New support ticket", rows);
    }

    // ---------- Admin invite ----------

    static String adminInviteText(String brand, String name, String email, String temporary, String adminUrl) {
        return """
               Hi %s,

               An admin account has been created for you at %s.

               Dashboard: %s
               Email:     %s
               Temporary password: %s

               You will be asked to choose your own password the first time you sign in.
               This temporary one stops working at that point.

               If you were not expecting this, ignore it and tell us.
               """.formatted(name == null || name.isBlank() ? "there" : name,
                brand, adminUrl, email, temporary);
    }

    static String adminInviteHtml(String brand, String name, String email, String temporary, String adminUrl) {
        String body = p("Hi " + (name == null || name.isBlank() ? "there" : name) + ",")
                + p("An admin account has been created for you at " + brand + ".")
                + """
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%%;margin:6px 0 16px;font-size:14px;color:#1c1917;">
                    <tr><td style="padding:7px 0;color:#78716c;width:150px;">Email</td><td style="padding:7px 0;">%s</td></tr>
                    <tr><td style="padding:7px 0;color:#78716c;border-top:1px solid #f5f5f4;">Temporary password</td><td style="padding:7px 0;border-top:1px solid #f5f5f4;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;">%s</td></tr>
                  </table>
                  <p style="margin:18px 0;">
                    <a href="%s" style="display:inline-block;background:#FF7A18;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:9px;font-size:14px;font-weight:600;">Open the dashboard</a>
                  </p>
                  """.formatted(esc(email), esc(temporary), esc(adminUrl))
                + p("You will be asked to choose your own password the first time you sign in. The temporary one stops working at that point.")
                + p("If you were not expecting this, ignore this email and tell us.");
        return page(brand, "Your admin account", body);
    }

    // ---------- Admin password reset ----------

    static String resetText(String brand, String link, String token, int minutes) {
        return """
               A password reset was requested for your %s admin account.

               Open this link to choose a new password:
               %s

               If the link does not work, use this code in the dashboard:
               %s

               The link expires in %d minutes and can be used once.
               If you did not request this, ignore this email — your password is unchanged.
               """.formatted(brand, link, token, minutes);
    }

    static String resetHtml(String brand, String link, String token, int minutes) {
        String body = p("A password reset was requested for your admin account.")
                + """
                  <p style="margin:18px 0;">
                    <a href="%s" style="display:inline-block;background:#FF7A18;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:9px;font-size:14px;font-weight:600;">Choose a new password</a>
                  </p>
                  """.formatted(esc(link))
                + p("If the button does not work, use this code in the dashboard:")
                + """
                  <div style="padding:12px 16px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;word-break:break-all;color:#1c1917;">%s</div>
                  """.formatted(esc(token))
                + p("The link expires in %d minutes and can be used once. If you did not request this, ignore this email — your password is unchanged."
                        .formatted(minutes));
        return page(brand, "Reset your password", body);
    }

    private static String nz(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }
}
