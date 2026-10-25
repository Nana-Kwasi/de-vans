package com.quickchop.service;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Outbound email.
 *
 * Disabled unless MAIL_HOST and MAIL_FROM are both set, in which case every send is
 * logged instead — local development and a deploy without SMTP credentials both run
 * normally, and no request fails because mail is unavailable. This mirrors how
 * {@link NotificationService} treats push.
 *
 * Sends are @Async: SMTP is slow enough that an order-status update should not wait on
 * it, and a Gmail outage must not surface as a failed API call. Failures are logged,
 * never rethrown — losing a notification email is not worth failing the order.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender; // null when mail is not configured
    private final boolean enabled;
    private final String from;
    private final String supportInbox;
    private final String businessName;

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider,
                        @Value("${spring.mail.host:}") String host,
                        @Value("${app.mail.from:}") String from,
                        @Value("${app.mail.support-inbox:}") String supportInbox,
                        @Value("${quickchop.business-name:Qooka Qooks Restaurant}") String businessName) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.from = from == null ? "" : from.trim();
        this.supportInbox = supportInbox == null ? "" : supportInbox.trim();
        this.businessName = businessName;
        // The auto-configured JavaMailSender exists even with a blank host, so the host
        // is checked explicitly rather than inferred from the bean being present.
        this.enabled = mailSender != null && host != null && !host.isBlank() && !this.from.isBlank();

        if (enabled) {
            log.info("Email enabled — sending as {} via {}", this.from, host);
        } else {
            log.info("Email disabled (MAIL_HOST/MAIL_FROM not set) — messages will be logged only.");
        }
    }

    /** Sends an HTML email with a plain-text alternative. Never throws. */
    @Async("mailExecutor")
    public void send(String to, String subject, String plainBody, String htmlBody) {
        if (to == null || to.isBlank()) {
            log.debug("[mail:skipped] no recipient for '{}'", subject);
            return;
        }
        if (!enabled) {
            log.info("[mail:disabled] would send to {} — {}", to, subject);
            return;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            // Gmail rewrites a From it does not own, so `from` must be the authenticated
            // mailbox; only the display name in front of it is ours to choose.
            helper.setFrom(String.format("%s <%s>", businessName, from));
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(plainBody, htmlBody);
            mailSender.send(message);
            log.info("[mail] sent to {} — {}", to, subject);
        } catch (Exception e) {
            log.warn("[mail] failed to {} — {}: {}", to, subject, e.getMessage());
        }
    }

    /** Sends to the support inbox. No-op when SUPPORT_INBOX is unset. */
    public void sendToSupport(String subject, String plainBody, String htmlBody) {
        if (supportInbox.isBlank()) {
            log.debug("[mail:skipped] SUPPORT_INBOX not set — '{}' not sent", subject);
            return;
        }
        send(supportInbox, subject, plainBody, htmlBody);
    }

    public boolean isEnabled() {
        return enabled;
    }
}
