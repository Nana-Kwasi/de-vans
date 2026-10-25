package com.quickchop.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

public class ApiExceptions {

    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class NotFoundException extends RuntimeException {
        public NotFoundException(String message) { super(message); }
    }

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public static class BadRequestException extends RuntimeException {
        public BadRequestException(String message) { super(message); }
    }

    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public static class UnauthorizedException extends RuntimeException {
        public UnauthorizedException(String message) { super(message); }
    }

    /** The request lost a race or conflicts with current state (e.g. a job another rider already took). */
    @ResponseStatus(HttpStatus.CONFLICT)
    public static class ConflictException extends RuntimeException {
        public ConflictException(String message) { super(message); }
    }

    @ResponseStatus(HttpStatus.FORBIDDEN)
    public static class ForbiddenException extends RuntimeException {
        public ForbiddenException(String message) { super(message); }
    }

    /** The caller must accept the current policies first. Carries a machine-readable code. */
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public static class PoliciesNotAcceptedException extends RuntimeException {
        public static final String CODE = "POLICIES_NOT_ACCEPTED";
        public PoliciesNotAcceptedException(String message) { super(message); }
    }

    /** Too many failed attempts (login lockout, delivery PIN). */
    @ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
    public static class LockedException extends RuntimeException {
        public LockedException(String message) { super(message); }
    }

    /** An upstream storage operation (e.g. Supabase Storage upload) failed. */
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    public static class StorageException extends RuntimeException {
        public StorageException(String message) { super(message); }
        public StorageException(String message, Throwable cause) { super(message, cause); }
    }
}
