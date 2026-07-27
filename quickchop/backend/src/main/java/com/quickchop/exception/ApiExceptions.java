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

    /** An upstream storage operation (e.g. Supabase Storage upload) failed. */
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    public static class StorageException extends RuntimeException {
        public StorageException(String message) { super(message); }
        public StorageException(String message, Throwable cause) { super(message, cause); }
    }
}
