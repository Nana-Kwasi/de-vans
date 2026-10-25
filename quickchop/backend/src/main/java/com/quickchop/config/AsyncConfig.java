package com.quickchop.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Executor for outbound email.
 *
 * Mail is sent off the request thread: an SMTP round trip is slow even when it works,
 * and an order-status update should not wait on it — nor fail if Gmail is having a bad
 * day. The pool is small and the queue bounded, so a mail backlog cannot exhaust memory;
 * CallerRunsPolicy then pushes back onto the caller rather than silently dropping mail.
 */
@Configuration
@EnableAsync
@EnableScheduling   // DataRetentionJob
public class AsyncConfig {

    @Bean("mailExecutor")
    public Executor mailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(3);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("mail-");
        executor.setRejectedExecutionHandler(
                new java.util.concurrent.ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
