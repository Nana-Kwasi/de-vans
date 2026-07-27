package com.quickchop.service;

import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.Customer;
import com.quickchop.entity.SupportTicket;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.repository.SupportTicketRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class SupportService {

    private final SupportTicketRepository repo;
    private final CustomerService customerService;

    public SupportService(SupportTicketRepository repo, CustomerService customerService) {
        this.repo = repo;
        this.customerService = customerService;
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
        return toDto(repo.save(t));
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
