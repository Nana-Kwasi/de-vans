package com.quickchop.service;

import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.Customer;
import com.quickchop.entity.SupportTicket;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.repository.SupportTicketRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class SupportService {

    private final SupportTicketRepository repo;
    private final CustomerService customerService;
    private final EmailService emailService;
    private final String businessName;

    public SupportService(SupportTicketRepository repo, CustomerService customerService,
                          EmailService emailService,
                          @Value("${quickchop.business-name:Qooka Qooks Restaurant}") String businessName) {
        this.repo = repo;
        this.customerService = customerService;
        this.emailService = emailService;
        this.businessName = businessName;
    }

    /** Create a ticket for the currently-authenticated customer. */
    public SupportTicketDto create(SupportTicketRequest req) {
        Customer c = customerService.currentEntity();
        SupportTicket t = new SupportTicket();
        t.setCustomerId(c.getId());
        t.setName(c.getFullName());
        t.setEmail(c.getEmail());
        t.setPhone(c.getPhoneNumber());
        t.setCategory(req.category());
        t.setOrderNumber(req.orderNumber());
        t.setMessage(req.message());
        t.setStatus("OPEN");
        SupportTicket saved = repo.save(t);

        // Tickets used to land in the database and wait to be noticed. Sending is async
        // and swallows its own failures, so a mail problem cannot fail the customer's
        // request — they have still raised a ticket either way.
        emailService.sendToSupport(
                EmailTemplates.supportSubject(saved),
                EmailTemplates.supportText(saved),
                EmailTemplates.supportHtml(businessName, saved));

        return toDto(saved);
    }

    public List<SupportTicketDto> listAll(String status) {
        List<SupportTicket> list = (status == null || status.isBlank())
                ? repo.findAllByOrderByCreatedAtDesc()
                : repo.findByStatusOrderByCreatedAtDesc(status);
        return list.stream().map(SupportService::toDto).toList();
    }

    public SupportTicketDto updateStatus(UUID id, String status) {
        SupportTicket t = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("Ticket not found: " + id));
        t.setStatus(status);
        return toDto(repo.save(t));
    }

    static SupportTicketDto toDto(SupportTicket t) {
        return new SupportTicketDto(t.getId(), t.getCustomerId(), t.getName(), t.getEmail(), t.getPhone(),
                t.getCategory(), t.getOrderNumber(), t.getMessage(), t.getStatus(), t.getCreatedAt());
    }
}
