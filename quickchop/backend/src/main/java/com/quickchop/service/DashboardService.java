package com.quickchop.service;

import com.quickchop.dto.Dtos.DashboardSummaryDto;
import com.quickchop.entity.Order;
import com.quickchop.entity.OrderStatus;
import com.quickchop.repository.OrderRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

@Service
public class DashboardService {

    private final OrderRepository orderRepo;

    public DashboardService(OrderRepository orderRepo) {
        this.orderRepo = orderRepo;
    }

    /** Sales totals for today, this week, and an optional custom [from,to] range. */
    public DashboardSummaryDto summary(LocalDate from, LocalDate to) {
        OffsetDateTime startOfToday = LocalDate.now().atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        OffsetDateTime startOfWeek = LocalDate.now()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .atStartOfDay().atOffset(ZoneOffset.UTC);

        List<Order> today = countable(startOfToday, now);
        List<Order> week = countable(startOfWeek, now);

        OffsetDateTime rangeStart = (from != null ? from : LocalDate.now())
                .atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime rangeEnd = (to != null ? to : LocalDate.now())
                .plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);
        List<Order> range = countable(rangeStart, rangeEnd);

        return new DashboardSummaryDto(
                today.size(), revenue(today),
                week.size(), revenue(week),
                range.size(), revenue(range));
    }

    private List<Order> countable(OffsetDateTime start, OffsetDateTime end) {
        return orderRepo.findByCreatedAtBetween(start, end).stream()
                .filter(o -> o.getStatus() != OrderStatus.CANCELLED)
                .toList();
    }

    private BigDecimal revenue(List<Order> orders) {
        return orders.stream().map(Order::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
